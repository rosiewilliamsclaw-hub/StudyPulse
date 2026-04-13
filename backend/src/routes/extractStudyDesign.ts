// POST /api/v1/extract-study-design
//
// Internal utility route — no authentication required.
// Delegates all business logic to the extractStudyDesign() helper.
// Responsible only for HTTP request validation and error-to-status-code mapping.

import { Router, Request, Response } from "express";
import { extractStudyDesign } from "../agents/extractor";
import { ExtractStudyDesignRequest, ExtractorError } from "../types/extractor";

const router = Router();

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { subject, unit, topic } = req.body as Partial<ExtractStudyDesignRequest>;

  // --- Validate required fields ---
  if (!subject || typeof subject !== "string" || !subject.trim()) {
    res.status(400).json({ error: "bad_request", message: "subject is required." });
    return;
  }
  if (unit === undefined || unit === null) {
    res.status(400).json({ error: "bad_request", message: "unit is required." });
    return;
  }
  if (typeof unit !== "number" || !Number.isInteger(unit)) {
    res.status(400).json({ error: "bad_request", message: "unit must be an integer." });
    return;
  }
  if (!topic || typeof topic !== "string" || !topic.trim()) {
    res.status(400).json({ error: "bad_request", message: "topic is required." });
    return;
  }

  try {
    const result = await extractStudyDesign(subject.trim(), unit, topic.trim());
    // Pass Claude's result through directly (including not_found responses)
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof ExtractorError) {
      // Map typed error codes to appropriate HTTP status codes
      switch (err.code) {
        case "pdf_not_found":
          res.status(404).json({ error: err.code, message: err.message });
          return;
        case "pdf_unreadable":
        case "claude_error":
        case "parse_error":
        case "missing_api_key":
          res.status(500).json({ error: err.code, message: err.message });
          return;
        default:
          res.status(500).json({ error: "internal_error", message: err.message });
          return;
      }
    }

    // Unexpected non-ExtractorError
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[extractStudyDesign route] Unexpected error:", err);
    res.status(500).json({ error: "internal_error", message: detail });
  }
});

export default router;
