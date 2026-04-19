// TypeScript types for the Tutor Dashboard feature

import type { StoredPrediction } from "./predictor";

export interface TutorStudentData {
  student_id: string;
  email: string;
  subject: string;
  unit: string;
  overall_score: number;            // 0-100 percentage
  predicted_score: StoredPrediction | null;
  weakest_topic: string | null;
  three_weakest_topics: string[];
  questions_answered: number;
  last_active: string | null;       // ISO timestamp
}

export interface TutorDataResponse {
  students: TutorStudentData[];
}
