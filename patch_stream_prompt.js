import fs from 'fs';
let p = fs.readFileSync('src/hooks/useAIWorkflowStream.ts', 'utf8');

p = p.replace(
  /prompt: data\.question \|\| "",/g,
  `prompt: data.prompt || data.question || "",`
);
fs.writeFileSync('src/hooks/useAIWorkflowStream.ts', p);
