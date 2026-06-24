export type ProfessorAdvisorReport = {
  version: "6.0";
  generatedAt: string;
  language: "si" | "mixed";
  studentSummary: {
    studentName: string;
    targetZScore: number;
    milestoneDate: string;
    examStartDate: string;
  };
  dataQuality: {
    confidence: "high" | "medium" | "low";
    measuredSources: string[];
    estimatedSources: string[];
    assumptions: string[];
    missingData: string[];
    warnings: string[];
  };
  countdown: {
    toJuly20: number;
    toExamStart: number;
    toEtPaper1: number;
    toEtPaper2: number;
    toSftPaper1: number;
    toSftPaper2: number;
    toIctPaper1: number;
    toIctPaper2: number;
  };
  zScoreChange: {
    previousOverallZ: number | null;
    currentOverallZ: number;
    delta: number | null;
    trend: "increased" | "decreased" | "stable" | "unknown";
    interpretation: string;
    subjectContributions: Array<{
      subject: string;
      delta: number;
      evidence: string[];
    }>;
    evidence: Array<{
      source: string;
      reliability: "high" | "medium" | "low";
      detail: string;
    }>;
  };
  targetFeasibility: {
    targetZ: number;
    targetDate: string;
    gap: number;
    requiredWeeklyRate: number | null;
    feasibility: "highly_realistic" | "realistic" | "possible_uncertain" | "low_confidence_stretch" | "unsupported";
    explanation: string;
  };
  subjectAnalyses: Array<{
    subject: string;
    analysis: string;
    currentZ: number;
  }>;
  incompleteLessonRanking: Array<{
    subject: string;
    lesson: string;
    expectedZImpact: number | null;
    priority: number;
    reason: string;
    estimatedHours: number | null;
  }>;
  combinedTopLessons: Array<{
    subject: string;
    lesson: string;
    expectedZImpact: number | null;
    priority: number;
    reason: string;
    estimatedHours: number | null;
  }>;
  recoveryScenarios: {
    conservative: { description: string; targetOverallZ: number; };
    realistic: { description: string; targetOverallZ: number; };
    stretch: { description: string; targetOverallZ: number; };
  };
  first72Hours: Array<{
    date: string;
    startTime: string;
    endTime: string;
    subject: string;
    task: string;
    explanation: string;
  }>;
  sevenDayPlan: Array<{
    date: string;
    startTime: string;
    endTime: string;
    subject: string;
    task: string;
    explanation: string;
  }>;
  phases: Array<{
    phase: string;
    dateRange: string;
    goals: string[];
  }>;
  classDayTemplates: {
    thursdayEt: Array<{ startTime: string; endTime: string; task: string; }>;
    fridaySft: Array<{ startTime: string; endTime: string; task: string; }>;
    normalDay: Array<{ startTime: string; endTime: string; task: string; }>;
    weekendPaperDay: Array<{ startTime: string; endTime: string; task: string; }>;
  };
  pastPaperPlan: Array<{
    year: number;
    subject: string;
    status: string;
  }>;
  examStrategies: Array<{
    subject: string;
    mcqStrategy: string;
    essayStrategy: string;
  }>;
  sleepPlan: {
    currentPattern: string;
    risks: string[];
    recommendedPattern: string;
    transitionPlan: string[];
  };
  motivationSystem: {
    startProtocol: string[];
    sleepinessProtocol: string[];
    videoControlProtocol: string[];
    dailyDisciplineRules: string[];
  };
  campusReach: Array<{
    university: string;
    degree: string;
    reachCategory: string;
    confidence: string;
  }>;
  weeklyCheckpoints: Array<{
    week: number;
    target: string;
  }>;
  immediateActions: string[];
  finalAdvice: string;
  meaningfulWordCount: number;
  suggestions?: string[];
};

export type AdvisorReport = ProfessorAdvisorReport;

export type AdvisorMessage = {
  id?: string;
  sender: "user" | "assistant";
  text: string;
  report?: AdvisorReport | null;
  isStreaming?: boolean;
  parseError?: boolean;
};

export type ProcessedAdvisorResponse = {
  cleanText: string;
  report: AdvisorReport | null;
  suggestions: string[];
  parseError: boolean;
};

export function isAdvisorReport(value: unknown): value is AdvisorReport {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return typeof data.studentSummary === "object" && typeof data.zScoreChange === "object";
}

export function looksLikeAdvisorJson(text: unknown): boolean {
  if (typeof text !== "string") return false;
  return text.includes('"studentSummary"') && text.includes('"zScoreChange"');
}

export function normalizeFormula(value: unknown): string {
  if (typeof value !== "string") return "";
  let formula = value;

  const charMap: Record<string, string> = {
    "\\theta": "θ",
    "\\Delta": "Δ",
    Delta: "Δ",
    "\\times": "×",
    "\\cdot": "·",
    "\\(": "",
    "\\)": "",
    "\\[": "",
    "\\]": "",
  };

  for (const [key, val] of Object.entries(charMap)) {
    formula = formula.split(key).join(val);
  }

  // Handle vertical split like Q \n = \n m \n c
  formula = formula.replace(/\n+/g, "");

  // Avoid duplicates like Q=mc θ Q=mc θ (basic check if string is exactly repeated)
  const halves =
    formula.length % 2 === 0
      ? [
          formula.slice(0, formula.length / 2),
          formula.slice(formula.length / 2),
        ]
      : [];
  if (halves.length === 2 && halves[0].trim() === halves[1].trim()) {
    formula = halves[0];
  }

  return formula.trim();
}

