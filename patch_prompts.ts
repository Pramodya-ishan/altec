import fs from 'fs';
let code = fs.readFileSync('server/ai/prompts.ts', 'utf-8');

const zScorePrompt = `
STUDENT Z-SCORE CONTEXT:
- Has Z-score data: \${contextData?.zScoreContext?.hasZScoreData ? 'Yes' : 'No'}
- Target Z-score: \${contextData?.zScoreContext?.targetZScore ?? 'Not set'}
- Latest estimated Z-score: \${contextData?.zScoreContext?.latestOverallZScore ?? 'Not set'}
- Gap to target: \${contextData?.zScoreContext?.gapToTarget ?? 'Not set'}
- SFT Z: \${contextData?.zScoreContext?.subjectZScores?.sft ?? 'Not set'}
- ET Z: \${contextData?.zScoreContext?.subjectZScores?.et ?? 'Not set'}
- ICT Z: \${contextData?.zScoreContext?.subjectZScores?.ict ?? 'Not set'}
- History count: \${contextData?.zScoreContext?.zScoreHistory?.length ?? 0}
- Latest updated: \${contextData?.zScoreContext?.latestUpdatedAt ?? 'Not set'}
- Source paths: \${contextData?.zScoreContext?.dataSources?.join(', ') ?? 'none'}
- District Rank: \${contextData?.zScoreContext?.rankEstimate?.districtRank ?? 'Not set'}
- Island Rank: \${contextData?.zScoreContext?.rankEstimate?.islandRank ?? 'Not set'}

Rules for Z-score AI logic:
- If "Has Z-score data" is Yes, you MUST answer queries like "mage zscore eka" using the values provided above.
- NEVER say "Z-score is not stored" or "I do not have your Z-score" if "Has Z-score data" is Yes.
- If a specific field is missing, say only that field is missing.
- Do not invent DR/IR/rank if not stored.
- Mention data source confidence: "Firebase progress data අනුව..."
- Sinhala-first.
`;

code = code.replace(/Current Time \(Colombo\): \${contextData\?\.currentTimeAsiaColombo \|\| ''\}/, 
`Current Time (Colombo): \${contextData?.currentTimeAsiaColombo || ''}\n\${zScorePrompt}`);

code = code.replace(/Never invent:\n- user marks\n- progress\n- Z-score/, 
`Never invent:\n- user marks\n- progress\n- Z-score (Only use Z-SCORE CONTEXT if provided)`);

fs.writeFileSync('server/ai/prompts.ts', code);
