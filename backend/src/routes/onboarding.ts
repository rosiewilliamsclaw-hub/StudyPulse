// Onboarding route
// POST /api/v1/onboarding
// Protected: requires valid JWT cookie
// Validates and saves onboarding form data, marks onboarding_complete = true

import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/authMiddleware";
import { readStudent, writeStudent } from "../utils/fileStore";

const router = Router();

const VALID_UNITS = ["Unit 3", "Unit 4"];
const STUDY_AREAS = ["Study Area 1", "Study Area 2", "Study Area 3"];

/**
 * Validates that a SAC date string is:
 * 1. A valid date format (YYYY-MM-DD)
 * 2. Not in the past (compared to today's date, no time component)
 */
function validateSacDate(dateStr: string): { valid: boolean; error?: string } {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    return { valid: false, error: "SAC date must be in YYYY-MM-DD format." };
  }

  const today = new Date();
  // Zero out time to compare dates only
  today.setHours(0, 0, 0, 0);

  const sacDate = new Date(dateStr + "T00:00:00");
  if (isNaN(sacDate.getTime())) {
    return { valid: false, error: "SAC date is not a valid date." };
  }

  if (sacDate < today) {
    return { valid: false, error: "SAC date cannot be in the past." };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// POST /api/v1/onboarding
// ---------------------------------------------------------------------------
router.post("/", requireAuth, (req: Request, res: Response): void => {
  const studentId = req.student!.student_id;
  const student = readStudent(studentId);

  if (!student) {
    res.status(401).json({ error: "Student account not found." });
    return;
  }

  // If already completed, do not allow resubmission
  if (student.onboarding_complete) {
    res.status(409).json({ error: "Onboarding has already been completed." });
    return;
  }

  const { unit, study_area_ratings, sac_date } = req.body as {
    unit?: string;
    study_area_ratings?: Record<string, number>;
    sac_date?: string | null;
  };

  // --- Validate unit ---
  if (!unit || !VALID_UNITS.includes(unit)) {
    res.status(400).json({ error: "Please select a valid unit (Unit 3 or Unit 4)." });
    return;
  }

  // --- Validate study area ratings ---
  if (!study_area_ratings || typeof study_area_ratings !== "object") {
    res.status(400).json({ error: "Study area ratings are required." });
    return;
  }

  for (const area of STUDY_AREAS) {
    const rating = study_area_ratings[area];
    if (rating === undefined || rating === null) {
      res.status(400).json({ error: `Please rate "${area}".` });
      return;
    }
    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      res.status(400).json({ error: `Rating for "${area}" must be a whole number between 1 and 5.` });
      return;
    }
  }

  // --- Validate SAC date (optional) ---
  let resolvedSacDate: string | null = null;
  if (sac_date) {
    const sacValidation = validateSacDate(sac_date);
    if (!sacValidation.valid) {
      res.status(400).json({ error: sacValidation.error });
      return;
    }
    resolvedSacDate = sac_date;
  }

  // --- Build and save updated student file ---
  const updatedStudent = {
    ...student,
    onboarding_complete: true,
    profile: {
      subject: "Applied Computing",
      unit,
      sac_date: resolvedSacDate,
    },
    onboarding: {
      "Study Area 1": study_area_ratings["Study Area 1"],
      "Study Area 2": study_area_ratings["Study Area 2"],
      "Study Area 3": study_area_ratings["Study Area 3"],
    },
  };

  try {
    writeStudent(updatedStudent);
    res.status(200).json({ redirect: "/dashboard" });
  } catch (err) {
    console.error("Onboarding save error:", err);
    res.status(500).json({ error: "Failed to save onboarding data. Please try again." });
  }
});

export default router;
