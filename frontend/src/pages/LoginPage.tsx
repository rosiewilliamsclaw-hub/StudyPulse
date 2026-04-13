// Login page
// Calls POST /api/v1/auth/login; server returns redirect path based on onboarding status

import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { loginStudent } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { fetchMe } from "../api/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Show success message if redirected here after registration
  const justRegistered = (location.state as { registered?: boolean } | null)?.registered;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    setSubmitting(true);
    try {
      const redirect = await loginStudent(email.trim().toLowerCase(), password);

      // Rehydrate auth context with the now-valid session cookie
      const me = await fetchMe();
      setUser(me);

      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-container">
      <h1>Sign in to StudyPulse</h1>

      {justRegistered && (
        <div className="success-banner" role="status">
          Account created! You can now sign in.
        </div>
      )}

      {error && (
        <div className="error-banner" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={submitting}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={submitting}
            required
          />
        </div>

        <button type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="alt-link">
        Don't have an account? <Link to="/register">Create one</Link>
      </p>
    </div>
  );
}
