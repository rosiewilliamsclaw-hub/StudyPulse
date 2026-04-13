// Atomic file store utility for student JSON files
// All writes use write-to-temp-then-rename to avoid partial writes (NFR requirement)

import fs from "fs";
import path from "path";
import { StudentFile, EmailIndex } from "../types/student";

const DATA_DIR = path.resolve(process.cwd(), "data", "students");
const EMAIL_INDEX_PATH = path.join(DATA_DIR, "_email_index.json");

/**
 * Ensures /data/students/ exists. Called once at server startup.
 */
export function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`Created data directory: ${DATA_DIR}`);
  }
  // Ensure email index exists
  if (!fs.existsSync(EMAIL_INDEX_PATH)) {
    atomicWrite(EMAIL_INDEX_PATH, {});
  }
}

/**
 * Atomically writes a JSON object to a file path.
 * Writes to a temp file first, then renames — prevents partial writes.
 */
function atomicWrite(filePath: string, data: unknown): void {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tempPath, filePath);
}

/**
 * Reads and parses the email index.
 */
function readEmailIndex(): EmailIndex {
  if (!fs.existsSync(EMAIL_INDEX_PATH)) return {};
  const raw = fs.readFileSync(EMAIL_INDEX_PATH, "utf-8");
  return JSON.parse(raw) as EmailIndex;
}

/**
 * Writes the email index atomically.
 */
function writeEmailIndex(index: EmailIndex): void {
  atomicWrite(EMAIL_INDEX_PATH, index);
}

/**
 * Looks up a student_id by email. Returns null if not found.
 */
export function findStudentIdByEmail(email: string): string | null {
  const index = readEmailIndex();
  return index[email.toLowerCase()] ?? null;
}

/**
 * Returns true if an email already exists in the index.
 */
export function emailExists(email: string): boolean {
  const index = readEmailIndex();
  return email.toLowerCase() in index;
}

/**
 * Reads a student file by student_id. Returns null if not found.
 */
export function readStudent(studentId: string): StudentFile | null {
  const filePath = path.join(DATA_DIR, `${studentId}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as StudentFile;
}

/**
 * Reads a student by email (via index lookup). Returns null if not found.
 */
export function readStudentByEmail(email: string): StudentFile | null {
  const studentId = findStudentIdByEmail(email);
  if (!studentId) return null;
  return readStudent(studentId);
}

/**
 * Writes a student file atomically and updates the email index.
 * Use for both create and update operations.
 */
export function writeStudent(student: StudentFile): void {
  const filePath = path.join(DATA_DIR, `${student.student_id}.json`);
  atomicWrite(filePath, student);

  // Update email index
  const index = readEmailIndex();
  index[student.email.toLowerCase()] = student.student_id;
  writeEmailIndex(index);
}
