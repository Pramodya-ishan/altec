export type SyllabusAnswerData = {
  subject: string;
  lesson?: string;
  syllabusSourceUsed: string;
  answerText: string;
  markingPoints: Array<{ text: string; marks: string }>;
  commonMistakes: string[];
};

export function composeSyllabusAwareAnswer(data: SyllabusAnswerData): string {
  const { subject, lesson, syllabusSourceUsed, answerText, markingPoints, commonMistakes } = data;

  let composed = "";
  
  composed += `📍 **ප්‍රශ්නයේ පාඩම (Lesson/Topic):** ${lesson || "විෂය නිර්දේශයට අදාළ මාතෘකාව"}\n`;
  composed += `📂 **Syllabus Reference:** ${syllabusSourceUsed}\n\n`;
  
  composed += `✍️ **විභාගයට ලකුණු ලැබෙන පිළිතුර (Standard Exam Answer):**\n${answerText}\n\n`;

  if (markingPoints && markingPoints.length > 0) {
    composed += `🎯 **ලකුණු ලැබෙන Points (Mark Allocation):**\n`;
    markingPoints.forEach(p => {
      composed += `- ${p.text} — **${p.marks}**\n`;
    });
    composed += `\n`;
  }

  if (commonMistakes && commonMistakes.length > 0) {
    composed += `⚠️ **නිතරම සිදුවන වැරදි (Common Mistakes):**\n`;
    commonMistakes.forEach(m => {
      composed += `- ${m}\n`;
    });
    composed += `\n`;
  }

  return composed;
}
