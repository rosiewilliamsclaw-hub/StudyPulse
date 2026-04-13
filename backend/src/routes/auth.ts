// Authentication routes
// POST /api/v1/auth/register
// POST /api/v1/auth/login
// POST /api/v1/auth/logout
// GET  /api/v1/auth/me  — used by frontend to rehydrate auth state

import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import {
  emailExists,
  readStudentByEmail,
  writeStudent,
} from "../utils/fileStore";
import { StudentFile } from "../types/student";
import { requireAuth, StudentPayload } from "../middleware/authMiddleware";

const router = Router();

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

// Simple email format validation
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ---------------------------------------------------------------------------
// POST /api/v1/auth/register
// ---------------------------------------------------------------------------
router.post("/register", async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  // Validate presence
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  // Validate email format
  if (!isValidEmail(email.trim())) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }

  // Validate password length
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check for duplicate email
  if (emailExists(normalizedEmail)) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const studentId = uuidv4();

    const newStudent: StudentFile = {
      student_id: studentId,
      email: normalizedEmail,
      password_hash: passwordHash,
      onboarding_complete: false,
      profile: {
        subject: "",
        unit: "",
        sac_date: null,
      },
      onboarding: {},
      confidence_map: {},
      question_history: [],
      predicted_study_score: null,
    };

    writeStudent(newStudent);

    res.status(201).json({ message: "Account created successfully." });
  } catch (err) {
    // Log full error detail so it's visible in Render logs
    console.error("[register] Unexpected error:", err);
    if (err instanceof Error) {
      console.error("[register] Stack:", err.stack);
    }
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/login
// ---------------------------------------------------------------------------
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const student = readStudentByEmail(normalizedEmail);

  // Use generic message to avoid email enumeration
  if (!student) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  try {
    const passwordMatch = await bcrypt.compare(password, student.password_hash);
    if (!passwordMatch) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET not configured");

    const payload: StudentPayload = {
      student_id: student.student_id,
      email: student.email,
    };

    const token = jwt.sign(payload, secret, { expiresIn: JWT_EXPIRY_SECONDS });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: JWT_EXPIRY_SECONDS * 1000,
    });

    // Redirect target depends on onboarding status
    res.status(200).json({
      redirect: student.onboarding_complete ? "/dashboard" : "/onboarding",
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/logout
// ---------------------------------------------------------------------------
router.post("/logout", (_req: Request, res: Response): void => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  res.status(200).json({ message: "Logged out successfully." });
});

// ---------------------------------------------------------------------------
// GET /api/v1/auth/me
// Used by the frontend AuthContext to check session validity on page load.
// Returns public student info (no password_hash).
// ---------------------------------------------------------------------------
router.get("/me", requireAuth, (req: Request, res: Response): void => {
  // req.student is set by requireAuth middleware
  const student = req.student!;
  res.status(200).json({
    student_id: student.student_id,
    email: student.email,
  });
});

export default router;
