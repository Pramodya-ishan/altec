import fs from 'fs';

let content = fs.readFileSync('src/hooks/useAIWorkflowStream.ts', 'utf8');

// Add isRecoverableError state
content = content.replace(
  /const \[error, setError\] = useState\(""\);/,
  `const [error, setError] = useState("");
  const [isRecoverableError, setIsRecoverableError] = useState(false);`
);

// Reset state
content = content.replace(
  /setAnswer\(""\);\n    setError\(""\);/,
  `setAnswer("");
    setError("");
    setIsRecoverableError(false);`
);

// Handle error event
content = content.replace(
  /if \(eventName === "error"\) setError\(data\.error \|\| "AI error"\);/,
  `if (eventName === "error") {
            setError(data.error || "AI error");
            if (data.recoverable) setIsRecoverableError(true);
          }`
);

// Export state
content = content.replace(
  /return \{ answer, status, isStreaming, totalSeconds, safeSummary, sources, error, sendAIMessage, cancel \};/,
  `return { answer, status, isStreaming, totalSeconds, safeSummary, sources, error, isRecoverableError, sendAIMessage, cancel };`
);

fs.writeFileSync('src/hooks/useAIWorkflowStream.ts', content);
