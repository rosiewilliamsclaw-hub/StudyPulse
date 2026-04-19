// GET /api/v1/predicted-score
//
// Returns the student's predicted VCE study score.
// Protected: requires valid JWT cookie

import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/authMiddleware";
import { readStudent } from "../utils/fileStore";

const router = Router();

interface PredictedScoreResponse {
  estimate: number | null;
  low?: number;
  high?: number;
  updated_at?: string;
}

// ---------------------------------------------------------------------------
// GET /api/v1/predicted-score
// ---------------------------------------------------------------------------
router.get("/", requireAuth, (req: Request, res: Response): void => {
  const studentId = req.student!.student_id;

  try {
    // Load student data
    const student = readStudent(studentId);
    if (!student) {
      console.error(`[predictedScore] Student not found: ${studentId}`);
      res.status(404).json({
        error: "student_not_found",
        message: `Student ${studentId} not found.`,
      });
      return;
    }

    // Return predicted score or null if never calculated
    const response: PredictedScoreResponse =
      student.predicted_study_score !== null
        ? {
            estimate: student.predicted_study_score.estimate,
            low: student.predicted_study_score.low,
            high: student.predicted_study_score.high,
            updated_at: student.predicted_study_score.updated_at,
          }
        : { estimate: null };

    console.log(
      `[predictedScore] Sent score for ${studentId}: ${response.estimate ?? "null"}`
    );

    res.status(200).json(response);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[predictedScore] Unexpected error:", err);
    res.status(500).json({ error: "internal_error", message: detail });
  }
});

export default router;
