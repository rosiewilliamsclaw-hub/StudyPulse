// AuthContext — provides authentication state to the entire app
// Calls /api/v1/auth/me on mount to rehydrate session from HTTP-only cookie

import React, { createContext, useContext, useEffect, useState } from "react";
import { fetchMe } from "../api/auth";

interface AuthUser {
  student_id: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  setUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On mount, check if a valid session cookie exists
    fetchMe()
      .then((me) => setUser(me))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
