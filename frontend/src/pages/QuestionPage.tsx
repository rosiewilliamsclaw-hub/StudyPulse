// Question practice page — the main student interaction
// Displays a question, collects answer, shows feedback

import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { generateQuestion, submitAnswer } from "../api/questions";
import type { PublicQuestion, SubmitAnswerResponse } from "../api/questions";
import "../styles/QuestionPage.css";

type PageState = "loading" | "question" | "submitted" | "error";

export default function QuestionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [state, setPageState] = useState<PageState>("loading");
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [response, setResponse] = useState("");
  const [feedback, setFeedback] = useState<SubmitAnswerResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModelAnswer, setShowModelAnswer] = useState(false);

  // Load a new question on mount and when fetching new questions
  useEffect(() => {
    if (!user) return;
    
    // Check if a specific topic was passed from the heatmap
    const passedTopic = (location.state as { topic?: string })?.topic || null;
    fetchNewQuestion(passedTopic);
  }, [user, location.state]);

  async function fetchNewQuestion(topic: string | null = null) {
    setPageState("loading");
    setResponse("");
    setFeedback(null);
    setErrorMessage("");
    setShowModelAnswer(false);

    try {
      const q = await generateQuestion(user!.student_id, topic);
      setQuestion(q);
      setPageState("question");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load question.";
      setErrorMessage(message);
      setPageState("error");
    }
  }

  async function handleSubmit() {
    // Validate textarea is not empty
    if (!response.trim()) {
      setErrorMessage("Please write an answer before submitting");
      return;
    }

    if (!question) return;

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const result = await submitAnswer(question.question_id, response.trim());
      setFeedback(result);
      setPageState("submitted");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setErrorMessage(message);
      setIsSubmitting(false);
    }
  }

  function handleSkip() {
    fetchNewQuestion(null);
  }

  function handleNextQuestion() {
    navigate("/dashboard");
  }

  function getResponseFormatHint(format: string): string {
    switch (format) {
      case "prose":
        return "Write your answer in full sentences";
      case "dot_points":
        return "Write your answer in dot points";
      case "code":
        return "Write your answer as code";
      default:
        return "";
    }
  }

  // Render based on page state
  if (state === "loading") {
    return (
      <div className="page-container">
        <div className="loading-state">
          <p>Generating your question...</p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="page-container">
        <div className="error-box">
          <p>{errorMessage}</p>
          <button onClick={() => fetchNewQuestion(null)} className="btn-primary">
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!question) {
    return null;
  }

  return (
    <div className="page-container">
      {/* Audit warning if present */}
      {question.audit_warning && (
        <div className="audit-warning">
          This question was generated with reduced quality checks.
        </div>
      )}

      {/* Question section */}
      <div className="question-box">
        <div className="question-meta">
          <span className="marks">{question.marks} marks</span>
          <span className="time-guide">Suggested time: {question.time_guide_minutes} minutes</span>
        </div>

        <div className="question-stem">
          <p>{question.stem}</p>
        </div>

        <div className="response-format-hint">
          {getResponseFormatHint(question.response_format)}
        </div>

        {/* Only show textarea and submit if not yet submitted */}
        {state === "question" && (
          <>
            <textarea
              className="response-textarea"
              placeholder="Type your answer here..."
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={6}
              disabled={isSubmitting}
            />

            {errorMessage && <div className="error-message">{errorMessage}</div>}

            <div className="button-group">
              <button
                onClick={handleSubmit}
                className="btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Marking your response..." : "Submit answer"}
              </button>
              <button
                onClick={handleSkip}
                className="btn-link"
                disabled={isSubmitting}
              >
                Skip this question
              </button>
            </div>
          </>
        )}
      </div>

      {/* Feedback section (shown after submission) */}
      {state === "submitted" && feedback && (
        <div className="feedback-box">
          <div className="score-section">
            <span className="score-label">Score:</span>
            <span className="score-value">
              {feedback.score} / {feedback.max} marks
            </span>
          </div>

          {feedback.breakdown && feedback.breakdown.length > 0 && (
            <div className="breakdown-section">
              <h3>Mark-by-mark feedback</h3>
              <ul>
                {feedback.breakdown.map((item) => (
                  <li key={item.mark} className={item.earned ? "earned" : "not-earned"}>
                    <span className="mark-icon">{item.earned ? "✅" : "❌"}</span>
                    <span className="mark-number">Mark {item.mark}:</span>
                    <span className="mark-reason">{item.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {feedback.feedback_summary && (
            <div className="feedback-summary">
              <p>{feedback.feedback_summary}</p>
            </div>
          )}

          {feedback.model_answer && (
            <div className="model-answer-section">
              <button
                className="btn-link"
                onClick={() => setShowModelAnswer(!showModelAnswer)}
              >
                {showModelAnswer ? "Hide model answer" : "Show model answer"}
              </button>
              {showModelAnswer && (
                <div className="model-answer-content">
                  {feedback.model_answer}
                </div>
              )}
            </div>
          )}

          <button onClick={handleNextQuestion} className="btn-primary">
            Next question
          </button>
        </div>
      )}
    </div>
  );
}
