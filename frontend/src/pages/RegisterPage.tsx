// Registration page
// Collects email + password, calls POST /api/v1/auth/register
// On success, redirects to /login with a success message

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerStudent } from "../api/auth";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Client-side validation mirrors server-side checks for instant feedback
  function validate(): string | null {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) return "Email is required.";
    if (!emailRegex.test(email.trim())) return "Please enter a valid email address.";
    if (!password) return "Password is required.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    const serverError = await registerStudent(email.trim().toLowerCase(), password);
    setSubmitting(false);

    if (serverError) {
      setError(serverError);
      return;
    }

    navigate("/login", { state: { registered: true } });
  }

  return (
    <div className="page-container">
      <h1>Create your StudyPulse account</h1>

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
          <label htmlFor="password">Password <span className="hint">(minimum 8 characters)</span></label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            disabled={submitting}
            required
          />
        </div>

        <button type="submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="alt-link">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}
