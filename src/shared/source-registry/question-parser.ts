import { ResourceRole } from "./source.types";

export interface ParsedQuestionRef {
  rawInput: string;
  normalizedInput: string;
  subject: string | "unknown";
  year: number | "unknown";
  medium: string | "unknown";
  resourceRole: ResourceRole | "unknown";
  paperPart: string | "unknown";
  questionType: "mcq" | "structured" | "essay" | "unknown";
  questionNumber: number | "unknown";
  section?: string;
  subparts: string[];
  canonicalQuestionKey: string;
  confidence: number;
  parseWarnings: string[];
}

/**
 * Parses a subject from text. Supports SFT, ET, ICT in English and Sinhala.
 */
export function parseSubject(text: string): string | "unknown" {
  const s = text.normalize("NFKC").trim().toLowerCase();
  
  if (s.includes("sft") || 
      s.includes("science for technology") || 
      s.includes("විද්‍යාව තාක්ෂණය") || 
      s.includes("විද්‍යාව තාක්‍ෂණය") ||
      s.includes("තාක්ෂණවේදය සඳහා විද්‍යාව") ||
      s.includes("තාක්‍ෂණවේදය සඳහා විද්‍යාව") ||
      s.includes("science for tech")) {
    return "SFT";
  }
  
  if (s.includes("et") || 
      s.includes("engineering technology") || 
      s.includes("ඉංජිනේරු තාක්ෂණය") || 
      s.includes("ඉංජිනේරු තාක්‍ෂණය") ||
      s.includes("ඉංජිනේරු තාක්ෂණවේදය") ||
      s.includes("ඉංජිනේරු තාක්‍ෂණවේදය") ||
      s.includes("eng tech")) {
    return "ET";
  }
  
  if (s.includes("ict") || 
      s.includes("information and communication") || 
      s.includes("තොරතුරු හා සන්නිවේදන") || 
      s.includes("තොරතුරු සන්නිවේදන") ||
      s.includes("තොරතුරු තාක්ෂණය") ||
      s.includes("තොරතුරු තාක්‍ෂණය")) {
    return "ICT";
  }
  
  return "unknown";
}

/**
 * Converts a 2-digit year to a 4-digit year using a safe range.
 * 80 - 99 -> 1980 - 1999
 * 00 - 35 -> 2000 - 2035
 */
export function convertTwoDigitYear(yr: number): number {
  if (yr >= 80 && yr <= 99) {
    return 1900 + yr;
  }
  if (yr >= 0 && yr <= 35) {
    return 2000 + yr;
  }
  return 2000 + yr;
}

/**
 * Parses a year from text. Supports 4-digit and 2-digit years with contexts.
 */
