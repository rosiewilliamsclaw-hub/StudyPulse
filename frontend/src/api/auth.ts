// Auth API client functions
// In development: VITE_API_URL is undefined → uses relative /api (proxied to backend via Vite)
// In production: VITE_API_URL is set to the Render backend URL in .env.production

const BASE = `${import.meta.env.VITE_API_URL ?? ""}/api/v1`;

export interface ApiError {
  error: string;
}

/**
 * Register a new student account.
 * Returns null on success, error message string on failure.
 */
export async function registerStudent(
  email: string,
  password: string
): Promise<string | null> {
  const res = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  if (res.ok) return null;
  const data: ApiError = await res.json();
  return data.error ?? "Registration failed.";
}

/**
 * Log in a student.
 * Returns the redirect path ("/onboarding" or "/dashboard") on success,
 * or throws an error string.
 */
export async function loginStudent(
  email: string,
  password: string
): Promise<string> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Login failed.");
  }
  return data.redirect as string;
}

/**
 * Log out the current student. Clears the JWT cookie server-side.
 */
export async function logoutStudent(): Promise<void> {
  await fetch(`${BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

/**
 * Fetch the currently authenticated student's basic info.
 * Returns null if not authenticated.
 */
export async function fetchMe(): Promise<{ student_id: string; email: string } | null> {
  const res = await fetch(`${BASE}/auth/me`, {
    credentials: "include",
  });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Submit the onboarding form.
 * Returns null on success, error message string on failure.
 */
export async function submitOnboarding(data: {
  unit: string;
  study_area_ratings: Record<string, number>;
  sac_date: string | null;
}): Promise<string | null> {
  const res = await fetch(`${BASE}/onboarding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (res.ok) return null;
  const body: ApiError = await res.json();
  return body.error ?? "Submission failed.";
}
