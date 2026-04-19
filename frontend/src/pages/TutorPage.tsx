// Tutor page — displays student progress and session prep cards
// Shows a table of students with their scores, weakest topics, and activity
// Includes prep cards for each student with session suggestions

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchTutorData, TutorDataResponse } from "../api/questions";
import "../styles/TutorPage.css";

type PageState = "loading" | "loaded" | "error" | "access_denied";

export default function TutorPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [state, setPageState] = useState<PageState>("loading");
  const [data, setData] = useState<TutorDataResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  // Load tutor data on mount
  useEffect(() => {
    if (!user) return;
    fetchTutorDataAsync();
  }, [user]);

  async function fetchTutorDataAsync() {
    setPageState("loading");
    setErrorMessage("");

    try {
      const response = await fetchTutorData();
      setData(response);
      setPageState("loaded");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load tutor data";

      // Check if this is a 403 access denied error
      if (message.includes("Access denied")) {
        setPageState("access_denied");
      } else {
        setPageState("error");
      }

      setErrorMessage(message);
    }
  }

  function handleBackToDashboard() {
    navigate("/dashboard");
  }

  function formatLastActive(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      // For older dates, show the date
      return date.toLocaleDateString();
    } catch {
      return timestamp;
    }
  }

  // Loading state
  if (state === "loading") {
    return (
      <div className="page-container tutor-container">
        <div className="loading-state">
          <p>Loading tutor dashboard...</p>
        </div>
      </div>
    );
  }

  // Access denied state (403)
  if (state === "access_denied") {
    return (
      <div className="page-container tutor-container">
        <div className="error-box">
          <h2>Access Denied</h2>
          <p>{errorMessage}</p>
          <button onClick={handleBackToDashboard} className="btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Error state
  if (state === "error") {
    return (
      <div className="page-container tutor-container">
        <div className="error-box">
          <h2>Error Loading Tutor Data</h2>
          <p>{errorMessage}</p>
          <button onClick={fetchTutorDataAsync} className="btn-primary">
            Try again
          </button>
          <button onClick={handleBackToDashboard} className="btn-link">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!data || !data.students) {
    return (
      <div className="page-container tutor-container">
        <div className="empty-state">
          <p>No students to display.</p>
          <button onClick={handleBackToDashboard} className="btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container tutor-container">
      <div className="tutor-card">
        <div className="tutor-header">
          <h1 className="tutor-title">Tutor Dashboard</h1>
          <button onClick={handleBackToDashboard} className="btn-secondary">
            ← Back to Dashboard
          </button>
        </div>

        {/* Student progress table */}
        <div className="table-section">
          <h2 className="section-title">Student Progress</h2>

          {data.students.length === 0 ? (
            <p className="empty-message">No students yet.</p>
          ) : (
            <div className="table-wrapper">
              <table className="students-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Subject & Unit</th>
                    <th>Overall Score</th>
                    <th>Predicted Score</th>
                    <th>Weakest Topic</th>
                    <th>Questions Answered</th>
                    <th>Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((student) => (
                    <tr key={student.email}>
                      <td className="cell-email">{student.email}</td>
                      <td className="cell-subject">{student.subject} — {student.unit}</td>
                      <td className="cell-score">
                        <span
                          className={`score-badge ${getScoreBadgeClass(
                            student.overall_score
                          )}`}
                        >
                          {student.overall_score}%
                        </span>
                      </td>
                      <td className="cell-predicted">
                        {student.predicted_score !== null
                          ? `${student.predicted_score.estimate} (${student.predicted_score.low}–${student.predicted_score.high})`
                          : "—"}
                      </td>
                      <td className="cell-weakest">
                        {student.weakest_topic ?? "—"}
                      </td>
                      <td className="cell-questions">
                        {student.questions_answered}
                      </td>
                      <td className="cell-last-active">
                        {student.last_active ? formatLastActive(student.last_active) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Session prep cards */}
        <div className="prep-cards-section">
          <h2 className="section-title">Session Prep</h2>

          {data.students.length === 0 ? (
            <p className="empty-message">No students to prepare for.</p>
          ) : (
            <div className="prep-cards-grid">
              {data.students.map((student) => (
                <div key={student.email} className="prep-card">
                  <h3 className="prep-card-email">{student.email}</h3>

                  <div className="prep-card-section">
                    <h4 className="prep-card-subtitle">Three weakest topics:</h4>
                    {student.three_weakest_topics &&
                    student.three_weakest_topics.length > 0 ? (
                      <ul className="weakest-topics-list">
                        {student.three_weakest_topics.map((topic, idx) => (
                          <li key={idx}>{topic}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="prep-card-empty">No data yet.</p>
                    )}
                  </div>

                  {student.weakest_topic && student.overall_score !== null && (
                    <div className="prep-card-section">
                      <p className="suggested-focus">
                        Suggested focus: Focus on{" "}
                        <strong>{student.weakest_topic}</strong> — student is
                        at <strong>{student.overall_score}%</strong> confidence
                      </p>
                      <a href="#" className="prep-card-link">
                        Ask student to practice:{" "}
                        <strong>{student.weakest_topic}</strong>
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getScoreBadgeClass(score: number): string {
  if (score <= 40) return "score-red";
  if (score <= 70) return "score-amber";
  return "score-green";
}
