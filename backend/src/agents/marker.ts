// markResponse — Marker agent for evaluating student responses
//
// Reads a question file, gets the hidden marking guide and model answer,
// calls Claude to mark the student's response, and returns structured feedback.
//
// Used by:
//   - POST /api/v1/submit-answer (HTTP route)
//   - Any other module that imports it directly

import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { MarkerError, type MarkingResult } from "../types/marker";

// Directories anchored to backend project root via __dirname
const BACKEND_ROOT = path.resolve(__dirname, "..", "..");
const QUESTIONS_DIR = path.join(BACKEND_ROOT, "data", "questions");
const PROMPTS_DIR = path.join(BACKEND_ROOT, "prompts");
const MARKER_PROMPT_PATH = path.join(PROMPTS_DIR, "marker.txt");

/**
 * Marks a student's response against the hidden marking guide.
 *
 * @param questionId - The question ID
 * @param studentResponse - The student's answer text
 * @returns MarkingResult with score, breakdown, and feedback
 * @throws MarkerError with typed code on failure
 */
export async function markResponse(
  questionId: string,
  studentResponse: string
): Promise<MarkingResult> {
  // --- 1. Load question data ---
  const questionPath = path.join(QUESTIONS_DIR, `${questionId.trim()}.json`);

  if (!fs.existsSync(questionPath)) {
    console.error(`[marker] Question file not found: ${questionPath}`);
    throw new MarkerError("question_not_found", `Question ${questionId} not found.`);
  }

  let questionData;
  try {
    const content = fs.readFileSync(questionPath, "utf-8");
    questionData = JSON.parse(content) as {
      stem: string;
      topic: string;
      marks: number;
      hidden_marking_guide: string[];
      model_answer: string;
    };
  } catch (err) {
    console.error(`[marker] Failed to read/parse question file: ${questionPath}`, err);
    throw new MarkerError(
      "question_not_found",
      "Could not read question data."
    );
  }

  const { stem, topic, marks, hidden_marking_guide, model_answer } = questionData;

  // --- 2. Load system prompt ---
  let systemPrompt: string;
  try {
    systemPrompt = fs.readFileSync(MARKER_PROMPT_PATH, "utf-8").trim();
  } catch (err) {
    console.error(`[marker] Could not read marker prompt file: ${MARKER_PROMPT_PATH}`, err);
    throw new MarkerError("claude_error", "Marker system prompt file is missing.");
  }

  // --- 3. Build user message for Claude ---
  const markingGuideText = hidden_marking_guide.map((guide, idx) => `${idx + 1}. ${guide}`).join("\n");

  const userMessage = `Question: ${stem}
Topic: ${topic}
Marks available: ${marks}

Marking Guide:
${markingGuideText}

Model Answer:
${model_answer}

Student Response:
${studentResponse}

Mark this response strictly according to the marking guide.`;

  // --- 4. Call Claude API ---
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[marker] ANTHROPIC_API_KEY is not set in environment");
    throw new MarkerError(
      "missing_api_key",
      "ANTHROPIC_API_KEY is not configured on this server."
    );
  }

  const client = new Anthropic({ apiKey });

  let rawResponse: string;
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const firstBlock = message.content[0];
    if (!firstBlock || firstBlock.type !== "text") {
      throw new Error("Claude returned no text content");
    }
    rawResponse = firstBlock.text.trim();
    console.log(`[marker] Claude responded (${rawResponse.length} chars)`);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[marker] Claude API call failed:", err);
    throw new MarkerError("claude_error", detail);
  }

  // --- 5. Parse Claude's JSON response ---
  const jsonStr = rawResponse
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let claudeData;
  try {
    claudeData = JSON.parse(jsonStr) as MarkingResult;
  } catch (err) {
    console.error("[marker] Failed to parse Claude response as JSON. Raw:", rawResponse);
    throw new MarkerError("parse_error", "Claude returned non-JSON response");
  }

  // --- 6. Validate and normalise result ---
  const score = Math.max(0, Math.min(claudeData.score, marks)); // Cap between 0 and marks
  const max = marks;

  // Log if breakdown count doesn't match marks
  if (claudeData.breakdown.length !== marks) {
    console.warn(
      `[marker] Breakdown count (${claudeData.breakdown.length}) doesn't match marks (${marks}) for question ${questionId}`
    );
  }

  const result: MarkingResult = {
    score,
    max,
    breakdown: claudeData.breakdown,
    model_answer: claudeData.model_answer || "",
    feedback_summary: claudeData.feedback_summary || "",
  };

  console.log(
    `[marker] Marking complete for question ${questionId}: ${score}/${max} marks`
  );

  return result;
}
