// predictStudyScore — Predictor agent for estimating VCE study score
//
// Pure calculation logic (no Claude API). Estimates a student's likely VCE study score
// (20–50 scale) based on their current confidence map. Updates the student's
// predicted_study_score field.
//
// Used by:
//   - POST /api/v1/submit-answer (HTTP route) — after scoring completes
//   - Any other module that imports it directly

import fs from "fs";
import path from "path";
import { readStudent, writeStudent } from "../utils/fileStore";
import { PredictorError, type PredictorResult, type StoredPrediction } from "../types/predictor";

// Directories anchored to backend project root via __dirname
const BACKEND_ROOT = path.resolve(__dirname, "..", "..");
const EXAM_WEIGHTINGS_DIR = path.join(BACKEND_ROOT, "data", "exam_weightings");

/**
 * Predicts a student's VCE study score based on their current confidence map.
 *
 * @param studentId - The student ID
 * @returns PredictorResult with estimate, low, high, weighted_confidence
 * @throws PredictorError with typed code on failure
 */
export async function predictStudyScore(studentId: string): Promise<PredictorResult> {
  // --- 1. Load student data ---
  const student = readStudent(studentId);
  if (!student) {
    console.error(`[predictor] Student not found: ${studentId}`);
    throw new PredictorError("student_not_found", `Student ${studentId} not found.`);
  }

  // --- 2. Calculate weighted confidence ---
  // For now: simple average of all confidence_map values
  // (Weightings are reserved for future use when topics are tagged by study area)
  let weightedConfidence = 0.0;

  const confidenceValues = Object.values(student.confidence_map).filter(
    (v): v is number => typeof v === "number"
  );

  if (confidenceValues.length > 0) {
    const sum = confidenceValues.reduce((acc, val) => acc + val, 0);
    weightedConfidence = sum / confidenceValues.length;
  }

  // Round to 2 decimal places
  weightedConfidence = Math.round(weightedConfidence * 100) / 100;

  // --- 3. Map weighted confidence to study score using linear interpolation ---
  // Bands: 0.0–0.3 → 20–28, 0.3–0.5 → 28–35, 0.5–0.7 → 35–40, 0.7–0.85 → 40–45, 0.85–1.0 → 45–50
  let estimate = mapConfidenceToScore(weightedConfidence);

  // Clamp to [20, 50]
  estimate = Math.max(20, Math.min(50, estimate));

  // --- 4. Calculate confidence range ---
  const low = Math.max(20, estimate - 3);
  const high = Math.min(50, estimate + 3);

  const result: PredictorResult = {
    estimate,
    low,
    high,
    weighted_confidence: weightedConfidence,
  };

  // --- 5. Store in student JSON ---
  const storedPrediction: StoredPrediction = {
    estimate,
    low,
    high,
    updated_at: new Date().toISOString(),
  };

  try {
    student.predicted_study_score = storedPrediction;
    writeStudent(student);
    console.log(
      `[predictor] Stored prediction for ${studentId}: estimate=${estimate}, confidence=${weightedConfidence}`
    );
  } catch (err) {
    console.error(`[predictor] Failed to store prediction for ${studentId}:`, err);
    throw new PredictorError(
      "invalid_input",
      "Could not save prediction to student file."
    );
  }

  return result;
}

/**
 * Maps a confidence value (0.0–1.0) to a VCE study score (20–50) using linear interpolation.
 *
 * Bands:
 * - 0.0–0.3 → 20–28
 * - 0.3–0.5 → 28–35
 * - 0.5–0.7 → 35–40
 * - 0.7–0.85 → 40–45
 * - 0.85–1.0 → 45–50
 */
function mapConfidenceToScore(confidence: number): number {
  // Define bands: [band_low, band_high, score_low, score_high]
  const bands: Array<[number, number, number, number]> = [
    [0.0, 0.3, 20, 28],
    [0.3, 0.5, 28, 35],
    [0.5, 0.7, 35, 40],
    [0.7, 0.85, 40, 45],
    [0.85, 1.0, 45, 50],
  ];

  // Find the band containing the confidence value
  for (const [bandLow, bandHigh, scoreLow, scoreHigh] of bands) {
    if (confidence >= bandLow && confidence <= bandHigh) {
      // Linear interpolation within the band
      const t = (confidence - bandLow) / (bandHigh - bandLow);
      const score = scoreLow + t * (scoreHigh - scoreLow);
      return Math.round(score); // Round to nearest integer
    }
  }

  // Fallback (should not reach here if confidence is in [0, 1])
  return confidence >= 0.5 ? 45 : 25;
}
