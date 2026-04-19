// POST /api/v1/submit-answer
//
// Marks a student's answer using the Marker agent and updates their question_history.
// Protected: requires valid JWT cookie

import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { requireAuth } from "../middleware/authMiddleware";
import { markResponse } from "../agents/marker";
import { updateScores } from "../agents/scorer";
import { predictStudyScore } from "../agents/predictor";
import { readStudent, writeStudent } from "../utils/fileStore";
import { isMarkerError, type MarkingResult, type QuestionHistoryEntry } from "../types/marker";
import { isScorerError } from "../types/scorer";
import { isPredictorError } from "../types/predictor";

const router = Router();

interface SubmitAnswerRequest {
  question_id?: string;
  student_response?: string;
}

/**
 * Resolves the backend root directory.
 * In compiled output, __dirname = dist/routes/
 * Two levels up → backend root
 */
const BACKEND_ROOT = path.resolve(__dirname, "..", "..");
const QUESTIONS_DIR = path.join(BACKEND_ROOT, "data", "questions");

// ---------------------------------------------------------------------------
// POST /api/v1/submit-answer
// ---------------------------------------------------------------------------
router.post("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { question_id, student_response } = req.body as SubmitAnswerRequest;
  const studentId = req.student!.student_id;

  // --- Validate required fields ---
  if (!question_id || typeof question_id !== "string" || !question_id.trim()) {
    res.status(400).json({ error: "bad_request", message: "question_id is required." });
    return;
  }

  if (
    !student_response ||
    typeof student_response !== "string" ||
    !student_response.trim()
  ) {
    res
      .status(400)
      .json({ error: "bad_request", message: "student_response cannot be empty." });
    return;
  }

  try {
    // --- 1. Mark the response ---
    const markingResult = await markResponse(question_id.trim(), student_response.trim());

    // --- 2. Read question file to get the topic (needed for history and scoring) ---
    const questionPath = path.join(QUESTIONS_DIR, `${question_id.trim()}.json`);
    let topic = "unknown";
    if (fs.existsSync(questionPath)) {
      try {
        const questionContent = fs.readFileSync(questionPath, "utf-8");
        const questionData = JSON.parse(questionContent) as { topic?: string };
        topic = questionData.topic || "unknown";
      } catch (_) {
        // If we can't read topic, use "unknown"
      }
    }

    // --- 3. Update student's question_history (best-effort) ---
    try {
      const student = readStudent(studentId);
      if (student) {
        const historyEntry: QuestionHistoryEntry = {
          question_id: question_id.trim(),
          topic,
          score: markingResult.score,
          max: markingResult.max,
          timestamp: new Date().toISOString(),
        };

        student.question_history.push(historyEntry);
        writeStudent(student);
        console.log(
          `[submitAnswer] Updated question_history for student ${studentId}: added ${question_id}`
        );
      }
    } catch (err) {
      // Log but don't fail the request over history update failure
      console.error(
        `[submitAnswer] Failed to update question_history for student ${studentId}:`,
        err
      );
    }

    // --- 4. Update confidence scores (best-effort) ---
    try {
      await updateScores(studentId, topic, markingResult.score, markingResult.max);
    } catch (err) {
      if (isScorerError(err)) {
        // Log but don't fail the request over scoring failure
        console.error(
          `[submitAnswer] Failed to update scores for student ${studentId}:`,
          err.message
        );
      } else {
        console.error(
          `[submitAnswer] Unexpected error during scoring for student ${studentId}:`,
          err
        );
      }
    }

    // --- 5. Predict study score (best-effort) ---
    let predictionResult;
    try {
      predictionResult = await predictStudyScore(studentId);
    } catch (err) {
      if (isPredictorError(err)) {
        // Log but don't fail the request over prediction failure
        console.error(
          `[submitAnswer] Failed to predict score for student ${studentId}:`,
          err.message
        );
      } else {
        console.error(
          `[submitAnswer] Unexpected error during prediction for student ${studentId}:`,
          err
        );
      }
    }

    // --- 6. Append to score_history (best-effort) ---
    if (predictionResult) {
      try {
        const student = readStudent(studentId);
        if (student) {
          if (!Array.isArray(student.score_history)) {
            student.score_history = [];
          }
          student.score_history.push({
            estimate: predictionResult.estimate,
            timestamp: new Date().toISOString(),
          });
          writeStudent(student);
          console.log(
            `[submitAnswer] Appended to score_history for ${studentId}: estimate=${predictionResult.estimate}`
          );
        }
      } catch (err) {
        // Log but don't fail the request over history append failure
        console.error(
          `[submitAnswer] Failed to append to score_history for ${studentId}:`,
          err
        );
      }
    }

    // --- 7. Return marking result ---
    res.status(200).json(markingResult);
  } catch (err) {
    if (isMarkerError(err)) {
      // Map typed error codes to appropriate HTTP status codes
      switch (err.code) {
        case "question_not_found":
          res
            .status(404)
            .json({ error: err.code, message: err.message });
          return;
        case "parse_error":
        case "claude_error":
        case "missing_api_key":
          res
            .status(500)
            .json({ error: err.code, message: err.message });
          return;
        default:
          res
            .status(500)
            .json({ error: "internal_error", message: err.message });
          return;
      }
    }

    // Unexpected non-MarkerError
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[submitAnswer] Unexpected error:", err);
    res.status(500).json({ error: "internal_error", message: detail });
  }
});

export default router;
