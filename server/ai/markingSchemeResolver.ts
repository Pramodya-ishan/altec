import { ResolvedSource } from "./examResourceResolver";

export type MarkingSchemeResponseParams = {
  subject: string;
  year: string;
  questionNo: string;
  paperSource?: ResolvedSource;
  markingSchemeSource?: ResolvedSource;
  syllabusSource?: ResolvedSource;
  paperStructureSource?: ResolvedSource;
  questionText?: string;
  officialAnswer?: string;
  markSplit?: Array<{ part: string; marks: string }>;
  examTips?: string[];
  isEstimated: boolean;
};

export function composeMarkingSchemeAnswer(params: MarkingSchemeResponseParams): string {
  const {
    subject,
    year,
    questionNo,
    paperSource,
    markingSchemeSource,
    syllabusSource,
    paperStructureSource,
    questionText,
    officialAnswer,
    markSplit,
    examTips,
    isEstimated,
  } = params;

  let composed = `### 📝 ${year} ${subject.toUpperCase()} - ${questionNo.toUpperCase()}\n\n`;

  // Source statuses
  composed += `🔍 **Source Status:**\n`;
  composed += `- **Paper:** ${paperSource ? `Found/Imported (${paperSource.badge}) ✅` : "Missing ❌"}\n`;
  composed += `- **Marking Scheme:** ${markingSchemeSource ? `Found/Imported (${markingSchemeSource.badge}) ✅` : "Missing ❌"}\n`;
  composed += `- **Syllabus:** ${syllabusSource ? `Found (${syllabusSource.badge}) ✅` : "Fallback static structure ⚠️"}\n`;
  composed += `- **Paper Structure:** ${paperStructureSource ? `Found (${paperStructureSource.badge}) ✅` : "Fallback static structure ⚠️"}\n\n`;

  if (questionText) {
    composed += `❓ **ප්‍රශ්නය (Question):**\n> ${questionText}\n\n`;
  }

  if (isEstimated) {
    composed += `⚠️ *සටහන: නිල Marking Scheme එකක් මෙම පද්ධතියේ දැනට නොමැති නිසා, පහත දක්වා ඇත්තේ විෂය නිර්දේශයට අනුව අපේක්ෂිත ආදර්ශ පිළිතුරකි (Estimated Answer).*\n\n`;
  }

  composed += `🎯 **පිළිතුර (Answer):**\n${officialAnswer || "පිළිතුර සකසමින් පවතී..."}\n\n`;

  if (markSplit && markSplit.length > 0) {
    composed += `📊 **ලකුණු බෙදී යන ආකාරය (Mark Split):**\n`;
    markSplit.forEach(item => {
      composed += `- **${item.part}**: ${item.marks}\n`;
    });
    composed += `\n`;
  }

  if (examTips && examTips.length > 0) {
    composed += `💡 **විභාග උපදෙස් (Exam Tips):**\n`;
    examTips.forEach(tip => {
      composed += `- ${tip}\n`;
    });
    composed += `\n`;
  }

  return composed;
}
