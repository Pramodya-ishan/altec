import fs from 'fs';

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/reason: \`([^`]+)\`\s*\}/g, "reason: `$1`\n      });\n");
  fs.writeFileSync(file, content);
}

fixFile('src/components/modals/AddPaperMarksModal.tsx');
fixFile('src/components/views/PaperStructureView.tsx');
