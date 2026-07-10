import fs from 'fs';
let content = fs.readFileSync('src/hooks/useAIWorkflowStream.ts', 'utf8');

content = content.replace(
  'const [safeSummary, setSafeSummary] = useState<string[]>([]);',
  `const [safeSummary, setSafeSummary] = useState<string[]>([]);
  const [sources, setSources] = useState<any[]>([]);`
);

content = content.replace(
  'setSafeSummary([]);',
  `setSafeSummary([]);
    setSources([]);`
);

content = content.replace(
  'if (eventName === "safe_summary") setSafeSummary(data.items || []);',
  `if (eventName === "safe_summary") setSafeSummary(data.items || []);
          if (eventName === "sources") setSources(data.chunks || []);`
);

content = content.replace(
  'return { answer, status, isStreaming, totalSeconds, safeSummary, error, sendAIMessage, cancel };',
  'return { answer, status, isStreaming, totalSeconds, safeSummary, sources, error, sendAIMessage, cancel };'
);

fs.writeFileSync('src/hooks/useAIWorkflowStream.ts', content);
