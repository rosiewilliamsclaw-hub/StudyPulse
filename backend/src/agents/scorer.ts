// updateScores — Scorer agent for updating confidence map
//
// Pure calculation logic (no Claude API). Updates a student's confidence
// score for a topic after a marked response, and determines the next
// recommended topic based on confidence levels and recency.
//
// Used by:
//   - POST /api/v1/submit-answer (HTTP route) — after marking completes
//   - Any other module that imports it directly

import { readStudent, writeStudent } from "../utils/fileStore";
import { ScorerError, type ScorerResult } from "../types/scorer";

/**
 * Updates a student's confidence score for a topic after a practice attempt.
 * Uses weighted rolling average to blend existing confidence with new performance.
 *
 * @param studentId - The student ID
 * @param topic - The topic that was practised
 * @param score - The marks earned
 * @param maxMarks - The total marks available
 * @returns ScorerResult with updated confidence and next recommended topic
 * @throws ScorerError with typed code on failure
 */
export async function updateScores(
  studentId: string,
  topic: string,
  score: number,
  maxMarks: number
): Promise<ScorerResult> {
  // --- 1. Load student data ---
  const student = readStudent(studentId);
  if (!student) {
    console.error(`[scorer] Student not found: ${studentId}`);
    throw new ScorerError("student_not_found", `Student ${studentId} not found.`);
  }

  // --- 2. Calculate performance ratio ---
  const performanceRatio = maxMarks === 0 ? 0 : score / maxMarks;

  // --- 3. Determine starting confidence for this topic ---
  let existingConfidence: number;
  const priorConfidence = student.confidence_map[topic];

  if (typeof priorConfidence === "number") {
    existingConfidence = priorConfidence;
  } else {
    // No prior confidence — check onboarding rating
    const onboardingRating = (student.onboarding as Record<string, unknown>)[topic];

    if (typeof onboardingRating === "number" && onboardingRating >= 1 && onboardingRating <= 5) {
      // Convert 1–5 rating to 0.0–1.0
      existingConfidence = onboardingRating / 5;
    } else {
      // No onboarding rating — default starting value
      existingConfidence = 0.3;
    }
  }

  // --- 4. Apply weighted rolling average formula ---
  // new_confidence = (existing * 0.6) + (performance_ratio * 0.4)
  let newConfidence = existingConfidence * 0.6 + performanceRatio * 0.4;

  // --- 5. Clamp to [0.0, 1.0] and round to 2 decimal places ---
  newConfidence = Math.max(0, Math.min(newConfidence, 1.0));
  newConfidence = Math.round(newConfidence * 100) / 100;

  // --- 6. Update confidence_map ---
  student.confidence_map[topic] = newConfidence;

  // Write back atomically
  try {
    writeStudent(student);
    console.log(
      `[scorer] Updated confidence for ${studentId} on topic "${topic}": ${newConfidence}`
    );
  } catch (err) {
    console.error(`[scorer] Failed to write student file for ${studentId}:`, err);
    throw new ScorerError(
      "invalid_input",
      "Could not save confidence map update."
    );
  }

  // --- 7. Determine next recommended topic ---
  const nextTopic = determineNextTopic(student.confidence_map, student.question_history, topic);

  const result: ScorerResult = {
    updated_topic: topic,
    new_confidence: newConfidence,
    next_topic: nextTopic,
  };

  console.log(
    `[scorer] Recommendation for ${studentId}: next topic "${nextTopic}"`
  );

  return result;
}

/**
 * Determines the next recommended topic based on confidence levels and practice history.
 *
 * Algorithm:
 * - If any topic has confidence ≤ 0.8: recommend the topic with lowest confidence
 * - If all topics > 0.8: recommend the topic practised least recently
 * - Fallback: recommend the topic with lowest confidence
 *
 * @param confidenceMap - Student's confidence_map
 * @param questionHistory - Student's question_history
 * @param currentTopic - The topic just practised (to avoid immediate re-recommendation)
 * @returns The recommended next topic
 */
function determineNextTopic(
  confidenceMap: Record<string, unknown>,
  questionHistory: unknown[],
  currentTopic: string
): string {
  // If confidence_map is empty, default to current topic
  const topics = Object.keys(confidenceMap);
  if (topics.length === 0) {
    return currentTopic;
  }

  // Check if any topic has confidence ≤ 0.8
  const lowConfidenceTopics = topics.filter((t) => {
    const conf = confidenceMap[t];
    return typeof conf === "number" && conf <= 0.8;
  });

  if (lowConfidenceTopics.length > 0) {
    // Return the topic with the lowest confidence
    let lowestTopic = lowConfidenceTopics[0];
    let lowestConfidence = confidenceMap[lowestTopic] as number;

    for (const t of lowConfidenceTopics) {
      const conf = confidenceMap[t] as number;
      if (conf < lowestConfidence) {
        lowestConfidence = conf;
        lowestTopic = t;
      }
    }

    return lowestTopic;
  }

  // All topics > 0.8: find the least recently practised topic
  const historyEntries = Array.isArray(questionHistory) ? questionHistory : [];

  // Build a map of topic → most recent index in question_history
  const topicLastSeenIndex = new Map<string, number>();

  for (let i = historyEntries.length - 1; i >= 0; i--) {
    const entry = historyEntries[i] as Record<string, unknown> | undefined;
    if (entry && typeof entry.topic === "string") {
      if (!topicLastSeenIndex.has(entry.topic)) {
        topicLastSeenIndex.set(entry.topic, i);
      }
    }
  }

  // Find the topic with the earliest (or never-seen) index
  let leastRecentTopic = topics[0];
  let leastRecentIndex = topicLastSeenIndex.get(leastRecentTopic) ?? Infinity;

  for (const t of topics) {
    const idx = topicLastSeenIndex.get(t) ?? Infinity;
    if (idx < leastRecentIndex) {
      leastRecentIndex = idx;
      leastRecentTopic = t;
    }
  }

  return leastRecentTopic;
}