export function parseYear(text: string): number | "unknown" {
  const s = text.normalize("NFKC").trim();
  
  // 1. Find 4-digit numbers in the range 1980 - 2035
  const fourDigitMatches = s.match(/\b(19[89]\d|20[0123]\d)\b/);
  if (fourDigitMatches) {
    return parseInt(fourDigitMatches[1], 10);
  }

  // 2. Look for explicit A/L or AL year pattern, e.g. "AL 23", "A/L '23", "A/L 2023"
  const alMatches = s.match(/\b(?:al|a\/l|a\.l)\s*['’]?(\d{2,4})\b/i);
  if (alMatches) {
    const yr = parseInt(alMatches[1], 10);
    if (yr >= 1980 && yr <= 2035) return yr;
    if (yr >= 0 && yr <= 99) {
      return convertTwoDigitYear(yr);
    }
  }

  // 3. Match 2-digit year preceded by quote/apostrophe, e.g. "'23" or "’22"
  const quoteMatches = s.match(/['’](\d{2})\b/);
  if (quoteMatches) {
    return convertTwoDigitYear(parseInt(quoteMatches[1], 10));
  }

  // 4. Fallback: Check trailing 2-digit year like "SFT 23"
  const trailingMatches = s.match(/\b(?:sft|et|ict)\s+(\d{2})\b/i);
  if (trailingMatches) {
    return convertTwoDigitYear(parseInt(trailingMatches[1], 10));
  }

  return "unknown";
}

/**
 * Parses a medium from text. Supports English, Sinhala, Tamil.
 */
export function parseMedium(text: string): string | "unknown" {
  const s = text.normalize("NFKC").trim().toLowerCase();
  
  if (s.includes("sinhala") || s.includes("සිංහල") || /\bsi\b/.test(s)) {
    return "sinhala";
  }
  if (s.includes("english") || s.includes("eng") || /\ben\b/.test(s)) {
    return "english";
  }
  if (s.includes("tamil") || s.includes("දෙමළ") || /\bta\b/.test(s)) {
    return "tamil";
  }
  
  return "unknown";
}

/**
 * Parses a ResourceRole from text.
 */
export function parseResourceRole(text: string): ResourceRole | "unknown" {
  const s = text.normalize("NFKC").trim().toLowerCase();
  
  if (s.includes("marking") || s.includes("scheme") || s.includes("ms") || s.includes("පිළිතුරු") || s.includes("ලකුණු දීමේ")) {
    return "marking_scheme";
  }
  if (s.includes("past paper") || s.includes("question paper") || s.includes("qp") || s.includes("ප්‍රශ්න පත්‍රය")) {
    return "past_paper";
  }
  if (s.includes("syllabus") || s.includes("විෂය නිර්දේශය")) {
    return "syllabus";
  }
  if (s.includes("model") || s.includes("අනුමාන")) {
    return "model_paper";
  }
  
  return "unknown";
}

/**
 * Parses Paper Part from text.
 */
export function parsePaperPart(text: string): string | "unknown" {
  const s = text.normalize("NFKC").trim().toLowerCase();
  
  if (/\b(?:paper|part|කොටස|පත්‍රය)\s*(?:1|i\b|01)\b/i.test(s) || 
      /i\s*(?:කොටස|පත්‍රය)/.test(s) || 
      s.includes("පළමු කොටස") || 
      s.includes("පළමුවැනි කොටස") ||
      s.includes("පළමු පත්‍රය") ||
      s.includes("පළමුවැනි පත්‍රය")) {
    return "Paper I";
  }
  
  if (/\b(?:paper|part|කොටස|පත්‍රය)\s*(?:2|ii\b|02)\b/i.test(s) || 
      /ii\s*(?:කොටස|පත්‍රය)/.test(s) || 
      s.includes("දෙවන කොටස") || 
      s.includes("දෙවැනි කොටස") || 
      s.includes("දෙවන පත්‍රය") ||
      s.includes("දෙවැනි පත්‍රය")) {
    return "Paper II";
  }
  
  if (/\b(?:part|කොටස)\s*a\b/i.test(s) || /a\s*කොටස/.test(s)) {
    return "Part A";
  }
  if (/\b(?:part|කොටස)\s*b\b/i.test(s) || /b\s*කොටස/.test(s)) {
    return "Part B";
  }
  if (/\b(?:part|කොටස)\s*c\b/i.test(s) || /c\s*කොටස/.test(s)) {
    return "Part C";
  }
  if (/\b(?:part|කොටස)\s*d\b/i.test(s) || /d\s*කොටස/.test(s)) {
    return "Part D";
  }
  
  return "unknown";
}

/**
 * Parses a question number from text.
 */
export function parseQuestionNumber(text: string): number | "unknown" {
  const s = text.normalize("NFKC").trim().toLowerCase();
  
  // 1. Standard patterns like "Q1", "Q 1", "Question 1", "ප්‍රශ්නය 1", "ප්‍රශ්න 1", "ප්‍ර. 1"
  const qNumRegexes = [
    /\bq(?:uestion)?(?:\.|\s+)?(0?\d+)\b/i,
    /(?:ප්‍රශ්නය|ප්‍රශ්න|ප්‍ර)(?:\s*(?:අංකය?|no\.?))?(?:\.|\s+)?(0?\d+)/i,
    /\bmcq\s*(0?\d+)\b/i,
    /\b(?:structured|essay|රචනා|ව්‍යුහගත)\s*(0?\d+)\b/i,
    // Sinhala number first pattern, e.g., "05 වන ප්‍රශ්නය"
    /(0?\d+)\s*(?:වන|වැනි|වෙනි)?\s*(?:ප්‍රශ්නය|ප්‍රශ්න|ප්‍ර)/
  ];
  
  for (const regex of qNumRegexes) {
    const match = s.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > 0 && num <= 100) {
        return num;
      }
    }
  }

  // 2. Trailing question indicators like "SFT 2023 - 12", "SFT 2023 #12"
  const trailingRegexes = [
    /\b(?:no|අංක|අංකය|#)(?:\.|\s+)?(0?\d+)\b/i,
    /(?:-\s*|#\s*)(\d+)\b/
  ];
  for (const regex of trailingRegexes) {
    const match = s.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > 0 && num <= 100) {
        return num;
      }
    }
  }

  // 3. Ordinal word mapping for Sinhala & English
  if (s.includes("පළමු ප්‍රශ්නය") || s.includes("පළමුවන ප්‍රශ්නය") || s.includes("පලමුවෙනි ප්‍රශ්නය") || s.includes("first question")) {
    return 1;
  }
  if (s.includes("දෙවන ප්‍රශ්නය") || s.includes("දෙවැනි ප්‍රශ්නය") || s.includes("දෙවෙනි ප්‍රශ්නය") || s.includes("second question")) {
    return 2;
  }
  if (s.includes("තෙවන ප්‍රශ්නය") || s.includes("තෙවැනි ප්‍රශ්නය") || s.includes("තෙවෙනි ප්‍රශ්නය") || s.includes("third question")) {
    return 3;
  }
  if (s.includes("හතරවන ප්‍රශ්නය") || s.includes("හතරවැනි ප්‍රශ්නය") || s.includes("හතරවෙනි ප්‍රශ්නය") || s.includes("fourth question")) {
    return 4;
  }
  if (s.includes("පස්වන ප්‍රශ්නය") || s.includes("පස්වැනි ප්‍රශ්නය") || s.includes("පස්වෙනි ප්‍රශ්නය") || s.includes("fifth question")) {
    return 5;
  }
  if (s.includes("හයවන ප්‍රශ්නය") || s.includes("හයවැනි ප්‍රශ්නය") || s.includes("sixth question")) {
    return 6;
  }
  if (s.includes("හත්වන ප්‍රශ්නය") || s.includes("හත්වැනි ප්‍රශ්නය") || s.includes("seventh question")) {
    return 7;
  }
  if (s.includes("අටවන ප්‍රශ්නය") || s.includes("අටවැනි ප්‍රශ්නය") || s.includes("eighth question")) {
    return 8;
  }
  if (s.includes("නමවන ප්‍රශ්නය") || s.includes("නමවැනි ප්‍රශ්නය") || s.includes("ninth question")) {
    return 9;
  }
  if (s.includes("දහවන ප්‍රශ්නය") || s.includes("දහවැනි ප්‍රශ්නය") || s.includes("tenth question")) {
    return 10;
  }

  return "unknown";
}

/**
 * Parses a question type based on text, paper part, and question number.
 */
export function parseQuestionType(
  text: string, 
  paperPart?: string, 
  questionNum?: number | "unknown"
): "mcq" | "structured" | "essay" | "unknown" {
  const s = text.normalize("NFKC").trim().toLowerCase();
  
  if (s.includes("mcq") || s.includes("multiple choice") || s.includes("බහුවරණ")) {
    return "mcq";
  }
  if (s.includes("structured") || s.includes("ව්‍යුහගත")) {
    return "structured";
  }
  if (s.includes("essay") || s.includes("රචනා")) {
    if (s.includes("structured essay") || s.includes("ව්‍යුහගත රචනා")) {
      return "structured";
    }
    return "essay";
  }
  
  // Context-based inference
  if (paperPart === "Paper I") {
    return "mcq";
  }
  if (paperPart === "Part A") {
    return "structured";
  }
  if (paperPart === "Part B" || paperPart === "Part C" || paperPart === "Part D") {
    return "essay";
  }
  
  if (paperPart === "Paper II" && questionNum !== undefined && questionNum !== "unknown") {
    if (questionNum <= 4) {
      return "structured";
    } else {
      return "essay";
    }
  }
  
  return "unknown";
}

/**
 * Parses subparts of a question (e.g., "(a)(iii)" or "අ i").
 */
export function parseSubparts(text: string, questionNum: number | "unknown"): string[] {
  const subparts: string[] = [];
  const s = text.normalize("NFKC").trim();

  // 1. Parenthesized subparts like (a), (iii), (අ), (i)
  const parenthesizedPattern = /\((a|b|c|d|e|f|g|h|i|ii|iii|iv|v|vi|vii|viii|ix|x|අ|ආ|ඇ|ඈ|ඉ|ඊ|උ|ඌ)\)/gi;
  let match;
  while ((match = parenthesizedPattern.exec(s)) !== null) {
    subparts.push(match[1].toLowerCase());
  }

  if (subparts.length > 0) {
    return subparts;
  }

  // 2. Dot or space-separated subparts, e.g., "Q2.a.ii" or "Q2 a i"
  const dotSpacePattern = /\b\d+\s*[\.\-\s]\s*([a-h]|[අ-ඌ])\s*[\.\-\s]\s*(i|ii|iii|iv|v|vi|vii|viii|ix|x)\b/i;
  const dotSpaceMatch = s.match(dotSpacePattern);
  if (dotSpaceMatch) {
    return [dotSpaceMatch[1].toLowerCase(), dotSpaceMatch[2].toLowerCase()];
  }

  const singleSubpartPattern = /\b\d+\s*[\.\-\s\(\)]\s*([a-h]|[අ-ඌ])\b/i;
  const singleSubpartMatch = s.match(singleSubpartPattern);
  if (singleSubpartMatch) {
    return [singleSubpartMatch[1].toLowerCase()];
  }

  return subparts;
}

/**
 * Pure shared deterministic question reference parser.
 */
export function parseQuestionRef(rawInput: string): ParsedQuestionRef {
  const normalizedInput = rawInput.normalize("NFKC").trim();
  const parseWarnings: string[] = [];

  const subject = parseSubject(normalizedInput);
  const year = parseYear(normalizedInput);
  const medium = parseMedium(normalizedInput);
  const resourceRole = parseResourceRole(normalizedInput);
  const paperPart = parsePaperPart(normalizedInput);
  const questionNumber = parseQuestionNumber(normalizedInput);
  const questionType = parseQuestionType(normalizedInput, paperPart, questionNumber);
  const subparts = parseSubparts(normalizedInput, questionNumber);

  // Parse section if available, e.g. "Section A"
  let section: string | undefined = undefined;
  const sectionMatch = normalizedInput.match(/\b(?:section|කොටස)\s*([a-d])\b/i);
  if (sectionMatch) {
    section = sectionMatch[1].toUpperCase();
  }

  // Warnings collection
  if (subject === "unknown") {
    parseWarnings.push("Could not determine academic subject (SFT, ET, ICT).");
  }
  if (year === "unknown") {
    parseWarnings.push("Could not determine exam year.");
  }
  if (questionNumber === "unknown") {
    parseWarnings.push("Could not determine question number.");
  }

  // Create a stable canonical key if enough identity exists.
  // We require at least: subject, year, and question number to form a unique question identity.
  let canonicalQuestionKey = "";
  if (subject !== "unknown" && year !== "unknown" && questionNumber !== "unknown") {
    const pPartStr = paperPart !== "unknown" ? `:${paperPart.toLowerCase().replace(/\s+/g, "_")}` : "";
    const typeStr = questionType !== "unknown" ? `:${questionType}` : "";
    const subpartsStr = subparts.length > 0 ? `:${subparts.join("_")}` : "";
    
    canonicalQuestionKey = `v1:${subject.toLowerCase()}:${year}${pPartStr}${typeStr}:q${questionNumber}${subpartsStr}`;
  }

  // Confidence score calculation (0.0 to 1.0)
  let confidence = 0.0;
  if (subject !== "unknown") confidence += 0.25;
  if (year !== "unknown") confidence += 0.25;
  if (questionNumber !== "unknown") confidence += 0.25;
  if (paperPart !== "unknown") confidence += 0.10;
  if (questionType !== "unknown") confidence += 0.10;
  if (subparts.length > 0) confidence += 0.05;

  return {
    rawInput,
    normalizedInput,
    subject,
    year,
    medium,
    resourceRole,
    paperPart,
    questionType,
    questionNumber,
    section,
    subparts,
    canonicalQuestionKey,
    confidence: Math.min(confidence, 1.0),
    parseWarnings,
  };
}
