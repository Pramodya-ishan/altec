import { QuestionEvidence } from "../evidence/evidenceTypes";

export function verifyFinalAnswer(params: {
  answer: string,
  evidence?: QuestionEvidence | null,
  isPaperQuestion: boolean,
  requestedYear?: string | null,
  requestedSubject?: string | null,
  canAnswer?: boolean
}) {
  const { answer, evidence, isPaperQuestion, requestedYear, requestedSubject, canAnswer } = params;

  if (isPaperQuestion) {
    if ((canAnswer as any) === false) {
      return { ok: false, reason: "No verified evidence found for official paper question." };
    }
    
    if (!evidence || (canAnswer as any) === false) {
       // fallback block if still claiming things
       const answerLower = answer.toLowerCase();
       if (
           answerLower.includes("සැබෑ ප්‍රශ්නය") ||
           answerLower.includes("සැබෑ ප්රශ්නය") ||
           answerLower.includes("නිල ලකුණු දීමේ පටිපාටිය") ||
           answerLower.includes("නිල marking scheme") ||
           answerLower.includes("මෙන්න පිළිතුර") ||
           answerLower.includes("official marking scheme") ||
           answerLower.includes("සාමාන්‍යයෙන්") ||
           answerLower.includes("සමාවෙන්න") || // Apology
           answerLower.includes("පාඩම") || // Lesson
           answerLower.includes("මීට පස්සේ වැරදි නොවෙයි") ||
           /\([a-z]\)\s*\([i|v|x]+\)/.test(answerLower) || // matches (a)(i)
           /ලකුණු\s*\d+/.test(answerLower) || // matches marks
           !evidence // if there is no evidence at all
       ) {
           return { 
               ok: false, 
               reason: "Unverified claims made without evidence contract.", 
               blockedMessage: "PDF evidence එකෙන් exact answer එක තහවුරු කරගන්න බැරි වුණා. වැරදි answer එකක් නොදී request එක නවතා තිබේ; session එක refresh කර එම question number එක නැවත යවන්න."
           };
       }
    }
    
    if (evidence) {
      if (requestedYear && evidence.year !== requestedYear) {
        return { ok: false, reason: "Evidence year mismatch during verification." };
      }
      
      // Check for hallucination markers
      const lowConfidenceMarkers = ["probably", "maybe", "likely", "බොහෝ විට", "විය හැකිය"];
      if (lowConfidenceMarkers.some(m => answer.toLowerCase().includes(m))) {
        return { ok: false, reason: "Answer contains low-confidence markers for official question." };
      }
      
      // Check if MCQ answer exists
      if (evidence.questionType === "MCQ" && !evidence.officialAnswer && !evidence.estimatedAnswer) {
        return { ok: false, reason: "No clear MCQ answer found in evidence." };
      }
    }
  }

  return { ok: true };
}
