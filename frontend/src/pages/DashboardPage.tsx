// Dashboard page — shows student's overall knowledge score and progress
// Displays an animated circular progress ring with the overall score percentage

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/DashboardPage.css";

interface DashboardData {
  overall_score: number;
  student_name: string;
  questions_answered: number;
}

type PageState = "loading" | "loaded" | "error";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [state, setPageState] = useState<PageState>("loading");
  const [data, setData] = useState<DashboardData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [animatedOffset, setAnimatedOffset] = useState<number | null>(null);
  const circumferenceRef = useRef(2 * Math.PI * 90);

  // Load dashboard data on mount
  useEffect(() => {
    if (!user) return;
    fetchDashboardData();
  }, [user]);

  // Trigger arc animation after data loads — two rAF frames ensure browser paints initial state first
  useEffect(() => {
    if (state === "loaded" && data !== null) {
      const circumference = circumferenceRef.current;
      const targetOffset = circumference * (1 - data.overall_score / 100);
      setAnimatedOffset(circumference); // reset to hidden first
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimatedOffset(targetOffset);
        });
      });
    }
  }, [state, data]);

  async function fetchDashboardData() {
    setPageState("loading");
    setErrorMessage("");

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? ""}/api/v1/dashboard-data`,
        {
          credentials: "include",
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.message ?? errorData.error ?? "Failed to load dashboard data"
        );
      }

      const dashboardData = (await res.json()) as DashboardData;
      setData(dashboardData);
      setPageState("loaded");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load dashboard data";
      setErrorMessage(message);
      setPageState("error");
    }
  }

  function handleStartPractising() {
    navigate("/question");
  }

  function getScoreColour(score: number): string {
    if (score <= 40) return "#E24B4A"; // Red
    if (score <= 70) return "#EF9F27"; // Amber
    return "#639922"; // Green
  }

  // Render based on page state
  if (state === "loading") {
    return (
      <div className="page-container dashboard-container">
        <div className="loading-state">
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="page-container dashboard-container">
        <div className="error-box">
          <p>{errorMessage}</p>
          <button onClick={fetchDashboardData} className="btn-primary">
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const score = data.overall_score;
  const scoreColour = getScoreColour(score);
  const circumference = circumferenceRef.current;
  const strokeDashoffset = animatedOffset ?? circumference; // use animated value; default to hidden before animation starts

  return (
    <div className="page-container dashboard-container">
      <div className="dashboard-card">
        <h1 className="dashboard-greeting">
          Welcome, {data.student_name.split("@")[0]}
        </h1>

        {/* Circular progress ring */}
        <div className="progress-ring-container">
          <svg
            className="progress-ring-svg"
            viewBox="0 0 200 200"
            width="200"
            height="200"
          >
            {/* Background track */}
            <circle
              cx="100"
              cy="100"
              r="90"
              className="progress-ring-background"
              fill="none"
              stroke="#E5E7EB"
              strokeWidth="8"
            />
            {/* Progress arc */}
            <circle
              cx="100"
              cy="100"
              r="90"
              className="progress-ring-arc"
              fill="none"
              stroke={scoreColour}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{
                transition: "stroke-dashoffset 1s ease-in-out",
              }}
              strokeLinecap="round"
            />
            {/* Centre text */}
            <text
              x="100"
              y="85"
              className="progress-ring-score"
              textAnchor="middle"
            >
              {score}%
            </text>
            <text
              x="100"
              y="110"
              className="progress-ring-label"
              textAnchor="middle"
            >
              Overall Score
            </text>
          </svg>
        </div>

        {/* Questions answered */}
        <div className="questions-answered">
          <p>Questions answered: <strong>{data.questions_answered}</strong></p>
        </div>

        {/* Action buttons */}
        <div className="dashboard-actions">
          <button onClick={handleStartPractising} className="btn-primary">
            Start practising
          </button>
          <a href="#" className="btn-link">
            View your topic breakdown
          </a>
        </div>
      </div>
    </div>
  );
}
