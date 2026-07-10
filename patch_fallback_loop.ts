import fs from 'fs';
let code = fs.readFileSync('server/ai/respondStream.ts', 'utf-8');

const fallbackBlock = `
    let stream: any = null;
    let modelUsed = "";
    
    for (const m of modelChain) {
      try {
        modelUsed = m;
        stream = await ai.models.generateContentStream({
          model: m,
          contents: finalPrompt,
          config: {
            systemInstruction: getCloraSystemPrompt(userContext, route.mode),
            temperature: getTemperature(route.mode),
            maxOutputTokens: getMaxTokens(route.mode)
          },
        });
        break; // if successful, break out of loop
      } catch (err: any) {
        const errMsg = err.message || "";
        console.warn(\`Streaming with model \${m} failed. Error:\`, errMsg);
        if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {
           sendSSE(res, "chunk", { text: "\\n\\n⚠️ *Pro model quota එක මේ වෙලාවේ ඉවරයි. Flash model එකෙන් answer එක continue කරනවා.*\\n\\n" });
        } else if (errMsg.includes("404") || errMsg.includes("NOT_FOUND")) {
           console.warn("MODEL_NOT_AVAILABLE:", m);
        }
      }
    }

    if (!stream) {
      throw new Error("All model streaming options failed.");
    }
`;

code = code.replace(/let stream: any = null;[\s\S]*?throw new Error\("All model streaming options failed\."\);\n    \}/m, fallbackBlock);

fs.writeFileSync('server/ai/respondStream.ts', code);
