// Dashboard page — shows student's overall knowledge score and progress
// Displays an animated circular progress ring with the overall score percentage
// Includes a topic heatmap breakdown by study area

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchHeatmapData, HeatmapDataResponse } from "../api/questions";
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
  const [heatmapData, setHeatmapData] = useState<HeatmapDataResponse | null>(null);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [heatmapError, setHeatmapError] = useState("");
  const circumferenceRef = useRef(2 * Math.PI * 90);
  const heatmapSectionRef = useRef<HTMLDivElement>(null);

  // Load dashboard data on mount
  useEffect(() => {
    if (!user) return;
    fetchDashboardData();
  }, [user]);

  // Fetch heatmap data independently
  useEffect(() => {
    if (!user) return;
    fetchHeatmapDataAsync();
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

  async function fetchHeatmapDataAsync() {
    setHeatmapLoading(true);
    setHeatmapError("");

    try {
      const response = await fetchHeatmapData();
      setHeatmapData(response);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load heatmap data";
      setHeatmapError(message);
    } finally {
      setHeatmapLoading(false);
    }
  }

  function handleStartPractising() {
    navigate("/question");
  }

  function handleTopicClick(topic: string) {
    navigate("/question", { state: { topic } });
  }

  function handleViewTopicBreakdown(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    heatmapSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function getScoreColour(score: number): string {
    if (score <= 40) return "#E24B4A"; // Red
    if (score <= 70) return "#EF9F27"; // Amber
    return "#639922"; // Green
  }

  function getTileColour(confidence: number | null): string {
    if (confidence === null) return "#F1EFE8"; // Not attempted
    if (confidence >= 0 && confidence <= 40) return "#FCEBEB"; // Low confidence
    if (confidence >= 41 && confidence <= 70) return "#FAEEDA"; // Medium confidence
    if (confidence >= 71 && confidence <= 89) return "#EAF3DE"; // High confidence
    return "#085041"; // Very high confidence (90-100)
  }

  function getTileTextColour(confidence: number | null): string {
    if (confidence === null) return "#333333";
    if (confidence >= 90) return "#FFFFFF"; // White text for dark background
    return "#333333";
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
          <a href="#" onClick={handleViewTopicBreakdown} className="btn-link">
            View your topic breakdown
          </a>
        </div>

        {/* Heatmap section */}
        <div ref={heatmapSectionRef} className="heatmap-section">
          <h2 className="heatmap-title">Topic Breakdown</h2>

          {heatmapError && (
            <div className="heatmap-error">
              <p>{heatmapError}</p>
            </div>
          )}

          {heatmapLoading && (
            <div className="heatmap-loading">
              <p>Loading topic breakdown...</p>
            </div>
          )}

          {heatmapData && heatmapData.study_areas && (
            <div className="heatmap-container">
              {heatmapData.study_areas.map((studyArea) => (
                <div key={studyArea.name} className="study-area-group">
                  <h3 className="study-area-heading">{studyArea.name}</h3>
                  <div className="topic-tiles-grid">
                    {studyArea.topics.map((topic) => (
                      <button
                        key={topic.topic}
                        className="topic-tile"
                        style={{
                          backgroundColor: getTileColour(topic.confidence),
                          color: getTileTextColour(topic.confidence),
                        }}
                        onClick={() => handleTopicClick(topic.topic)}
                      >
                        <span className="topic-name">{topic.topic}</span>
                        <span className="topic-confidence">
                          {topic.confidence === null
                            ? "Not attempted"
                            : `${Math.round(topic.confidence)}%`}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
