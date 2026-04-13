// POST /api/v1/generate-question
//
// Protected: requires valid JWT cookie
// Generates a VCAA-format practice question for a student on their weakest topic.
// Delegates all business logic to the generateQuestion() helper.
// Responsible only for HTTP request validation, auth, and error-to-status-code mapping.

import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/authMiddleware";
import { generateQuestion, stripHiddenFields } from "../agents/questionResearcher";
import { QuestionResearcherError, isQuestionResearcherError } from "../types/question";

const router = Router();

interface GenerateQuestionRequest {
  student_id?: string;
  topic?: string | null;
}

// ---------------------------------------------------------------------------
// POST /api/v1/generate-question
// ---------------------------------------------------------------------------
router.post("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { student_id, topic } = req.body as GenerateQuestionRequest;

  // --- Validate student_id is provided ---
  if (!student_id || typeof student_id !== "string" || !student_id.trim()) {
    res.status(400).json({ error: "bad_request", message: "student_id is required." });
    return;
  }

  try {
    // Call the helper function
    // It returns the full question (including hidden fields)
    const fullQuestion = await generateQuestion(student_id.trim(), topic);

    // Strip hidden fields before returning to the student
    const publicQuestion = stripHiddenFields(fullQuestion);

    res.status(200).json(publicQuestion);
  } catch (err) {
    if (isQuestionResearcherError(err)) {
      // Map typed error codes to appropriate HTTP status codes
      switch (err.code) {
        case "student_not_found":
          res.status(404).json({ error: err.code, message: err.message });
          return;
        case "no_topic_available":
        case "topic_not_in_study_design":
          res.status(400).json({ error: err.code, message: err.message });
          return;
        case "parse_error":
        case "claude_error":
        case "missing_api_key":
        case "file_write_error":
          res.status(500).json({ error: err.code, message: err.message });
          return;
        default:
          res.status(500).json({ error: "internal_error", message: err.message });
          return;
      }
    }

    // Unexpected non-QuestionResearcherError
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[generateQuestion route] Unexpected error:", err);
    res.status(500).json({ error: "internal_error", message: detail });
  }
});

export default router;
