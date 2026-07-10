import fs from 'fs';

let content = fs.readFileSync('server/knowledge/knowledgeRouter.ts', 'utf8');

// Add imports
content = content.replace(
  'import { getAIClient } from "../ai/client";',
  'import { getAIClient } from "../ai/client";\nimport { checkAiBillingCircuit } from "../ai/modelRouter";\nimport { classifyAiError } from "../ai/aiErrorClassifier";'
);

// Update routeKnowledgeRequest
const oldFunctionRegex = /export async function routeKnowledgeRequest\([\s\S]*?\}\): Promise<KnowledgeRouterResult> \{([\s\S]*?)return null;\n\}\nexport async function routeKnowledgeRequest/g;

// Instead of regex, let's just find where `const ai = getAIClient();` starts in routeKnowledgeRequest.

content = content.replace(
  'const ai = getAIClient();',
  `
  if (process.env.ENABLE_LLM_ROUTER !== "true") {
    return {
      mode: "normal_chat",
      entities: {},
      contextBlocks: [],
      answerHints: {
        mustUseGoogleSearch: false,
        mustUseUrlContext: false,
        mustUseRag: false,
        mustAskClarification: false,
      },
    };
  }

  try {
    checkAiBillingCircuit();
  } catch (err) {
    console.warn("Skipping LLM knowledge routing due to AI billing circuit open.");
    return {
      mode: "normal_chat",
      entities: {},
      contextBlocks: [],
      answerHints: {
        mustUseGoogleSearch: false,
        mustUseUrlContext: false,
        mustUseRag: false,
        mustAskClarification: false,
      },
    };
  }
  
  const ai = getAIClient();`
);

// update catch to use classifyAiError to open circuit
const catchRegex = /catch \(err\) \{\n\s*console.error\("Knowledge router error:", err\);/;
content = content.replace(
  catchRegex,
  `catch (err: any) {
    console.error("Knowledge router error:", err);
    try {
      const classification = classifyAiError(err);
      if (classification.code === "AI_BILLING_EXHAUSTED") {
         const { handleAiError } = require("../ai/modelRouter");
         handleAiError(err); // This will open the circuit
      }
    } catch (e) {}`
);

fs.writeFileSync('server/knowledge/knowledgeRouter.ts', content);
