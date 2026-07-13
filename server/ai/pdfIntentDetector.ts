export function detectPdfIntent(text: string): {
  isPdfIntent: boolean;
  questionNo?: string;
  questionType?: "mcq" | "structured" | "essay" | "unknown";
  subject?: "SFT" | "ET" | "ICT";
  year?: string;
  needsSourceSelection: boolean;
} {
  const normalized = text.toLowerCase();
  
  const pdfKeywords = [
    "pdf", "paper", "ප්‍රශ්නය", "prashna", "question", 
    "marking", "scheme", "answer sheet", "page", "පිටුව",
    "upload", "මේ file එක", "මේ pdf එක", "source", "q1", "q2", "mcq", "essay", "structured"
  ];

  const isPdfIntent = pdfKeywords.some(kw => normalized.includes(kw));

  let subject: "SFT" | "ET" | "ICT" | undefined = undefined;
  if (normalized.includes("sft") || normalized.includes("science for technology")) subject = "SFT";
  if (normalized.includes("et") || normalized.includes("engineering technology")) subject = "ET";
  if (normalized.includes("ict") || normalized.includes("information technology")) subject = "ICT";

  let questionType: "mcq" | "structured" | "essay" | "unknown" = "unknown";
  if (normalized.includes("mcq")) questionType = "mcq";
  else if (normalized.includes("structured")) questionType = "structured";
  else if (normalized.includes("essay")) questionType = "essay";

  const yearMatch = normalized.match(/\b(201\d|202\d)\b/);
  const year = yearMatch ? yearMatch[1] : undefined;

  const qMatch = normalized.match(/(?:q|question|ප්‍රශ්න|prashna)\s*(?:no|number|අංක)?\s*(\d+)/i);
  const questionNo = qMatch ? qMatch[1] : undefined;

  return {
    isPdfIntent,
    questionNo,
    questionType,
    subject,
    year,
    needsSourceSelection: isPdfIntent && !year && !subject // If they just say "this pdf" it needs source
  };
}
