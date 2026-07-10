import fs from 'fs';

let content = fs.readFileSync('server/ai/respondStream.ts', 'utf8');

content = content.replace(/if \(paperIntent\.isOfficialPaperCandidate && route\.mode === "paper_question_qa"\) \{/, 'if (paperIntent.isOfficialPaperCandidate && route.mode === "paper_question_qa" && !hasExactQuestionText) {');

fs.writeFileSync('server/ai/respondStream.ts', content);
