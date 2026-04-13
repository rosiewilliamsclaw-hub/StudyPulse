// Frontend-side student types (no password_hash — never on client)

export interface StudentProfile {
  subject: string;
  unit: string;
  sac_date: string | null;
}

export interface StudentOnboarding {
  "Study Area 1": number;
  "Study Area 2": number;
  "Study Area 3": number;
}

export interface PublicStudent {
  student_id: string;
  email: string;
  onboarding_complete: boolean;
  profile: StudentProfile;
  onboarding: StudentOnboarding | Record<string, never>;
  confidence_map: Record<string, unknown>;
  question_history: unknown[];
  predicted_study_score: number | null;
}
