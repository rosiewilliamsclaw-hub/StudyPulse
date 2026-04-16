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

export interface SubmitAnswerResponse {
  score: number;
  max_score: number;
  breakdown: string[];
  model_answer: string;
}

export interface ApiError {
  error: string;
  message?: string;
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
