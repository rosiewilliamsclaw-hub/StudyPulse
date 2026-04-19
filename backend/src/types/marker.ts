// TypeScript types for the Marker feature

export interface MarkBreakdown {
  mark: number;    // which mark number (1, 2, 3...)
  earned: boolean; // whether the student earned this mark
  reason: string;  // plain English explanation
}

export interface MarkingResult {
  score: number;
  max: number;
  breakdown: MarkBreakdown[];
  model_answer: string;
  feedback_summary: string;
}

// Type error codes for Marker
export type MarkerErrorCode =
  | "question_not_found"
  | "parse_error"
  | "claude_error"
  | "missing_api_key";

// Typed error thrown by the marker
export class MarkerError extends Error {
  constructor(
    public readonly code: MarkerErrorCode,
    message: string
  ) {
    super(message);
    this.name = "MarkerError";
  }
}

// Type guard for MarkerError
export function isMarkerError(err: unknown): err is MarkerError {
  return err instanceof MarkerError;
}

// Question history entry (stored in student file)
export interface QuestionHistoryEntry {
  question_id: string;
  topic: string;
  score: number;
  max: number;
  timestamp: string; // ISO timestamp
}
