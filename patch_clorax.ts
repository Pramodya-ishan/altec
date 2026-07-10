import fs from 'fs';

let content = fs.readFileSync('src/components/views/CloraXView.tsx', 'utf8');

// 1. Update the hook import to include isRecoverableError
content = content.replace(
  /const \{ answer, status, isStreaming, totalSeconds, safeSummary, error, sendAIMessage, cancel \} = useAIWorkflowStream\(\);/,
  `const { answer, status, isStreaming, totalSeconds, safeSummary, error, isRecoverableError, sendAIMessage, cancel } = useAIWorkflowStream();`
);

// 2. Commit partial message even on error
content = content.replace(
  /if \(!isStreaming && status\?\.stage === 'done' && answer && currentRequestIdRef\.current\) \{/,
  `if (!isStreaming && status?.stage && answer && currentRequestIdRef.current) {`
);

// 3. Add a "Continue" button handler
content = content.replace(
  /const handleSubmit = async \(e: React\.FormEvent\) => \{/,
  `const handleContinue = () => {
    if (isStreaming) return;
    const historyPayload = messages.map(m => ({ role: m.role, content: m.content }));
    const continuePrompt = "Continue the previous answer (ඉතිරි ටික කියන්න).";
    
    // Add dummy user message to history
    setMessages(prev => [...prev, { role: 'user', content: continuePrompt, id: Date.now().toString() }]);
    
    currentRequestIdRef.current = (Date.now() + 1).toString();
    setSummaryExpanded(false);
    
    sendAIMessage({ 
      prompt: continuePrompt, 
      activeSubject: 'general', // can keep simple
      mode: 'auto',
      history: historyPayload
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {`
);

// 4. Add the Continue button above the form when error is recoverable and not streaming
content = content.replace(
  /<div className="shrink-0 relative mt-auto max-w-3xl w-full mx-auto">/,
  `{isRecoverableError && !isStreaming && (
        <div className="flex justify-center mb-4">
          <button 
            onClick={handleContinue}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded-full transition-colors text-sm shadow-sm border border-blue-200"
          >
            <i className="fa-solid fa-play"></i> Continue Answer
          </button>
        </div>
      )}
      <div className="shrink-0 relative mt-auto max-w-3xl w-full mx-auto">`
);

fs.writeFileSync('src/components/views/CloraXView.tsx', content);
