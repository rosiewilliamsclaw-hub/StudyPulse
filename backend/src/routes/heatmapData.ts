// GET /api/v1/heatmap-data
//
// Returns heatmap data: topics grouped by study area with confidence scores.
// Protected: requires valid JWT cookie

import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/authMiddleware";
import { readStudent } from "../utils/fileStore";
import { extractStudyDesign } from "../agents/extractor";

const router = Router();

interface TopicTileData {
  topic: string;
  confidence: number | null; // percentage 0-100 or null if not attempted
  attempted: boolean;
}

interface StudyAreaData {
  name: string;
  topics: TopicTileData[];
}

interface HeatmapDataResponse {
  study_areas: StudyAreaData[];
}

// ---------------------------------------------------------------------------
// GET /api/v1/heatmap-data
// ---------------------------------------------------------------------------
router.get("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const studentId = req.student!.student_id;

  try {
    // Load student data
    const student = readStudent(studentId);
    if (!student) {
      console.error(`[heatmapData] Student not found: ${studentId}`);
      res.status(404).json({
        error: "student_not_found",
        message: `Student ${studentId} not found.`,
      });
      return;
    }

    // --- Build topic list ---
    // Primary: try to extract all outcomes from study design
    let allTopics: Set<string> = new Set();
    let groupedByArea: Map<string, Set<string>> = new Map();

    // Try extracting "all outcomes" — likely to fail, but worth attempting
    try {
      const subject = student.profile.subject;
      const unitStr = student.profile.unit; // e.g. "Unit 3"
      const unitMatch = unitStr.match(/\d+/);
      if (!unitMatch) {
        throw new Error("Could not extract unit number from profile — using fallback");
      }
      {
        const unit = parseInt(unitMatch[0], 10);
        const extractResult = await extractStudyDesign(subject, unit, "all outcomes");

        // Check if we got valid structured data (not a not_found error)
        if ("key_knowledge" in extractResult && Array.isArray(extractResult.key_knowledge)) {
          // Group key_knowledge under a study area based on the subject
          const studyAreaName = subject; // Use subject as study area name
          const topics = extractResult.key_knowledge.map((item: string) =>
            item.replace(/^[\d.]+\s*/, "") // Remove leading numbers/dots
          );

          groupedByArea.set(studyAreaName, new Set(topics));
          topics.forEach((t: string) => allTopics.add(t));

          console.log(
            `[heatmapData] Extracted ${topics.length} topics from study design for ${studentId}`
          );
        } else {
          throw new Error("Invalid extraction response");
        }
      }
    } catch (err) {
      // Extraction failed or returned not_found — fallback to confidence_map + onboarding
      console.log(
        `[heatmapData] Extraction failed for ${studentId}, using fallback (confidence_map + onboarding)`
      );

      // Union of confidence_map keys and onboarding keys
      const confidenceKeys = Object.keys(student.confidence_map || {});
      const onboardingKeys = Object.keys(student.onboarding || {});
      const unionKeys = new Set([...confidenceKeys, ...onboardingKeys]);

      unionKeys.forEach((key) => {
        allTopics.add(key);
        // Group all under subject name
        const areaName = student.profile.subject;
        if (!groupedByArea.has(areaName)) {
          groupedByArea.set(areaName, new Set());
        }
        groupedByArea.get(areaName)!.add(key);
      });
    }

    // If no topics found at all, return empty heatmap
    if (allTopics.size === 0) {
      console.log(`[heatmapData] No topics found for ${studentId}`);
      const emptyResponse: HeatmapDataResponse = {
        study_areas: [],
      };
      res.status(200).json(emptyResponse);
      return;
    }

    // --- Calculate confidence for each topic ---
    const studyAreas: StudyAreaData[] = [];

    for (const [areaName, topicSet] of groupedByArea.entries()) {
      const topicTiles: TopicTileData[] = [];

      for (const topic of topicSet) {
        let confidence: number | null = null;
        let attempted = false;

        // Check confidence_map first
        const confMapValue = student.confidence_map[topic];
        if (typeof confMapValue === "number") {
          confidence = Math.round(confMapValue * 100);
          attempted = true;
        } else {
          // Check onboarding for rating
          const onboardingRating = (student.onboarding as Record<string, unknown>)[topic];
          if (typeof onboardingRating === "number") {
            confidence = Math.round((onboardingRating / 5) * 100);
            attempted = false; // onboarding rating, not yet attempted
          }
        }

        topicTiles.push({
          topic,
          confidence,
          attempted,
        });
      }

      // Sort tiles by topic name for consistency
      topicTiles.sort((a, b) => a.topic.localeCompare(b.topic));

      studyAreas.push({
        name: areaName,
        topics: topicTiles,
      });
    }

    const response: HeatmapDataResponse = {
      study_areas: studyAreas,
    };

    console.log(
      `[heatmapData] Sending heatmap for ${studentId}: ${studyAreas.length} study areas, ${allTopics.size} topics`
    );

    res.status(200).json(response);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[heatmapData] Unexpected error:", err);
    res.status(500).json({ error: "internal_error", message: detail });
  }
});

export default router;
