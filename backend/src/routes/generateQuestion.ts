// POST /api/v1/generate-question
//
// Protected: requires valid JWT cookie
// Generates a VCAA-format practice question for a student, with quality audit.
// Implements two-attempt audit loop:
// - Attempt 1: Generate question, audit it
// - If approved: return public question
// - If revision needed: Attempt 2: Generate with audit context, audit it again
// - If still needed: return with audit_warning flag
//
// Delegates question generation to generateQuestion() helper.
// Delegates audit to auditQuestion() helper.
// Responsible for orchestrating the loop, validation, error mapping, and response formatting.

import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/authMiddleware";
import { generateQuestion, stripHiddenFields } from "../agents/questionResearcher";
import { auditQuestion } from "../agents/auditor";
import {
  QuestionResearcherError,
  isQuestionResearcherError,
  AuditorError,
  type PublicQuestion,
} from "../types/question";

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

  const trimmedStudentId = student_id.trim();

  try {
    // --- ATTEMPT 1: Generate and audit ---
    console.log(`[generateQuestion route] Attempt 1 for student ${trimmedStudentId}`);
    let question = await generateQuestion(trimmedStudentId, topic);

    let auditResult;
    try {
      auditResult = await auditQuestion(question);
    } catch (auditErr) {
      // If audit infrastructure fails, log and treat as approved (fail-open)
      if (auditErr instanceof AuditorError) {
        console.error(`[generateQuestion route] Audit error (failing open): ${auditErr.message}`);
        auditResult = { verdict: "APPROVED" };
      } else {
        throw auditErr;
      }
    }

    if (auditResult.verdict === "APPROVED") {
      // First attempt approved — return to student
      const publicQuestion = stripHiddenFields(question);
      res.status(200).json(publicQuestion);
      return;
    }

    // Attempt 1 failed audit — prepare for attempt 2
    const auditIssues =
      auditResult.verdict === "REVISION_NEEDED"
        ? (((auditResult as any).issues ?? []) as string[])
        : [];
    console.log(
      `[generateQuestion route] Attempt 1 failed audit. Issues: ${auditIssues.join(", ")}`
    );

    // --- ATTEMPT 2: Regenerate with audit context and audit again ---
    console.log(`[generateQuestion route] Attempt 2 for student ${trimmedStudentId} with audit context`);
    question = await generateQuestion(trimmedStudentId, topic, auditIssues);

    try {
      auditResult = await auditQuestion(question);
    } catch (auditErr) {
      // If audit infrastructure fails on attempt 2, log and treat as approved (fail-open)
      if (auditErr instanceof AuditorError) {
        console.error(`[generateQuestion route] Audit error on attempt 2 (failing open): ${auditErr.message}`);
        auditResult = { verdict: "APPROVED" };
      } else {
        throw auditErr;
      }
    }

    // Return the second attempt result
    const publicQuestion = stripHiddenFields(question);

    if (auditResult.verdict === "APPROVED") {
      // Second attempt approved
      console.log(`[generateQuestion route] Attempt 2 approved`);
      res.status(200).json(publicQuestion);
    } else {
      // Second attempt still failed — return with audit_warning
      const issues =
        auditResult.verdict === "REVISION_NEEDED"
          ? (((auditResult as any).issues ?? []) as string[])
          : [];
      console.error(
        `[generateQuestion route] Attempt 2 also failed audit. Returning with warning. Issues: ${issues.join(", ")}`
      );
      const responseWithWarning: PublicQuestion = {
        ...publicQuestion,
        audit_warning: true,
      };
      res.status(200).json(responseWithWarning);
    }
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
