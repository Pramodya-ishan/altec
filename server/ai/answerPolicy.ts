export type AnswerIntent =
  | "lesson_pdf_search"
  | "lesson_question_discussion"
  | "lesson_theory_explanation"
  | "official_paper_question"
  | "past_paper_lesson_search"
  | "selected_resource_discussion"
  | "attachment_question"
  | "model_question_generation"
  | "marking_scheme_request"
  | "continue_grounded_discussion"
  | "uploaded_pdf_question"
  | "syllabus_lesson_explanation"
  | "exam_practice"
  | "study_plan"
  | "student_support"
  | "general_non_syllabus"
  | "developer_debug"
  | "blocked_or_unsafe";
export interface AnswerPolicy {
  intent: AnswerIntent;
  allowSources: boolean;
  allowedSourceTypes: string[];
  requireEvidence: boolean;
  allowVisuals: boolean;
  maxAnswerStyle: "concise" | "detailed" | "exam_style";
  shouldUseStudentContext: boolean;
  shouldUseSyllabus: boolean;
  blockingMessage?: string;
}

export function resolveAnswerPolicy(
  prompt: string,
  route: any,
  activeSubject: string,
  attachments?: any[]
): AnswerPolicy {
  const p = prompt.toLowerCase();
  
  if (p.includes("suicide") || p.includes("kill") || p.includes("hack") || p.includes("illegal")) {
     return {
       intent: "blocked_or_unsafe",
       allowSources: false,
       allowedSourceTypes: [],
       requireEvidence: false,
       allowVisuals: false,
       maxAnswerStyle: "concise",
       shouldUseStudentContext: false,
       shouldUseSyllabus: false,
       blockingMessage: "I cannot assist with that request. Please seek professional help if you are in distress."
     };
  }

  if (p.includes("debug") && p.includes("developer")) {
     return {
       intent: "developer_debug",
       allowSources: false,
       allowedSourceTypes: [],
       requireEvidence: false,
       allowVisuals: false,
       maxAnswerStyle: "detailed",
       shouldUseStudentContext: false,
       shouldUseSyllabus: false
     };
  }

  if (["lesson_pdf_search", "lesson_question_discussion", "lesson_theory_explanation", "past_paper_lesson_search"].includes(route?.mode)) {
    return {
      intent: route.mode,
      allowSources: true,
      allowedSourceTypes: route.mode === "past_paper_lesson_search"
        ? ["past_paper", "marking_scheme", "paper_structure"]
        : ["uploaded_pdf", "paper_structure", "notes", "past_paper", "marking_scheme"],
      requireEvidence: true,
      allowVisuals: true,
      maxAnswerStyle: "exam_style",
      shouldUseStudentContext: true,
      shouldUseSyllabus: false,
    };
  }

  if (["selected_resource_discussion", "continue_grounded_discussion"].includes(route?.mode)) {
    return {
      intent: "continue_grounded_discussion",
      allowSources: true,
      allowedSourceTypes: ["uploaded_pdf", "past_paper", "marking_scheme", "syllabus", "notes"],
      requireEvidence: true,
      allowVisuals: /diagram|graph|වගුව|රූප|සටහන/i.test(prompt),
      maxAnswerStyle: "exam_style",
      shouldUseStudentContext: false,
      shouldUseSyllabus: false,
    };
  }

  // 1. Official paper intent first (with Sinhala keywords)
  const isOfficialPaper = (p.includes("mcq") || p.includes("essay") || p.includes("structured") || p.includes("q") || p.includes("prashna") || p.includes("ප්‍රශ්න") || p.includes("marking scheme") || p.includes("answer") || p.includes("පිළිතුරු")) && p.match(/\b(201\d|202\d)\b/) || route?.mode === "paper_question_qa";
  if (isOfficialPaper) {
    return {
       intent: "official_paper_question",
       allowSources: true,
       allowedSourceTypes: ["past_paper", "marking_scheme"],
       requireEvidence: true,
       allowVisuals: p.includes("diagram") || p.includes("graph") || p.includes("waguwa") || p.includes("රූප"),
       maxAnswerStyle: "exam_style",
       shouldUseStudentContext: false,
       shouldUseSyllabus: false
    };
  }

  // 2. Uploaded PDF intent second
  if (route?.mode === "direct_pdf_solve" || (attachments && attachments.length > 0) || p.includes("paper eke") || p.includes("meke") || p.includes("upload") || p.includes("මෙම pdf")) {
    return {
       intent: "uploaded_pdf_question",
       allowSources: true,
       allowedSourceTypes: ["uploaded_pdf", "chat_upload"],
       requireEvidence: true,
       allowVisuals: true,
       maxAnswerStyle: "detailed",
       shouldUseStudentContext: true,
       shouldUseSyllabus: false
    };
  }

  // 3. Student Support
  if (p.includes("tired") || p.includes("focus") || p.includes("motivate") || p.includes("fear") || p.includes("kammali") || p.includes("epa wela") || p.includes("baya") || p.includes("ba wage") || p.includes("mahansi") || p.includes("padam karanna")) {
    return {
       intent: "student_support",
       allowSources: false,
       allowedSourceTypes: [],
       requireEvidence: false,
       allowVisuals: false,
       maxAnswerStyle: "concise",
       shouldUseStudentContext: true,
       shouldUseSyllabus: false
    };
  }

  if (p.includes("facebook") || p.includes("youtube") || p.includes("pc ") || p.includes("money") || p.includes("girlfriend") || p.includes("boyfriend")) {
    return {
       intent: "general_non_syllabus",
       allowSources: false,
       allowedSourceTypes: [],
       requireEvidence: false,
       allowVisuals: false,
       maxAnswerStyle: "concise",
       shouldUseStudentContext: false,
       shouldUseSyllabus: false
    };
  }

  return {
    intent: "syllabus_lesson_explanation",
    allowSources: true,
    allowedSourceTypes: ["syllabus", "textbook", "notes", "past_paper"],
    requireEvidence: false,
    allowVisuals: true,
    maxAnswerStyle: "detailed",
    shouldUseStudentContext: true,
    shouldUseSyllabus: true
  };
}