function sanitizeIncompleteJson(text: string): string {
  let temp = text.trim();

  // If it starts with studentName but no opening brace
  if (temp.startsWith('"studentName"') || temp.startsWith("'studentName'")) {
    temp = "{" + temp;
  }

  // Remove markdown fences
  if (temp.startsWith("```json")) {
    temp = temp.replace(/^```json/, "").trim();
  } else if (temp.startsWith("```")) {
    temp = temp.replace(/^```/, "").trim();
  }
  if (temp.endsWith("```")) {
    temp = temp.replace(/```$/, "").trim();
  }

  // Strip <advisor_output> and </advisor_output>
  temp = temp
    .replace(/<advisor_output>/g, "")
    .replace(/<\/advisor_output>/g, "")
    .trim();

  let cleanTemp = "";
  let inString = false;
  let escaped = false;
  let objDepth = 0;
  let arrDepth = 0;

  for (let i = 0; i < temp.length; i++) {
    const char = temp[i];

    if (char === "\\" && !escaped) {
      escaped = true;
      cleanTemp += char;
      continue;
    }

    if (char === '"' && !escaped) {
      inString = !inString;
    }

    escaped = false;

    if (inString && (char === "\n" || char === "\r")) {
      cleanTemp += char === "\n" ? "\\n" : "\\r";
    } else {
      cleanTemp += char;
    }
  }

  const bracketsToClose: string[] = [];
  inString = false;
  escaped = false;

  for (let i = 0; i < cleanTemp.length; i++) {
    const char = cleanTemp[i];

    if (char === "\\" && !escaped) {
      escaped = true;
      continue;
    }

    if (char === '"' && !escaped) {
      inString = !inString;
      continue;
    }

    escaped = false;

    if (inString) continue;

    if (char === "{" || char === "[") {
      bracketsToClose.push(char === "{" ? "}" : "]");
    } else if (char === "}" || char === "]") {
      bracketsToClose.pop();
    }
  }

  if (inString) {
    cleanTemp += '"';
  }

  while (bracketsToClose.length > 0) {
    cleanTemp += bracketsToClose.pop()!;
  }

  // Fallback to match complete JSON from text
  const matchObj = cleanTemp.match(/\{[\s\S]*\}/);
  return matchObj ? matchObj[0] : cleanTemp;
}

export function parseAdvisorReport(raw: string): AdvisorReport | null {
  try {
    return JSON.parse(raw);
  } catch (e) {
    try {
      const sanitized = sanitizeIncompleteJson(raw);
      const parsed = JSON.parse(sanitized);
      if (isAdvisorReport(parsed)) {
        return parsed;
      }
    } catch (innerError) {
      return null;
    }
  }
  return null;
}

export function processAdvisorResponse(
  rawText: string,
): ProcessedAdvisorResponse {
  let cleanText = rawText;
  let report: AdvisorReport | null = null;
  let suggestions: string[] = [];
  let parseError = false;

  // 1. Remove <thinking>
  const thinkingRegex = /<thinking>[\s\S]*?(<\/thinking>|$)/gi;
  cleanText = cleanText.replace(thinkingRegex, "").trim();
  cleanText = cleanText.replace(/\[STATUS:.*?\]/gi, "").trim();

  // 2. Extract <advisor_output> if exists
  let jsonExtracted = false;
  const advisorOutputRegex = /<advisor_output>([\s\S]*?)<\/advisor_output>/i;
  let match = cleanText.match(advisorOutputRegex);

  if (match) {
    const rawJson = match[1];
    report = parseAdvisorReport(rawJson);
    if (!report) parseError = true;
    cleanText = cleanText.replace(match[0], "").trim();
    jsonExtracted = true;
  }

  // 3. Extract JSON directly if it looks like one
  if (!jsonExtracted && looksLikeAdvisorJson(cleanText)) {
    const extractedReport = parseAdvisorReport(cleanText);
    if (extractedReport) {
      report = extractedReport;
      // remove the parsed JSON part from text roughly
      const sanitized = sanitizeIncompleteJson(cleanText);
      cleanText = cleanText.replace(sanitized, "").trim();
    } else {
      parseError = true;
    }
  }

  // 4. Extract SUGGESTIONS
  const sugRegex = /\|\|SUGGESTIONS:\s*(\[.*?\])\s*\|\|/s;
  const sugMatch = cleanText.match(sugRegex) || rawText.match(sugRegex);

  if (sugMatch) {
    try {
      suggestions = JSON.parse(sugMatch[1]);
      cleanText = cleanText.replace(sugRegex, "").trim();
    } catch (e) {
      console.warn("Error parsing suggestions", e);
    }
  }

  if (report?.suggestions && suggestions.length === 0) {
    suggestions = report.suggestions;
  }

  return { cleanText, report, suggestions, parseError };
}
