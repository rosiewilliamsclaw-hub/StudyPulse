// TypeScript types for the Scorer feature

export interface ScorerResult {
  updated_topic: string;
  new_confidence: number;  // rounded to 2 decimal places, in [0.0, 1.0]
  next_topic: string;
}

// Type error codes for Scorer
export type ScorerErrorCode = "student_not_found" | "invalid_input";

// Typed error thrown by the scorer
export class ScorerError extends Error {
  constructor(
    public readonly code: ScorerErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ScorerError";
  }
}

// Type guard for ScorerError
export function isScorerError(err: unknown): err is ScorerError {
  return err instanceof ScorerError;
}
