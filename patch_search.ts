import fs from 'fs';

let content = fs.readFileSync('server/pastPapers/search.ts', 'utf8');
content = content.replace(
  /let fRef: any = db\.collection\("past_papers"\);/,
  `let fRef: any = db.collection("ragSources");`
);

content = content.replace(
  /const matchesSearch = !searchQuery \|\| \n           data\.title\.toLowerCase\(\)\.includes\(searchQuery\.toLowerCase\(\)\) \|\| \n           \(data\.year && data\.year\.toString\(\)\.includes\(searchQuery\)\);/,
  `const isPaper = data.sourceType === "past_paper" || data.sourceType === "marking_scheme";
        if (!isPaper) return;
        const matchesSearch = !searchQuery || 
           (data.title && data.title.toLowerCase().includes(searchQuery.toLowerCase())) || 
           (data.year && data.year.toString().includes(searchQuery));`
);

fs.writeFileSync('server/pastPapers/search.ts', content);
