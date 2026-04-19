// TypeScript types for the Predictor feature

export interface PredictorResult {
  estimate: number;              // integer, 20–50
  low: number;                   // estimate - 3, floored at 20
  high: number;                  // estimate + 3, capped at 50
  weighted_confidence: number;   // float, 2 decimal places
}

export interface StoredPrediction {
  estimate: number;
  low: number;
  high: number;
  updated_at: string; // ISO timestamp
}

// Type error codes for Predictor
export type PredictorErrorCode = "student_not_found" | "invalid_input";

// Typed error thrown by the predictor
export class PredictorError extends Error {
  constructor(
    public readonly code: PredictorErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PredictorError";
  }
}

// Type guard for PredictorError
export function isPredictorError(err: unknown): err is PredictorError {
  return err instanceof PredictorError;
}
