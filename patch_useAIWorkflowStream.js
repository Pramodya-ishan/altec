import fs from 'fs';

let content = fs.readFileSync('src/hooks/useAIWorkflowStream.ts', 'utf8');

const regexError = /if\s*\(eventName === "error"\)\s*\{([\s\S]*?)onError\?\.([^}]*?)\}\s*if\s*\(eventName === "done"\)/;

const newErrorBlock = `if (eventName === "error") {
            const errObj = { error: data.error || data.message || "AI error", recoverable: data.recoverable, code: data.code };
            setError(errObj.error);
            if (data.recoverable) setIsRecoverableError(true);
            if (data.code === "AI_BILLING_EXHAUSTED") {
               setIsRecoverableError(false); // Do not show retry button for this
               setStatus({ stage: "error", label: "Billing/credits exhausted", message: data.message });
            }
            onError?.(errObj);
          }
          if (eventName === "done")`;

content = content.replace(regexError, newErrorBlock);

fs.writeFileSync('src/hooks/useAIWorkflowStream.ts', content);
