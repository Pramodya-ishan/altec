import fs from 'fs';

let c1 = fs.readFileSync('src/components/modals/AddPaperMarksModal.tsx', 'utf8');
c1 = c1.replace('      close();\n    });\n  };', '      close();\n    }\n  };');
fs.writeFileSync('src/components/modals/AddPaperMarksModal.tsx', c1);

let c2 = fs.readFileSync('src/components/views/PaperStructureView.tsx', 'utf8');
c2 = c2.replace(' saveData(nextData);\n });', ' saveData(nextData);\n }');
fs.writeFileSync('src/components/views/PaperStructureView.tsx', c2);

