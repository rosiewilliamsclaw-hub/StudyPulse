// auditQuestion — quality gate for generated questions
//
// Validates every question against VCAA standards before the student sees it.
// Uses Claude (haiku model) to perform detailed criterion checks.
//
// If audit infrastructure fails (Claude API error), the question passes through
// as APPROVED (fail-open) to prevent blocking student access.
//
// Used by:
//   - POST /api/v1/generate-question (HTTP route) — called for each generated question
//   - Any other module that imports it directly

import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { Question, AuditResult, AuditorError } from "../types/question";

// Directories anchored to backend project root via __dirname
const BACKEND_ROOT = path.resolve(__dirname, "..", "..");
const PROMPTS_DIR = path.join(BACKEND_ROOT, "prompts");
const AUDITOR_PROMPT_PATH = path.join(PROMPTS_DIR, "auditor.txt");

/**
 * Audits a generated question against VCAA quality standards.
 *
 * @param question - The full question object (including hidden fields)
 * @returns AuditResult with verdict "APPROVED" or "REVISION_NEEDED" with issues
 * @throws AuditorError only on Claude API errors
 *
 * NOTE: If audit infrastructure fails (Claude API error), the error is logged
 * and the question is treated as APPROVED (fail-open). This prevents audit
 * infrastructure failure from blocking students.
 */
export async function auditQuestion(question: Question): Promise<AuditResult> {
  // Load system prompt
  let systemPrompt: string;
  try {
    systemPrompt = fs.readFileSync(AUDITOR_PROMPT_PATH, "utf-8").trim();
  } catch (err) {
    console.error(
      `[auditor] Could not read auditor prompt file: ${AUDITOR_PROMPT_PATH}`,
      err
    );
    throw new AuditorError("audit_error", "Auditor system prompt file is missing or unreadable.");
  }

  // Prepare the question JSON for Claude
  const userMessage = JSON.stringify(question, null, 2);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[auditor] ANTHROPIC_API_KEY is not set in environment");
    throw new AuditorError(
      "audit_error",
      "ANTHROPIC_API_KEY is not configured on this server."
    );
  }

  const client = new Anthropic({ apiKey });

  let rawResponse: string;
  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const firstBlock = message.content[0];
    if (!firstBlock || firstBlock.type !== "text") {
      throw new Error("Claude returned no text content");
    }
    rawResponse = firstBlock.text.trim();
    console.log(`[auditor] Audit response for ${question.question_id} (${rawResponse.length} chars)`);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[auditor] Claude API call failed:", err);
    throw new AuditorError("audit_error", detail);
  }

  // Parse Claude's JSON response
  // Strip markdown code fences if present
  const jsonStr = rawResponse
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let verdict: AuditResult;
  try {
    verdict = JSON.parse(jsonStr) as AuditResult;
  } catch (err) {
    console.error(
      `[auditor] Failed to parse audit response as JSON for ${question.question_id}. Raw:`,
      rawResponse
    );
    // Treat unparseable audit response as REVISION_NEEDED
    return {
      verdict: "REVISION_NEEDED",
      issues: ["Audit response could not be parsed"],
    };
  }

  // Log the result
  if (verdict.verdict === "APPROVED") {
    console.log(`[auditor] ✓ APPROVED: ${question.question_id}`);
  } else {
    console.log(
      `[auditor] ✗ REVISION_NEEDED: ${question.question_id}`,
      verdict.issues
    );
  }

  return verdict;
}
