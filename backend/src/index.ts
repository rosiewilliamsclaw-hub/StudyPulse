// StudyPulse Backend — Entry Point
// Express server with JWT cookie auth, auth routes, and onboarding route

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import { ensureDataDir } from "./utils/fileStore";
import authRouter from "./routes/auth";
import onboardingRouter from "./routes/onboarding";
import extractStudyDesignRouter from "./routes/extractStudyDesign";

// Use __dirname to anchor .env path — process.cwd() is unreliable on Render
// (resolves to repo root, not backend/ subdirectory)
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

// Validate required env vars at startup
if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET is not set in .env");
  process.exit(1);
}

// Ensure /data/students/ directory exists (creates if missing)
ensureDataDir();

const app = express();
const PORT = process.env.PORT ?? 3001;

// CORS — permissive for now (early dev/demo mode); tighten before production launch
app.use(
  cors({
    origin: true,       // allow all origins
    credentials: true,  // required for HTTP-only cookies to be sent cross-origin
  })
);

// Middleware
app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/onboarding", onboardingRouter);
app.use("/api/v1/extract-study-design", extractStudyDesignRouter);

// Health check
app.get("/api/v1/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`StudyPulse backend running on port ${PORT}`);
});

export default app;
