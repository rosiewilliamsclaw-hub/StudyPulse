// Questions API client functions
// Handles question generation and answer submission

const BASE = `${import.meta.env.VITE_API_URL ?? ""}/api/v1`;

export interface PublicQuestion {
  question_id: string;
  topic: string;
  stem: string;
  marks: number;
  response_format: "prose" | "dot_points" | "code";
  time_guide_minutes: number;
  common_mistakes: string[];
  audit_warning?: boolean;
}

export interface MarkBreakdown {
  mark: number;
  earned: boolean;
  reason: string;
}

export interface SubmitAnswerResponse {
  score: number;
  max: number;
  breakdown: MarkBreakdown[];
  model_answer: string;
  feedback_summary: string;
}

export interface TopicTileData {
  topic: string;
  confidence: number | null;
  attempted: boolean;
}

export interface StudyAreaData {
  name: string;
  topics: TopicTileData[];
}

export interface HeatmapDataResponse {
  study_areas: StudyAreaData[];
}

export interface PredictorResult {
  estimate: number | null;
  low?: number;
  high?: number;
  updated_at?: string;
}

export interface ScoreHistoryEntry {
  estimate: number;
  q_number: number;
}

export interface ScoreHistoryResponse {
  history: ScoreHistoryEntry[];
}

export interface ApiError {
  error: string;
  message?: string;
}

export interface DashboardData {
  overall_score: number;
  student_name: string;
  questions_answered: number;
  is_tutor?: boolean;
}

export interface StoredPrediction {
  estimate: number;
  low: number;
  high: number;
  updated_at: string;
}

export interface TutorStudentData {
  student_id: string;
  email: string;
  subject: string;
  unit: string;
  overall_score: number;
  predicted_score: StoredPrediction | null;
  weakest_topic: string | null;
  questions_answered: number;
  last_active: string | null;
  three_weakest_topics: string[];
}

export interface TutorDataResponse {
  students: TutorStudentData[];
}

/**
 * Fetch a new practice question for the student.
 * topic: null means auto-select the student's weakest topic.
 */
export async function generateQuestion(
  studentId: string,
  topic: string | null = null
): Promise<PublicQuestion> {
  const res = await fetch(`${BASE}/generate-question`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ student_id: studentId, topic }),
  });

  if (!res.ok) {
    const data: ApiError = await res.json();
    throw new Error(data.message ?? data.error ?? "Failed to generate question.");
  }

  return res.json() as Promise<PublicQuestion>;
}

/**
 * Submit a student's answer for marking.
 */
export async function submitAnswer(
  questionId: string,
  studentResponse: string
): Promise<SubmitAnswerResponse> {
  const res = await fetch(`${BASE}/submit-answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ question_id: questionId, student_response: studentResponse }),
  });

  if (!res.ok) {
    const data: ApiError = await res.json();
    throw new Error(data.message ?? data.error ?? "Failed to submit answer.");
  }

  return res.json() as Promise<SubmitAnswerResponse>;
}

/**
 * Fetch heatmap data (topic breakdown by study area).
 */
export async function fetchHeatmapData(): Promise<HeatmapDataResponse> {
  const res = await fetch(`${BASE}/heatmap-data`, {
    credentials: "include",
  });

  if (!res.ok) {
    const data: ApiError = await res.json().catch(() => ({}));
    throw new Error(data.message ?? data.error ?? "Failed to load heatmap data.");
  }

  return res.json() as Promise<HeatmapDataResponse>;
}

export async function fetchPredictedScore(): Promise<PredictorResult> {
  const res = await fetch(`${BASE}/predicted-score`, {
    credentials: "include",
  });

  if (!res.ok) {
    const data: ApiError = await res.json().catch(() => ({}));
    throw new Error(data.message ?? data.error ?? "Failed to load predicted score.");
  }

  return res.json() as Promise<PredictorResult>;
}

export async function fetchScoreHistory(): Promise<ScoreHistoryResponse> {
  const res = await fetch(`${BASE}/score-history`, {
    credentials: "include",
  });

  if (!res.ok) {
    const data: ApiError = await res.json().catch(() => ({}));
    throw new Error(data.message ?? data.error ?? "Failed to load score history.");
  }

  return res.json() as Promise<ScoreHistoryResponse>;
}

/**
 * Fetch tutor data: list of students and their progress.
 * Returns 403 if user is not a tutor.
 */
export async function fetchTutorData(): Promise<TutorDataResponse> {
  const res = await fetch(`${BASE}/tutor-data`, {
    credentials: "include",
  });

  if (res.status === 403) {
    throw new Error("Access denied: only tutors can view this page.");
  }

  if (!res.ok) {
    const data: ApiError = await res.json().catch(() => ({}));
    throw new Error(data.message ?? data.error ?? "Failed to load tutor data.");
  }

  return res.json() as Promise<TutorDataResponse>;
}
