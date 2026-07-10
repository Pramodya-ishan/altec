import fs from 'fs';
let p = fs.readFileSync('server/ai/respondStream.ts', 'utf8');

p = p.replace(
  /questionType: paperIntent\.questionType \|\| "MCQ",/g,
  `questionType: paperIntent.questionType || "MCQ",
              prompt: currentPrompt,`
);
fs.writeFileSync('server/ai/respondStream.ts', p);
