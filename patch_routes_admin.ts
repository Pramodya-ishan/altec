import fs from 'fs';

// 1. Fix server/knowledge/routes.ts
let routes = fs.readFileSync('server/knowledge/routes.ts', 'utf8');

const oldPastPapersLoop = `    const sources = [];

    for (const paper of pastPapersData) {
      if (paper.mcqAnswers) {
        // Group answers by 10
        const groups = Math.ceil(paper.mcqAnswers.length / 10);
        for (let i = 0; i < groups; i++) {
          const start = i * 10;
          const end = Math.min((i + 1) * 10, paper.mcqAnswers.length);
          const ansGroup = paper.mcqAnswers.slice(start, end).map((a, j) => \`Q\${start + j + 1} - \${a}\`).join(', ');
          
          const text = \`G.C.E. A/L Examination \${paper.year} - \${paper.subject.toUpperCase()} - \${paper.medium} Medium.
MCQ Answer Key Q\${start + 1}-Q\${end}:
\${ansGroup}
This is an answer-key source, not the full question paper PDF. Use this to provide correct answers for MCQs in this paper.\`;
          
          const title = \`AL \${paper.year} \${paper.subject.toUpperCase()} Answer Key Q\${start+1}-Q\${end}\`;
          const result = await processAndIngestText(text, {
            title,
            subject: paper.subject.toLowerCase() as any,
            sourceType: "past_paper",
            year: paper.year.toString(),
            medium: paper.medium,
            createdBy: user.uid,
            originalFileName: "src/data/pastPapersData.ts",
            sourceIdBase: \`pp_\${paper.id}_q\${start+1}_q\${end}\`
          });
          totalChunks += result.chunkCount;
          if (!sources.includes(result.sourceId)) sources.push(result.sourceId);
        }
      }
    }`;

const newPastPapersLoop = `    const sources: string[] = [];

    for (const paper of (pastPapersData.papers || [])) {
      if (paper.answers && paper.answers.length > 0) {
        const year = paper.metadata.exam.replace(/[^0-9]/g, '');
        const subject = paper.metadata.subjectKey || 'sft';
        
        const groups = Math.ceil(paper.answers.length / 10);
        for (let i = 0; i < groups; i++) {
          const start = i * 10;
          const end = Math.min((i + 1) * 10, paper.answers.length);
          const ansGroup = paper.answers.slice(start, end).map((a: any) => \`Q\${a.question} - \${a.answer}\`).join(', ');
          
          const text = \`\${paper.metadata.exam} - \${paper.metadata.subject} - \${paper.metadata.medium} Medium.
MCQ Answer Key Q\${start + 1}-Q\${end}:
\${ansGroup}
This is an answer-key source, not the full question paper PDF. Use this to provide correct answers for MCQs in this paper.\`;
          
          const title = \`AL \${year} \${subject.toUpperCase()} Answer Key Q\${start+1}-Q\${end}\`;
          const result = await processAndIngestText(text, {
            title,
            subject: subject.toLowerCase() as any,
            sourceType: "past_paper",
            year: year,
            medium: paper.metadata.medium,
            createdBy: user.uid,
            originalFileName: "src/data/pastPapersData.ts",
            sourceIdBase: \`pp_\${year}_\${subject}_q\${start+1}_q\${end}\`
          });
          totalChunks += result.chunkCount;
          if (!sources.includes(result.sourceId)) sources.push(result.sourceId);
        }
      }
    }`;

routes = routes.replace(oldPastPapersLoop, newPastPapersLoop);
// Fix the other `const sources = [];` lines to `const sources: string[] = [];`
routes = routes.replace(/const sources = \[\];/g, 'const sources: string[] = [];');
fs.writeFileSync('server/knowledge/routes.ts', routes);


// 2. Fix server/knowledge/store.ts
let store = fs.readFileSync('server/knowledge/store.ts', 'utf8');
store = store.replace('sourcesSnap.forEach(doc => {', 'sourcesSnap.forEach((doc: any) => {');
fs.writeFileSync('server/knowledge/store.ts', store);

// 3. Fix AdminDashboardView.tsx
let adminDash = fs.readFileSync('src/components/views/AdminDashboardView.tsx', 'utf8');
adminDash = adminDash.replace(/const \{ api \} = await import\('\.\.\/\.\.\/lib\/api'\);/g, 'const apiModule = await import(\'../../lib/api\'); const api = apiModule.default || apiModule;');
fs.writeFileSync('src/components/views/AdminDashboardView.tsx', adminDash);

