import fs from 'fs';
let content = fs.readFileSync('src/components/views/KnowledgeBaseView.tsx', 'utf8');

// The heredoc left literal \` instead of backticks
content = content.replace(/\\`/g, '`');
// Same for \${
content = content.replace(/\\\${/g, '${');

fs.writeFileSync('src/components/views/KnowledgeBaseView.tsx', content);
