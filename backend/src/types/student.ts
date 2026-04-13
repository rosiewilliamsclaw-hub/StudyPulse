// Shared TypeScript interface for the student data schema
// All fields match the exact JSON structure specified in the Feature 1 spec

export interface StudentProfile {
  subject: string;
  unit: string;
  sac_date: string | null; // ISO date string or null
}

export interface StudentOnboarding {
  "Study Area 1": number; // 1–5
  "Study Area 2": number; // 1–5
  "Study Area 3": number; // 1–5
}

// The full student file written to /data/students/{student_id}.json
// NOTE: password_hash is an internal field required for auth; not in the spec's JSON sample
// but necessary for login. It is stored securely alongside spec-required fields.
export interface StudentFile {
  student_id: string;
  email: string;
  password_hash: string; // bcrypt hash — never plaintext
  onboarding_complete: boolean;
  profile: StudentProfile;
  onboarding: StudentOnboarding | Record<string, never>; // empty before onboarding
  confidence_map: Record<string, unknown>;
  question_history: unknown[];
  predicted_study_score: number | null;
}

// Lightweight email index mapping email -> student_id
// Stored at /data/students/_email_index.json to avoid full directory scans
export interface EmailIndex {
  [email: string]: string; // email → student_id
}

// Safe public representation of a student (no password_hash)
export type PublicStudent = Omit<StudentFile, "password_hash">;
