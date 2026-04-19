// GET /api/v1/dashboard-data
//
// Returns student's dashboard data: overall knowledge score, student name, questions answered count.
// Protected: requires valid JWT cookie

import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/authMiddleware";
import { readStudent } from "../utils/fileStore";

const router = Router();

interface DashboardDataResponse {
  overall_score: number; // 0–100 integer
  student_name: string;  // student email
  questions_answered: number;
}

// ---------------------------------------------------------------------------
// GET /api/v1/dashboard-data
// ---------------------------------------------------------------------------
router.get("/", requireAuth, (req: Request, res: Response): void => {
  const studentId = req.student!.student_id;

  try {
    // Load student data
    const student = readStudent(studentId);
    if (!student) {
      console.error(`[dashboardData] Student not found: ${studentId}`);
      res.status(404).json({
        error: "student_not_found",
        message: `Student ${studentId} not found.`,
      });
      return;
    }

    // --- Calculate overall score ---
    // If confidence_map is empty → score = 0
    // Otherwise: weighted average of all confidence values, converted to percentage
    const confidenceValues = Object.values(student.confidence_map).filter(
      (v): v is number => typeof v === "number"
    );

    let overallScore = 0;
    if (confidenceValues.length > 0) {
      const sum = confidenceValues.reduce((acc, val) => acc + val, 0);
      const average = sum / confidenceValues.length;
      overallScore = Math.round(average * 100);
    }

    // Clamp to [0, 100]
    overallScore = Math.max(0, Math.min(overallScore, 100));

    const response: DashboardDataResponse = {
      overall_score: overallScore,
      student_name: student.email,
      questions_answered: Array.isArray(student.question_history)
        ? student.question_history.length
        : 0,
    };

    console.log(
      `[dashboardData] Sending dashboard data for ${studentId}: score ${overallScore}%`
    );

    res.status(200).json(response);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[dashboardData] Unexpected error:", err);
    res.status(500).json({ error: "internal_error", message: detail });
  }
});

export default router;
