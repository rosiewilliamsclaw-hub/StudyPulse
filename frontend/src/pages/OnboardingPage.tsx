// Onboarding page — shown only on first login
// Protected route. Single-page form with four sections:
//   3a. Subject selection (pre-selected, read-only)
//   3b. Unit selection (required)
//   3c. Study area self-ratings 1–5 (all required)
//   3d. Next SAC date (optional, must not be in the past)

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { submitOnboarding } from "../api/auth";

const STUDY_AREAS = ["Study Area 1", "Study Area 2", "Study Area 3"] as const;
type StudyArea = (typeof STUDY_AREAS)[number];

// Build today's date string in YYYY-MM-DD for the date input min attribute
function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

export default function OnboardingPage() {
  const navigate = useNavigate();

  const [unit, setUnit] = useState<string>("");
  const [ratings, setRatings] = useState<Partial<Record<StudyArea, number>>>({});
  const [sacDate, setSacDate] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setRating(area: StudyArea, value: number) {
    setRatings((prev) => ({ ...prev, [area]: value }));
  }

  function validate(): string | null {
    if (!unit) return "Please select a unit.";

    for (const area of STUDY_AREAS) {
      if (ratings[area] === undefined) {
        return `Please rate "${area}".`;
      }
    }

    // SAC date validation (only if provided)
    if (sacDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sac = new Date(sacDate + "T00:00:00");
      if (sac < today) return "SAC date cannot be in the past.";
    }

    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    const serverError = await submitOnboarding({
      unit,
      study_area_ratings: ratings as Record<string, number>,
      sac_date: sacDate || null,
    });
    setSubmitting(false);

    if (serverError) {
      setError(serverError);
      return;
    }

    navigate("/dashboard", { replace: true });
  }

  return (
    <div className="page-container">
      <h1>Welcome to StudyPulse</h1>
      <p className="subtitle">Let's set up your profile so we can personalise your practice.</p>

      {error && (
        <div className="error-banner" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* 3a. Subject selection — pre-selected, cannot deselect */}
        <section className="form-section">
          <h2>Subject</h2>
          <div className="form-group">
            <label htmlFor="subject">Subject</label>
            <select id="subject" value="Applied Computing" disabled>
              <option value="Applied Computing">Applied Computing</option>
            </select>
            <span className="hint">Only Applied Computing is available at this time.</span>
          </div>
        </section>

        {/* 3b. Unit selection */}
        <section className="form-section">
          <h2>Unit</h2>
          <div className="form-group">
            <fieldset>
              <legend>Which unit are you studying? <span className="required">*</span></legend>
              {["Unit 3", "Unit 4"].map((u) => (
                <label key={u} className="radio-label">
                  <input
                    type="radio"
                    name="unit"
                    value={u}
                    checked={unit === u}
                    onChange={() => setUnit(u)}
                    disabled={submitting}
                  />
                  {u}
                </label>
              ))}
            </fieldset>
          </div>
        </section>

        {/* 3c. Study area self-ratings */}
        <section className="form-section">
          <h2>Rate your confidence</h2>
          <p className="hint">1 = Not confident at all, 5 = Very confident</p>
          {STUDY_AREAS.map((area) => (
            <div key={area} className="form-group rating-group">
              <fieldset>
                <legend>
                  {area} <span className="required">*</span>
                </legend>
                <div className="rating-options">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <label key={val} className="rating-label">
                      <input
                        type="radio"
                        name={`rating-${area}`}
                        value={val}
                        checked={ratings[area] === val}
                        onChange={() => setRating(area, val)}
                        disabled={submitting}
                        aria-label={`${area} — ${val} out of 5`}
                      />
                      {val}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          ))}
        </section>

        {/* 3d. Next SAC date (optional) */}
        <section className="form-section">
          <h2>Next SAC date <span className="optional">(optional)</span></h2>
          <div className="form-group">
            <label htmlFor="sac-date">Date</label>
            <input
              id="sac-date"
              type="date"
              value={sacDate}
              min={getTodayString()}
              onChange={(e) => setSacDate(e.target.value)}
              disabled={submitting}
            />
            <span className="hint">Leave blank if you don't know yet.</span>
          </div>
        </section>

        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Saving…" : "Get started"}
        </button>
      </form>
    </div>
  );
}
