// generateQuestion — helper function for Question generation
//
// Contains all logic: student data loading, topic selection, study design extraction,
// Claude API call, question ID generation, and persistent storage.
//
// Used by:
//   - POST /api/v1/generate-question (HTTP route)
//   - Any other module that imports it directly
//
// Throws QuestionResearcherError with a typed code on all failure conditions.

import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { readStudent } from "../utils/fileStore";
import { extractStudyDesign } from "./extractor";
import { Question, QuestionResearcherError, type PublicQuestion } from "../types/question";
import { StudentFile } from "../types/student";

// Directories anchored to backend project root via __dirname
// __dirname in compiled output = dist/agents/
// two levels up → backend root
const BACKEND_ROOT = path.resolve(__dirname, "..", "..");
const QUESTIONS_DIR = path.join(BACKEND_ROOT, "data", "questions");
const PROMPTS_DIR = path.join(BACKEND_ROOT, "prompts");
const QUESTION_RESEARCHER_PROMPT_PATH = path.join(PROMPTS_DIR, "question_researcher.txt");

/**
 * Ensures /data/questions/ directory exists.
 * Called on first question write.
 */
function ensureQuestionsDir(): void {
  try {
    fs.mkdirSync(QUESTIONS_DIR, { recursive: true });
  } catch (err) {
    console.error(`[questionResearcher] Could not create questions directory: ${QUESTIONS_DIR}`, err);
    throw new QuestionResearcherError(
      "file_write_error",
      "Could not create questions directory on server."
    );
  }
}

/**
 * Converts a topic string to a slug for the question_id.
 * "Data validation" → "data_validation"
 */
function toTopicSlug(topic: string): string {
  return topic.trim().toLowerCase().replace(/\s+/g, "_");
}

/**
 * Selects the topic with the lowest confidence score from confidence_map.
 * Returns null if confidence_map is empty.
 */
function selectLowestConfidenceTopic(confidenceMap: Record<string, unknown>): string | null {
  if (!confidenceMap || Object.keys(confidenceMap).length === 0) {
    return null;
  }

  let lowestTopic = "";
  let lowestScore = Infinity;

  for (const [topic, scoreValue] of Object.entries(confidenceMap)) {
    const score = typeof scoreValue === "number" ? scoreValue : Infinity;
    if (score < lowestScore) {
      lowestScore = score;
      lowestTopic = topic;
    }
  }

  return lowestTopic || null;
}

/**
 * Selects the study area with the lowest onboarding rating.
 * Returns null if onboarding object is empty.
 */
function selectLowestOnboardingTopic(onboarding: Record<string, unknown>): string | null {
  if (!onboarding || Object.keys(onboarding).length === 0) {
    return null;
  }

  let lowestArea = "";
  let lowestRating = Infinity;

  for (const [area, ratingValue] of Object.entries(onboarding)) {
    const rating = typeof ratingValue === "number" ? ratingValue : Infinity;
    if (rating < lowestRating) {
      lowestRating = rating;
      lowestArea = area;
    }
  }

  return lowestArea || null;
}

/**
 * Extracts the unit number from a unit string.
 * "Unit 3" → 3
 * "Unit 4" → 4
 */
function extractUnitNumber(unitStr: string): number {
  const match = unitStr.match(/\d+/);
  if (!match) {
    throw new QuestionResearcherError("claude_error", `Could not extract unit number from: ${unitStr}`);
  }
  return parseInt(match[0], 10);
}

/**
 * Generates a question for a student on their weakest topic (or a specified topic).
 *
 * @param studentId - The student ID
 * @param topic - Optional explicit topic; if not provided, auto-selects weakest
 * @param auditContext - Optional array of audit issues from a previous failed attempt
 * @returns Full Question object (including hidden fields)
 * @throws QuestionResearcherError with typed code on all failure conditions
 */
