// TypeScript types for the Study Design extractor feature

// HTTP request body for POST /api/v1/extract-study-design
export interface ExtractStudyDesignRequest {
  subject: string;
  unit: number;
  topic: string;
}

// Successful extraction response from Claude
export interface ExtractedStudyContent {
  topic: string;
  unit: number | string;
  outcome: string;
  key_knowledge: string[];
  key_skills: string[];
  vcaa_terminology: string[];
  assessment_type: string;
}

// Claude's not_found response (passed through as-is with 200)
export interface ExtractorNotFound {
  error: "not_found";
  closest_match: string;
}

// Union type for what extractStudyDesign() resolves to
export type ExtractorResult = ExtractedStudyContent | ExtractorNotFound;

// Typed errors thrown by the helper (so the route can map them to HTTP codes)
export type ExtractorErrorCode =
  | "pdf_not_found"
  | "pdf_unreadable"
  | "claude_error"
  | "parse_error"
  | "missing_api_key";

export class ExtractorError extends Error {
  constructor(
    public readonly code: ExtractorErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ExtractorError";
  }
}
