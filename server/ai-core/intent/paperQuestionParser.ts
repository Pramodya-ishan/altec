/**
 * Normalizes subject names to standard SFT, ET, ICT
 */
export function normalizeSubject(input: string): "SFT" | "ET" | "ICT" | null {
  const s = String(input || "").trim().toUpperCase();
  if (!s) return null;
  
  const isSft = /\b(SFT|SCIENCE FOR TECHNOLOGY|තාක්ෂණවේදය සඳහා විද්‍යාව|තාක්ෂණවේදය සඳහා විද්යාව|තාක්ෂණවේදය|S\.F\.T)\b/i.test(s);
  const isEt = /\b(ET|ENGINEERING TECHNOLOGY|ඉංජිනේරු තාක්ෂණවේදය|ඉංජිනේරු තාක්ෂණය|E\.T)\b/i.test(s);
  const isIct = /\b(ICT|INFORMATION AND COMMUNICATION TECHNOLOGY|තොරතුරු හා සන්නිවේදන තාක්ෂණය|තොරතුරු සන්නිවේදන තාක්ෂණය|තොරතුරු හා සන්නිවේදන|I\.C\.T)\b/i.test(s);

  if (isSft) return "SFT";
  if (isEt) return "ET";
  if (isIct) return "ICT";
  
  return null;
}

export function detectOfficialPaperCandidate(prompt: string, activeSubject?: string | null) {
  const promptLower = prompt.toLowerCase();
  
  // Year Extraction
  const yearMatch = prompt.match(/\b(20\d{2})\b/);
  let year = yearMatch ? yearMatch[1] : null;

  // Question Type
  let questionType = null;
  if (promptLower.includes("mcq") || promptLower.includes("බහුවරණ")) questionType = "MCQ";
  else if (promptLower.includes("structured essay") || promptLower.includes("structured") || promptLower.includes("ව්‍යුහගත")) questionType = "Structured";
  else if (promptLower.includes("essay") || promptLower.includes("රචනා")) questionType = "Essay";

  // Question Number Extraction
  let questionNo = null;
  const mcqNoMatch = prompt.match(/\bmcq\s*[-_]?\s*(\d+)\b/i);
  const numberBeforeMcqMatch = prompt.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:වෙනි|වැනි)?\s*mcq\b/i);
  const qNoMatch = prompt.match(/(?:question|q|ප්‍රශ්න|ප්‍රශ්නය|අංක|no)\s*(\d+)/i) || 
                   prompt.match(/\b(\d+)\s*(?:වෙනි|වැනි|th|st|nd|rd)\b/i) ||
                   prompt.match(/\b(?:පළවෙනි|පළමු|දෙවෙනි|දෙවන|තුන්වෙනි|හතරවෙනි|පස්වෙනි|හයවෙනි|හත්වෙනි|අටවෙනි|නවවෙනි|දහවෙනි|first|second|third)\b/i);

  if (mcqNoMatch) {
    questionNo = mcqNoMatch[1];
  } else if (numberBeforeMcqMatch) {
    questionNo = numberBeforeMcqMatch[1];
  } else if (qNoMatch) {
    // Basic mapping for Sinhala/English word numbers
    let val = qNoMatch[1] || qNoMatch[0].toLowerCase();
    if (val.includes("පළවෙනි") || val.includes("පළමු") || val.includes("first")) questionNo = "1";
    else if (val.includes("දෙවෙනි") || val.includes("දෙවන") || val.includes("second")) questionNo = "2";
    else if (val.includes("තුන්වෙනි") || val.includes("third")) questionNo = "3";
    else if (val.includes("හතරවෙනි") || val.includes("fourth")) questionNo = "4";
    else if (val.includes("පස්වෙනි") || val.includes("fifth")) questionNo = "5";
    else if (!isNaN(parseInt(val))) questionNo = val;
    else questionNo = "1"; // fallback
  } else {
    // If structured/essay mentioned, and there's a standalone number from 1 to 10
    const allNumbers = prompt.match(/\b([1-9]|10)\b/g);
    if (allNumbers && allNumbers.length === 1 && allNumbers[0] !== year) {
        questionNo = allNumbers[0];
    }
  }

  // Answer intent
  const hasAnswerIntent = /\b(answers?|uththara|පිළිතුරු|hdn heti|explain)\b/i.test(promptLower);
  
  // Subject Extraction
  let parsedSubject = normalizeSubject(prompt);
  let subject = parsedSubject || normalizeSubject(activeSubject || "") || null;
  
  // Detection logic
  const isOfficialPaperCandidate = !!((year && (parseInt(year) >= 2015 && parseInt(year) <= 2026)) && questionNo && (questionType || hasAnswerIntent || promptLower.includes('paper')));
  const needsSubjectClarification = isOfficialPaperCandidate && !subject;

  return {
    isOfficialPaperCandidate,
    year,
    subject,
    questionNo,
    questionType: questionType || "MCQ", // default if unknown
    needsSubjectClarification
  };
}

export function parsePaperQuestionIntent(prompt: string) {
  // We keep this for backward compatibility if needed by other files
  const candidate = detectOfficialPaperCandidate(prompt);
  let confidence = 0;
  if (candidate.isOfficialPaperCandidate) confidence += 0.5;
  if (candidate.questionType) confidence += 0.3;
  if (prompt.toLowerCase().includes("paper") || prompt.toLowerCase().includes("ප්‍රශ්න පත්‍රය")) confidence += 0.2;
  
  return {
    isPaperQuestion: candidate.isOfficialPaperCandidate && !!candidate.subject,
    year: candidate.year,
    subject: candidate.subject,
    questionType: candidate.questionType,
    questionNo: candidate.questionNo,
    strictOfficialPaper: candidate.isOfficialPaperCandidate && !!candidate.subject && confidence > 0.7,
    confidence
  };
}
