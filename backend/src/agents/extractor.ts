// extractStudyDesign — helper function for Study Design PDF extraction
//
// Contains all logic: slug conversion, PDF text extraction via pdf-parse,
// Claude API call, and JSON parsing.
//
// Used by:
//   - POST /api/v1/extract-study-design (HTTP route)
//   - Any other module that imports it directly
//
// Throws ExtractorError with a typed code on all failure conditions.

import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
// pdf-parse has no bundled types — using require to avoid ESM interop issues
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (
  buffer: Buffer
) => Promise<{ text: string }>;

import {
  ExtractorError,
  ExtractorResult,
} from "../types/extractor";

// Directories are anchored to backend project root via __dirname
// __dirname in compiled output = dist/agents/
// two levels up → backend root
const BACKEND_ROOT = path.resolve(__dirname, "..", "..");
const STUDY_DESIGNS_DIR = path.join(BACKEND_ROOT, "study_designs");
const PROMPTS_DIR = path.join(BACKEND_ROOT, "prompts");
const EXTRACTOR_PROMPT_PATH = path.join(PROMPTS_DIR, "extractor.txt");

/**
 * Converts a subject name to a filesystem slug.
 * "Applied Computing" → "applied_computing"
 * Case-insensitive, trims whitespace, replaces spaces with underscores.
 */
function toSubjectSlug(subject: string): string {
  return subject.trim().toLowerCase().replace(/\s+/g, "_");
}

/**
 * Extracts structured VCE study content from a Study Design PDF.
 *
 * @param subject - Subject name (e.g. "Applied Computing")
 * @param unit    - Unit number (e.g. 3)
 * @param topic   - Topic to extract (e.g. "data validation")
 * @returns Parsed JSON result from Claude
 * @throws ExtractorError with typed code on all failure conditions
 */
export async function extractStudyDesign(
  subject: string,
  unit: number,
  topic: string
): Promise<ExtractorResult> {
  // --- 1. Resolve PDF path ---
  const slug = toSubjectSlug(subject);
  const pdfPath = path.join(STUDY_DESIGNS_DIR, `${slug}.pdf`);

  if (!fs.existsSync(pdfPath)) {
    console.error(`[extractor] PDF not found at: ${pdfPath}`);
    throw new ExtractorError(
      "pdf_not_found",
      `No study design found for subject: ${subject}`
    );
  }

  // --- 2. Extract PDF text (read once into buffer) ---
  let pdfText: string;
  try {
    const buffer = fs.readFileSync(pdfPath);
    const parsed = await pdfParse(buffer);
    pdfText = parsed.text?.trim() ?? "";

    if (!pdfText) {
      console.error(`[extractor] PDF parsed but text is empty: ${pdfPath}`);
      throw new ExtractorError(
        "pdf_unreadable",
        `Could not extract text from PDF for subject: ${subject}`
      );
    }

    console.log(
      `[extractor] Extracted ${pdfText.length} chars from ${slug}.pdf`
    );
  } catch (err) {
    // Re-throw ExtractorErrors as-is; wrap anything else
    if (err instanceof ExtractorError) throw err;
    console.error(`[extractor] pdf-parse failed for ${pdfPath}:`, err);
    throw new ExtractorError(
      "pdf_unreadable",
      `Could not extract text from PDF for subject: ${subject}`
    );
  }

  // --- 3. Load system prompt ---
  let systemPrompt: string;
  try {
    systemPrompt = fs.readFileSync(EXTRACTOR_PROMPT_PATH, "utf-8").trim();
  } catch (err) {
    console.error(`[extractor] Could not read prompt file: ${EXTRACTOR_PROMPT_PATH}`, err);
    // Treat as a server-side config error
    throw new ExtractorError(
      "claude_error",
      "Extractor system prompt file is missing or unreadable."
    );
  }

  // --- 4. Call Claude API ---
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[extractor] ANTHROPIC_API_KEY is not set in environment");
    throw new ExtractorError(
      "missing_api_key",
      "ANTHROPIC_API_KEY is not configured on this server."
    );
  }

  const client = new Anthropic({ apiKey });

  const userMessage = `Subject: ${subject}
Unit: ${unit}
Topic: ${topic}

Study Design Text:
${pdfText}`;

  let rawResponse: string;
  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    // Extract text content from the response
    const firstBlock = message.content[0];
    if (!firstBlock || firstBlock.type !== "text") {
      throw new Error("Claude returned no text content");
    }
    rawResponse = firstBlock.text.trim();
    console.log(`[extractor] Claude responded (${rawResponse.length} chars)`);
  } catch (err) {
    if (err instanceof ExtractorError) throw err;
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[extractor] Claude API call failed:", err);
    throw new ExtractorError("claude_error", detail);
  }

  // --- 5. Parse Claude's JSON response ---
  // Claude sometimes wraps JSON in markdown code fences — strip them
  const jsonStr = rawResponse
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    const parsed = JSON.parse(jsonStr) as ExtractorResult;
    return parsed;
  } catch (err) {
    console.error(
      "[extractor] Failed to parse Claude response as JSON. Raw:",
      rawResponse
    );
    throw new ExtractorError(
      "parse_error",
      "Claude returned non-JSON response"
    );
  }
}
