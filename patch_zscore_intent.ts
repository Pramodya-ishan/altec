import fs from 'fs';
let code = fs.readFileSync('server/ai/respondStream.ts', 'utf-8');

const zScoreFastPath = `
    const userContext = await loadUserAIContext(user.uid, user.email);

    // DETERMINISTIC Z-SCORE INTENT
    const pLower = prompt.toLowerCase();
    const isZScoreIntent = pLower.includes("mage zscore") || pLower.includes("mage z score") || 
                           pLower.includes("z score eka") || pLower.includes("zscore eka") || 
                           pLower.includes("target z") || pLower.includes("z score history") || 
                           pLower.includes("zcore history") || pLower.includes("rank estimate") ||
                           pLower.includes("sft z") || pLower.includes("et z") || pLower.includes("ict z") ||
                           pLower.includes("මගේ z score") || pLower.includes("ඉලක්ක z score");

    if (isZScoreIntent) {
       const zctx = userContext?.zScoreContext;
       if (zctx && zctx.hasZScoreData) {
          sendSSE(res, "tool", { name: "zscore_db", status: "reading" });
          let fastAns = \`Firebase data අනුව ඔයාගේ latest estimated Z-score එක: **\${zctx.latestOverallZScore ?? 'N/A'}**.\\n\`;
          fastAns += \`Target Z-score එක: **\${zctx.targetZScore ?? 'N/A'}**.\\n\`;
          if (zctx.gapToTarget) fastAns += \`Target එකට තව අවශ්‍ය gap එක: **\${zctx.gapToTarget}**.\\n\\n\`;
          
          fastAns += \`**Subject Z (Estimated):**\\n\`;
          fastAns += \`- SFT: \${zctx.subjectZScores?.sft ?? 'N/A'}\\n\`;
          fastAns += \`- ET: \${zctx.subjectZScores?.et ?? 'N/A'}\\n\`;
          fastAns += \`- ICT: \${zctx.subjectZScores?.ict ?? 'N/A'}\\n\\n\`;

          if (zctx.rankEstimate?.districtRank) {
            fastAns += \`**Rank Estimates:**\\n\`;
            fastAns += \`- District Rank: \${zctx.rankEstimate.districtRank}\\n\`;
            fastAns += \`- Island Rank: \${zctx.rankEstimate.islandRank ?? 'N/A'}\\n\\n\`;
          }
          
          fastAns += \`*History records: \${zctx.zScoreHistory?.length ?? 0}*\\n\`;
          if (zctx.latestUpdatedAt) fastAns += \`*Last updated: \${new Date(zctx.latestUpdatedAt).toLocaleString()}*\\n\\n\`;
          fastAns += \`ඊළඟට Z-score වැඩි කරන්න, ඔයාගේ weak lessons (progress එකේ තියෙන) ටික revise කරමුද?\`;

          sendSSE(res, "chunk", { text: fastAns });
          const chatRes = await saveFinalChat({ 
             uid: user.uid, email: user.email, userText: prompt, assistantText: fastAns, mode: "normal_chat", subject: activeSubject 
          });
          sendSSE(res, "done", { chatSaved: chatRes?.chatSaved === true, saveErrorCode: chatRes?.errorCode, finishReason: "complete" });
          return res.end();
       }
    }
`;

code = code.replace(/const userContext = await loadUserAIContext\(user\.uid, user\.email\);/, zScoreFastPath);

fs.writeFileSync('server/ai/respondStream.ts', code);
