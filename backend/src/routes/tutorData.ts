// GET /api/v1/tutor-data
//
// Returns all students' progress data for the tutor dashboard.
// Protected: requires JWT matching TUTOR_EMAIL env var (case-insensitive)

import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { requireAuth } from "../middleware/authMiddleware";
import type { StudentFile } from "../types/student";
import type { TutorDataResponse, TutorStudentData } from "../types/tutor";

const router = Router();

// Directories anchored to backend project root
const BACKEND_ROOT = path.resolve(__dirname, "..", "..");
const STUDENTS_DIR = path.join(BACKEND_ROOT, "data", "students");

// ---------------------------------------------------------------------------
// GET /api/v1/tutor-data
// ---------------------------------------------------------------------------
router.get("/", requireAuth, (req: Request, res: Response): void => {
  const userEmail = req.student!.email.toLowerCase();
  const tutorEmail = process.env.TUTOR_EMAIL?.toLowerCase();

  // --- Check tutor authorization ---
  if (!tutorEmail || userEmail !== tutorEmail) {
    console.warn(
      `[tutorData] Access denied: ${req.student!.email} is not the tutor`
    );
    res.status(403).json({ error: "Access denied" });
    return;
  }

  try {
    // --- Read all student files ---
    if (!fs.existsSync(STUDENTS_DIR)) {
      res.status(200).json({ students: [] });
      return;
    }

    const files = fs.readdirSync(STUDENTS_DIR);
    const students: TutorStudentData[] = [];

    for (const file of files) {
      // Skip non-JSON files and the email index
      if (!file.endsWith(".json") || file === "_email_index.json") {
        continue;
      }

      const filePath = path.join(STUDENTS_DIR, file);

      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const student = JSON.parse(content) as StudentFile;

        // Skip the tutor's own account
        if (student.email.toLowerCase() === tutorEmail) {
          continue;
        }

        // --- Calculate metrics ---
        const confidenceValues = Object.values(student.confidence_map || {}).filter(
          (v): v is number => typeof v === "number"
        );

        const overallScore =
          confidenceValues.length > 0
            ? Math.round((confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length) * 100)
            : 0;

        // Find weakest topic (lowest confidence)
        let weakestTopic: string | null = null;
        let lowestConfidence = Infinity;
        for (const [topic, conf] of Object.entries(student.confidence_map || {})) {
          if (typeof conf === "number" && conf < lowestConfidence) {
            lowestConfidence = conf;
            weakestTopic = topic;
          }
        }

        // Find three weakest topics
        const topicConfidences: Array<[string, number]> = [];
        for (const [topic, conf] of Object.entries(student.confidence_map || {})) {
          if (typeof conf === "number") {
            topicConfidences.push([topic, conf]);
          }
        }
        topicConfidences.sort(([, a], [, b]) => a - b);
        const threeWeakest = topicConfidences.slice(0, 3).map(([t]) => t);

        // Get last active timestamp
        const historyArray = Array.isArray(student.question_history)
          ? student.question_history
          : [];
        let lastActive: string | null = null;
        if (historyArray.length > 0) {
          const lastEntry = historyArray[historyArray.length - 1] as Record<string, unknown>;
          if (typeof lastEntry.timestamp === "string") {
            lastActive = lastEntry.timestamp;
          }
        }

        // Build student data
        const tutorStudent: TutorStudentData = {
          student_id: student.student_id,
          email: student.email,
          subject: student.profile?.subject || "Unknown",
          unit: student.profile?.unit || "Unknown",
          overall_score: overallScore,
          predicted_score: student.predicted_study_score || null,
          weakest_topic: weakestTopic,
          three_weakest_topics: threeWeakest,
          questions_answered: historyArray.length,
          last_active: lastActive,
        };

        students.push(tutorStudent);
      } catch (err) {
        console.warn(`[tutorData] Could not parse student file ${file}:`, err);
        // Skip this file, continue with others
      }
    }

    // --- Sort by overall_score ascending (weakest first) ---
    students.sort((a, b) => a.overall_score - b.overall_score);

    const response: TutorDataResponse = { students };

    console.log(
      `[tutorData] Returned data for ${students.length} students to tutor`
    );

    res.status(200).json(response);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[tutorData] Unexpected error:", err);
    res.status(500).json({ error: "internal_error", message: detail });
  }
});

export default router;
