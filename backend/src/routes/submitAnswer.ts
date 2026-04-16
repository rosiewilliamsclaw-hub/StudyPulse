// POST /api/v1/submit-answer
//
// Placeholder marker route — submits a student's answer for marking.
// For now, returns a stub response indicating the marker is not yet built.
// Protected: requires valid JWT cookie

import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();

interface SubmitAnswerRequest {
  question_id?: string;
  student_response?: string;
}

interface SubmitAnswerResponse {
  score: number;
  max_score: number;
  breakdown: string[];
  model_answer: string;
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

  // --- Validate required fields ---
  if (!question_id || typeof question_id !== "string" || !question_id.trim()) {
    res.status(400).json({ error: "bad_request", message: "question_id is required." });
    return;
  }

  if (student_response === undefined || student_response === null) {
    res.status(400).json({ error: "bad_request", message: "student_response is required." });
    return;
  }

  try {
    // Read the question file to get max_score (marks)
    const questionPath = path.join(QUESTIONS_DIR, `${question_id.trim()}.json`);

    if (!fs.existsSync(questionPath)) {
      console.error(`[submitAnswer] Question file not found: ${questionPath}`);
      res.status(404).json({
        error: "question_not_found",
        message: `Question ${question_id} not found.`,
      });
      return;
    }

    let questionData;
    try {
      const content = fs.readFileSync(questionPath, "utf-8");
      questionData = JSON.parse(content);
    } catch (err) {
      console.error(`[submitAnswer] Failed to read/parse question file: ${questionPath}`, err);
      res.status(500).json({
        error: "internal_error",
        message: "Could not read question data.",
      });
      return;
    }

    const maxScore = questionData.marks ?? 0;

    // --- Return placeholder response ---
    // Marker not yet built — return stub with score = 0
    const response: SubmitAnswerResponse = {
      score: 0,
      max_score: maxScore,
      breakdown: ["Marker not yet built"],
      model_answer: "",
    };

    console.log(
      `[submitAnswer] Stub response for question ${question_id.trim()}: score 0/${maxScore}`
    );
    res.status(200).json(response);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[submitAnswer] Unexpected error:", err);
    res.status(500).json({ error: "internal_error", message: detail });
  }
});

export default router;
