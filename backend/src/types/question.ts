// TypeScript types for the QuestionResearcher feature

// The complete question data structure persisted to disk
// Includes hidden fields (marking guide, model answer)
export interface Question {
  question_id: string;                                    // "{topic_slug}_{timestamp_ms}"
  topic: string;
  stem: string;                                           // The full question text student sees
  marks: number;                                          // Integer 1–10 (typical)
  response_format: "prose" | "dot_points" | "code";
  time_guide_minutes: number;                             // Always marks * 2, computed server-side
  hidden_marking_guide: string[];                         // ["1 mark: ...", "2 marks: ...", ...]
  model_answer: string;                                   // Exemplar full-marks response
  common_mistakes: string[];                              // Realistic student errors
}

// Public-facing question response (hidden fields stripped)
// This is what the HTTP route returns
// May include optional audit_warning flag if question passed second audit attempt
export type PublicQuestion = Omit<Question, "hidden_marking_guide" | "model_answer"> & {
  audit_warning?: boolean;
};

// Type error codes for QuestionResearcher
export type QuestionResearcherErrorCode =
  | "student_not_found"
  | "no_topic_available"
  | "topic_not_in_study_design"
  | "parse_error"
  | "claude_error"
  | "missing_api_key"
  | "file_write_error";

// Typed error thrown by the helper
export class QuestionResearcherError extends Error {
  constructor(
    public readonly code: QuestionResearcherErrorCode,
    message: string
  ) {
    super(message);
    this.name = "QuestionResearcherError";
  }
}

// Type guard for checking if an error is a QuestionResearcherError
export function isQuestionResearcherError(err: unknown): err is QuestionResearcherError {
  return err instanceof QuestionResearcherError;
}

// Audit result types
export type AuditResult =
  | { verdict: "APPROVED" }
  | { verdict: "REVISION_NEEDED"; issues: string[] };

// Type error codes for Auditor
export type AuditorErrorCode = "audit_error";

// Typed error thrown by auditor
export class AuditorError extends Error {
  constructor(
    public readonly code: AuditorErrorCode,
    message: string
  ) {
    super(message);
    this.name = "AuditorError";
  }
}