export async function generateQuestion(
  studentId: string,
  topic?: string | null,
  auditContext?: string[]
): Promise<Question> {
  // --- 1. Load student data ---
  const student = readStudent(studentId);
  if (!student) {
    console.error(`[questionResearcher] Student not found: ${studentId}`);
    throw new QuestionResearcherError("student_not_found", `Student not found: ${studentId}`);
  }

  // --- 2. Select topic ---
  let selectedTopic: string;

  if (topic && topic.trim()) {
    selectedTopic = topic.trim();
  } else {
    // Try confidence_map first, then onboarding
    const confidenceSelection = selectLowestConfidenceTopic(student.confidence_map);
    const onboardingSelection = selectLowestOnboardingTopic(student.onboarding as Record<string, unknown>);
    selectedTopic = confidenceSelection || onboardingSelection || "";

    if (!selectedTopic) {
      console.error(`[questionResearcher] No topic available for student: ${studentId}`);
      throw new QuestionResearcherError(
        "no_topic_available",
        "No topic data available. Student must complete onboarding or have confidence scores."
      );
    }
  }

  console.log(
    `[questionResearcher] Selected topic for ${studentId}: "${selectedTopic}"`
  );

  // --- 3. Extract study design content ---
  const subject = student.profile.subject;
  const unit = extractUnitNumber(student.profile.unit);

  let studyDesignContent;
  try {
    studyDesignContent = await extractStudyDesign(subject, unit, selectedTopic);

    // Check if extractor returned not_found
    if ("error" in studyDesignContent && studyDesignContent.error === "not_found") {
      console.error(
        `[questionResearcher] Topic not found in study design: ${selectedTopic}`
      );
      throw new QuestionResearcherError(
        "topic_not_in_study_design",
        `Topic "${selectedTopic}" not found in study design for ${subject} Unit ${unit}.`
      );
    }
  } catch (err) {
    if (err instanceof QuestionResearcherError) throw err;
    // Propagate extractor errors
    console.error(`[questionResearcher] Study design extraction failed:`, err);
    const detail = err instanceof Error ? err.message : String(err);
    throw new QuestionResearcherError("claude_error", detail);
  }

  // --- 4. Call Claude to generate the question ---
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[questionResearcher] ANTHROPIC_API_KEY is not set in environment");
    throw new QuestionResearcherError(
      "missing_api_key",
      "ANTHROPIC_API_KEY is not configured on this server."
    );
  }

  // Load system prompt
  let systemPrompt: string;
  try {
    systemPrompt = fs.readFileSync(QUESTION_RESEARCHER_PROMPT_PATH, "utf-8").trim();
  } catch (err) {
    console.error(
      `[questionResearcher] Could not read prompt file: ${QUESTION_RESEARCHER_PROMPT_PATH}`,
      err
    );
    throw new QuestionResearcherError(
      "claude_error",
      "Question researcher system prompt file is missing or unreadable."
    );
  }

  let userMessage = `Student subject: ${subject}
Unit: ${unit}
Topic: ${selectedTopic}

Study Design Content:
${JSON.stringify(studyDesignContent, null, 2)}

Generate a VCAA-format practice question for this topic.`;

  // If this is a revision attempt (auditContext provided), append issues
  if (auditContext && auditContext.length > 0) {
    userMessage += `

Previous attempt failed quality audit. Issues to fix:
${auditContext.map((issue) => `- ${issue}`).join("\n")}
Please address all issues in this new attempt.`;
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
    console.log(`[questionResearcher] Claude responded (${rawResponse.length} chars)`);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[questionResearcher] Claude API call failed:", err);
    throw new QuestionResearcherError("claude_error", detail);
  }

  // --- 5. Parse Claude's JSON response ---
  // Strip markdown code fences if present
  const jsonStr = rawResponse
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let claudeData;
  try {
    claudeData = JSON.parse(jsonStr);
  } catch (err) {
    console.error(
      "[questionResearcher] Failed to parse Claude response as JSON. Raw:",
      rawResponse
    );
    throw new QuestionResearcherError("parse_error", "Claude returned non-JSON response");
  }

  // --- 6. Build complete question object ---
  const topicSlug = toTopicSlug(selectedTopic);
  const timestampMs = Date.now();
  const questionId = `${topicSlug}_${timestampMs}`;

  // Compute time_guide_minutes server-side (don't trust Claude's value)
  const marks = parseInt(claudeData.marks, 10) || 1;
  const timeGuideMinutes = marks * 2;

  const question: Question = {
    question_id: questionId,
    topic: selectedTopic,
    stem: claudeData.stem,
    marks,
    response_format: claudeData.response_format || "prose",
    time_guide_minutes: timeGuideMinutes,
    hidden_marking_guide: claudeData.hidden_marking_guide || [],
    model_answer: claudeData.model_answer || "",
    common_mistakes: claudeData.common_mistakes || [],
  };

  // --- 7. Persist question to disk ---
  try {
    ensureQuestionsDir();
    const questionPath = path.join(QUESTIONS_DIR, `${questionId}.json`);
    const tempPath = `${questionPath}.tmp`;

    fs.writeFileSync(tempPath, JSON.stringify(question, null, 2), "utf-8");
    fs.renameSync(tempPath, questionPath);

    console.log(`[questionResearcher] Question saved: ${questionPath}`);
  } catch (err) {
    console.error(`[questionResearcher] Failed to persist question:`, err);
    throw new QuestionResearcherError(
      "file_write_error",
      "Could not save question to disk."
    );
  }

  return question;
}

/**
 * Helper to strip hidden fields from a Question for public-facing responses.
 */
export function stripHiddenFields(question: Question): PublicQuestion {
  const { hidden_marking_guide, model_answer, ...publicQuestion } = question;
  return publicQuestion as PublicQuestion;
}
