// Dashboard page — shows student's overall knowledge score and progress
// Displays an animated circular progress ring with the overall score percentage
// Includes a topic heatmap breakdown by study area

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  fetchHeatmapData,
  HeatmapDataResponse,
  fetchPredictedScore,
  fetchScoreHistory,
  PredictorResult,
  ScoreHistoryResponse,
} from "../api/questions";
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
  const [predictedScore, setPredictedScore] = useState<PredictorResult | null>(null);
  const [predictedScoreLoading, setPredictedScoreLoading] = useState(false);
  const [predictedScoreError, setPredictedScoreError] = useState("");
  const [scoreHistory, setScoreHistory] = useState<ScoreHistoryResponse | null>(null);
  const [_scoreHistoryLoading, _setScoreHistoryLoading] = useState(false);
  const [_scoreHistoryError, _setScoreHistoryError] = useState("");
  const [animatedPredictedScore, setAnimatedPredictedScore] = useState<number>(20);
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

  // Fetch predicted score independently
  useEffect(() => {
    if (!user) return;
    fetchPredictedScoreAsync();
  }, [user]);

  // Fetch score history independently
  useEffect(() => {
    if (!user) return;
    fetchScoreHistoryAsync();
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

  // Trigger count-up animation for predicted score
  useEffect(() => {
    if (predictedScore && predictedScore.estimate !== null) {
      const startTime = performance.now();
      const duration = 1200; // 1.2 seconds
      const start = 20;
      const end = predictedScore.estimate;
      let rafHandle: number;

      const animateCountUp = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const current = Math.round(start + (end - start) * progress);
        setAnimatedPredictedScore(current);

        if (progress < 1) {
          rafHandle = requestAnimationFrame(animateCountUp);
        }
      };

      rafHandle = requestAnimationFrame(animateCountUp);

      // Cleanup: cancel animation if component unmounts before completion
      return () => cancelAnimationFrame(rafHandle);
    }
  }, [predictedScore]);

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

  async function fetchPredictedScoreAsync() {
    setPredictedScoreLoading(true);
    setPredictedScoreError("");

    try {
      const response = await fetchPredictedScore();
      setPredictedScore(response);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load predicted score";
      setPredictedScoreError(message);
    } finally {
      setPredictedScoreLoading(false);
    }
  }

  async function fetchScoreHistoryAsync() {
    _setScoreHistoryLoading(true);
    _setScoreHistoryError("");

    try {
      const response = await fetchScoreHistory();
      setScoreHistory(response);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load score history";
      _setScoreHistoryError(message);
    } finally {
      _setScoreHistoryLoading(false);
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

  function getPredictedScoreColour(score: number): string {
    if (score >= 20 && score <= 29) return "#E24B4A"; // Red
    if (score >= 30 && score <= 39) return "#EF9F27"; // Amber
    if (score >= 40 && score <= 44) return "#639922"; // Green
    if (score >= 45 && score <= 50) return "#085041"; // Deep green
    return "#085041";
  }

  function scoreToY(score: number, chartTop: number, chartBottom: number): number {
    const minScore = 20;
    const maxScore = 50;
    return chartBottom - ((score - minScore) / (maxScore - minScore)) * (chartBottom - chartTop);
  }

  function qToX(q: number, maxQ: number, chartLeft: number, chartRight: number): number {
    if (maxQ <= 1) return chartLeft;
    return chartLeft + (q / maxQ) * (chartRight - chartLeft);
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

        {/* Predicted Score Section */}
        <div className="predicted-score-section">
          {predictedScoreError && (
            <div className="predicted-score-error">
              <p>{predictedScoreError}</p>
            </div>
          )}

          {predictedScoreLoading && (
            <div className="predicted-score-loading">
              <p>Loading predicted score...</p>
            </div>
          )}

          {predictedScore && predictedScore.estimate === null && (
            <div className="predicted-score-empty">
              <p className="predicted-score-placeholder">
                Answer questions to unlock your predicted score
              </p>
            </div>
          )}

          {predictedScore && predictedScore.estimate !== null && (
            <div className="predicted-score-container">
              <p className="predicted-score-label">Predicted Study Score</p>
              <div
                className="predicted-score-value"
                style={{
                  color: getPredictedScoreColour(predictedScore.estimate),
                }}
              >
                {animatedPredictedScore}
              </div>
              {predictedScore.low !== undefined && predictedScore.high !== undefined && (
                <p className="predicted-score-range">
                  Range: {predictedScore.low}–{predictedScore.high}
                </p>
              )}
            </div>
          )}

          {/* Score History Chart */}
          {scoreHistory && scoreHistory.history && scoreHistory.history.length > 0 && (
            <div className="score-history-chart-section">
              {scoreHistory.history.length < 2 ? (
                <p className="score-history-empty">
                  Complete more questions to see your score trajectory
                </p>
              ) : (
                <svg
                  className="score-history-chart"
                  viewBox="0 0 500 180"
                  width="100%"
                >
                  {/* Chart padding constants */}
                  {/* left: 40, right: 20, top: 20, bottom: 30 */}
                  {/* Chart area: (40, 20) to (480, 150) */}

                  {/* Y-axis dashed line at y=30 (Pass) */}
                  <line
                    x1="40"
                    y1={scoreToY(30, 20, 150)}
                    x2="480"
                    y2={scoreToY(30, 20, 150)}
                    stroke="#CCCCCC"
                    strokeWidth="1"
                    strokeDasharray="4,4"
                  />
                  <text
                    x="35"
                    y={scoreToY(30, 20, 150) + 4}
                    fontSize="12"
                    textAnchor="end"
                    fill="#666666"
                  >
                    Pass
                  </text>

                  {/* Y-axis dashed line at y=40 (Strong) */}
                  <line
                    x1="40"
                    y1={scoreToY(40, 20, 150)}
                    x2="480"
                    y2={scoreToY(40, 20, 150)}
                    stroke="#CCCCCC"
                    strokeWidth="1"
                    strokeDasharray="4,4"
                  />
                  <text
                    x="35"
                    y={scoreToY(40, 20, 150) + 4}
                    fontSize="12"
                    textAnchor="end"
                    fill="#666666"
                  >
                    Strong
                  </text>

                  {/* Y-axis labels (20, 30, 40, 50) */}
                  <text x="35" y={scoreToY(20, 20, 150) + 4} fontSize="12" textAnchor="end" fill="#666666">
                    20
                  </text>
                  <text x="35" y={scoreToY(50, 20, 150) + 4} fontSize="12" textAnchor="end" fill="#666666">
                    50
                  </text>

                  {/* X-axis line */}
                  <line x1="40" y1="150" x2="480" y2="150" stroke="#333333" strokeWidth="1" />

                  {/* Polyline connecting score points */}
                  <polyline
                    points={scoreHistory.history
                      .map((entry) => {
                        const x = qToX(entry.q_number, scoreHistory.history[scoreHistory.history.length - 1].q_number, 40, 480);
                        const y = scoreToY(entry.estimate, 20, 150);
                        return `${x},${y}`;
                      })
                      .join(" ")}
                    fill="none"
                    stroke="#085041"
                    strokeWidth="2"
                  />

                  {/* Circles at each point */}
                  {scoreHistory.history.map((entry) => {
                    const x = qToX(entry.q_number, scoreHistory.history[scoreHistory.history.length - 1].q_number, 40, 480);
                    const y = scoreToY(entry.estimate, 20, 150);
                    return (
                      <circle
                        key={`circle-${entry.q_number}`}
                        cx={x}
                        cy={y}
                        r="3"
                        fill="#085041"
                      />
                    );
                  })}

                  {/* X-axis labels (first and last q_number) */}
                  {scoreHistory.history.length > 0 && (
                    <>
                      <text
                        x={qToX(scoreHistory.history[0].q_number, scoreHistory.history[scoreHistory.history.length - 1].q_number, 40, 480)}
                        y="165"
                        fontSize="12"
                        textAnchor="middle"
                        fill="#666666"
                      >
                        Q{scoreHistory.history[0].q_number}
                      </text>
                      <text
                        x={qToX(scoreHistory.history[scoreHistory.history.length - 1].q_number, scoreHistory.history[scoreHistory.history.length - 1].q_number, 40, 480)}
                        y="165"
                        fontSize="12"
                        textAnchor="middle"
                        fill="#666666"
                      >
                        Q{scoreHistory.history[scoreHistory.history.length - 1].q_number}
                      </text>
                    </>
                  )}
                </svg>
              )}
            </div>
          )}
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
