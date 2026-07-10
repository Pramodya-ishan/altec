import fs from 'fs';
let content = fs.readFileSync('server/ai/respondStream.ts', 'utf8');

const oldSearchBlock = `      const lowerPrompt = prompt.toLowerCase();
      if (lowerPrompt.includes("sft") || lowerPrompt.includes("science for technology") || lowerPrompt.includes("තාක්ෂණවේදය සඳහා විද්‍යාව")) subjectMatch = "sft";
      else if (lowerPrompt.includes("et") || lowerPrompt.includes("engineering technology") || lowerPrompt.includes("ඉංජිනේරු තාක්ෂණවේදය")) subjectMatch = "et";
      else if (lowerPrompt.includes("ict") || lowerPrompt.includes("information technology") || lowerPrompt.includes("තොරතුරු තාක්ෂණය")) subjectMatch = "ict";`;

const newSearchBlock = `      const lowerPrompt = prompt.toLowerCase();
      if (lowerPrompt.includes("sft") || lowerPrompt.includes("science for technology") || lowerPrompt.includes("තාක්ෂණවේදය සඳහා විද්‍යාව") || (activeSubject === "sft" && /(this subject|මේ subject|meke)/.test(lowerPrompt))) subjectMatch = "sft";
      else if (lowerPrompt.includes("et") || lowerPrompt.includes("engineering technology") || lowerPrompt.includes("ඉංජිනේරු තාක්ෂණවේදය") || (activeSubject === "et" && /(this subject|මේ subject|meke)/.test(lowerPrompt))) subjectMatch = "et";
      else if (lowerPrompt.includes("ict") || lowerPrompt.includes("information technology") || lowerPrompt.includes("තොරතුරු තාක්ෂණය") || (activeSubject === "ict" && /(this subject|මේ subject|meke)/.test(lowerPrompt))) subjectMatch = "ict";`;

content = content.replace(oldSearchBlock, newSearchBlock);
fs.writeFileSync('server/ai/respondStream.ts', content);
