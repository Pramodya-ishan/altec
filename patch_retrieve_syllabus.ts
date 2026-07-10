import fs from 'fs';
let content = fs.readFileSync('server/rag/retrieve.ts', 'utf8');
content = content.replace('const syllabus = (SYLLABUS as any)[detectedSubject.toUpperCase()];', 'const syllabus = (SYLLABUS as any)[detectedSubject.toLowerCase()];');
fs.writeFileSync('server/rag/retrieve.ts', content);
