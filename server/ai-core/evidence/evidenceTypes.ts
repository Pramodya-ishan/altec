export type EvidenceSource =
  | "verified_answer"
  | "rag_chunk"
  | "pdf_question_cache"
  | "gemini_direct_pdf_qa"
  | "cloud_vision_ocr"
  | "full_paper_ocr_scan"
  | "full_paper_index_scan"
  | "gemini_targeted_legacy_page"
  | "official_marking_scheme"
  | "manual_verified";

export type QuestionEvidence = {
  sourceId: string;
  sourceTitle?: string;
  subject: "SFT" | "ET" | "ICT" | string;
  year: string;
  questionType: "MCQ" | "Structured" | "Essay" | string;
  questionNo: string;
  pageNumber?: number | null;
  questionText: string;
  options?: string[] | null;
  answer?: string | null; // Unified field for the text answer
  officialAnswer?: string | null;
  solvedAnswer?: {
    optionNo: string | null;
    optionText: string | null;
    formulaOrRule: string | null;
    explanationSinhala: string | null;
    whyOthersWrong: string[] | null;
    confidence: number;
    answerStatus: "official_marking_scheme" | "ai_solved_from_extracted_question" | "unknown";
  } | null;
  estimatedAnswer?: string | null;
  explanationSinhala?: string | null;
  extractionMethod: EvidenceSource;
  confidence: number;
  verified: boolean;
  validationStatus: "valid" | "rejected" | "needs_review";
};
