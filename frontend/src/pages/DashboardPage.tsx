// Dashboard placeholder page
// Protected route — redirects to /login if not authenticated
// Displays "Dashboard coming soon." as specified in the spec

import React from "react";
import { logoutStudent } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function DashboardPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logoutStudent();
    setUser(null);
    navigate("/login", { replace: true });
  }

  return (
    <div className="page-container">
      <p>Dashboard coming soon.</p>
      <button onClick={handleLogout} className="btn-secondary">
        Log out
      </button>
    </div>
  );
}
