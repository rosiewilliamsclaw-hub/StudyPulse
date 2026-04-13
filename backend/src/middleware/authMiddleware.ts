// JWT authentication middleware
// Reads the JWT from the HTTP-only cookie named "token"
// Attaches decoded student payload to req.student on success

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface StudentPayload {
  student_id: string;
  email: string;
}

// Extend Express Request to carry the student payload
declare global {
  namespace Express {
    interface Request {
      student?: StudentPayload;
    }
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token: string | undefined = req.cookies?.token;

  if (!token) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET not configured");

    const decoded = jwt.verify(token, secret) as StudentPayload;
    req.student = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session. Please log in again." });
  }
}
