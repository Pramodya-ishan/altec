import { normalizeSubject as normSub } from "../intent/paperQuestionParser";

export const normalizeSubject = normSub;

export function normalizeQuestionType(input: string): "MCQ" | "Structured" | "Essay" | null {
  const s = String(input || "").toLowerCase();
  if (s.includes("mcq") || s.includes("බහුවරණ")) return "MCQ";
  if (s.includes("structured") || s.includes("ව්‍යුහගත")) return "Structured";
  if (s.includes("essay") || s.includes("රචනා")) return "Essay";
  return null;
}
