const fs = require('fs');

const files = [
  'server/image/generate.ts',
  'server/ai/prompts.ts',
  'server/ai/respondStream.ts',
  'server/ai/memoryExtractor.ts',
  'src/hooks/useAIWorkflowStream.ts',
  'src/components/modals/NotesModal.tsx',
  'src/components/widgets/QuizGenerator.tsx',
  'src/components/views/CloraXView.tsx'
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(/\\\`/g, '\`');
    content = content.replace(/\\\$/g, '\$');
    content = content.replace(/\\\\n/g, '\\n');
    fs.writeFileSync(f, content);
  }
});
