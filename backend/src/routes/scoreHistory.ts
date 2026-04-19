// GET /api/v1/score-history
//
// Returns the student's score history with q_number added.
// Protected: requires valid JWT cookie

import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/authMiddleware";
import { readStudent } from "../utils/fileStore";
import type { ScoreHistoryEntry } from "../types/student";

const router = Router();

interface ScoreHistoryResponse {
  history: Array<ScoreHistoryEntry & { q_number: number }>;
}

// ---------------------------------------------------------------------------
// GET /api/v1/score-history
// ---------------------------------------------------------------------------
router.get("/", requireAuth, (req: Request, res: Response): void => {
  const studentId = req.student!.student_id;

  try {
    // Load student data
    const student = readStudent(studentId);
    if (!student) {
      console.error(`[scoreHistory] Student not found: ${studentId}`);
      res.status(404).json({
        error: "student_not_found",
        message: `Student ${studentId} not found.`,
      });
      return;
    }

    // Build history with q_number (1-based index)
    const scoreHistory = Array.isArray(student.score_history)
      ? student.score_history.map((entry, idx) => ({
          ...entry,
          q_number: idx + 1,
        }))
      : [];

    const response: ScoreHistoryResponse = {
      history: scoreHistory,
    };

    console.log(
      `[scoreHistory] Sent ${scoreHistory.length} entries for ${studentId}`
    );

    res.status(200).json(response);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[scoreHistory] Unexpected error:", err);
    res.status(500).json({ error: "internal_error", message: detail });
  }
});

export default router;
