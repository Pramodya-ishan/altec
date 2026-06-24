import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import crypto from 'crypto';
import { readUser, writeUser } from '../data/userRepository';
import { enqueueGeminiRequest, enqueueGeminiTask, callPollinationsAI, cleanRequestLog, dequeueGeminiRequest, ai, requestCountPM, requestCountPD, RPM_LIMIT, RPD_LIMIT } from './queue';
import { verifyFirebaseToken, optionalAuth } from '../auth/verifyFirebaseToken';

export const aiRoutes = express.Router();

// Apply optionalAuth so we can identify users but maintain fallback compatibility
aiRoutes.use(optionalAuth);
import { handleAIStream } from './streamHandler';

aiRoutes.post("/ai-chat/start", (req, res) => {
  const { message } = req.body;
  const sessionId = crypto.randomUUID();
  
  const msgLower = (message || "").toLowerCase();
  const needsQuiz = /plan|timetable|schedule|priority|past.*paper|complete/i.test(msgLower);

  if (needsQuiz) {
     return res.json({
        sessionId,
        requestMode: "quiz",
        status: "ready",
        streamUrl: `/api/ai-chat/${sessionId}/stream`,
        requirementQuiz: {
           isComplete: false,
           answers: {},
           questions: [
              { id: "plan_scope", questionSi: "ඔයාට full-day plan එකක්ද, A/L exam එක පටන් ගන්න දවස දක්වා day-by-day plan එකක්ද, නැත්නම් දෙකමද ඕනේ?", questionEn: "Do you need a full-day plan, a day-by-day plan until A/L, or both?", type: "single_choice", required: true, options: [ { value: "full_day", labelSi: "Full-day plan" }, { value: "until_al", labelSi: "A/L වෙනකම් plan" }, { value: "both", labelSi: "දෙකම" } ], recommendedValue: "both", whyNeeded: "The plan structure depends on the selected time range." },
              { id: "weekday_hours", questionSi: "School සහ tuition හැර weekday එකක study කරන්න පුළුවන් පැය ගණන කීයද?", type: "number", required: true, recommendedValue: 5, whyNeeded: "This prevents an unrealistic daily workload." },
              { id: "weekend_hours", questionSi: "Weekend දවසක study කරන්න පුළුවන් පැය ගණන කීයද?", type: "number", required: true, recommendedValue: 8, whyNeeded: "Weekend capacity changes the paper and revision schedule." },
              { id: "fixed_commitments", questionSi: "School, tuition, travel, sports, cadet, prefect duties සහ වෙනත් fixed times මොනවාද?", type: "text", required: false, recommendedValue: "", whyNeeded: "Study blocks must not overlap fixed commitments." },
              { id: "sleep_schedule", questionSi: "සාමාන්යයෙන් නිදාගන්න සහ නැගිටින වේලාව මොකක්ද?", type: "text", required: true, recommendedValue: "Sleep 10:30 PM, wake 5:30 AM", whyNeeded: "The plan must protect sleep and recovery." },
              { id: "scientific_methods", questionSi: "Active Recall, Spaced Repetition, Interleaving, Blurting සහ Error Log plan එකට add කරන්නද?", type: "single_choice", required: true, options: [ { value: "all", labelSi: "Recommended methods සියල්ල add කරන්න" }, { value: "custom", labelSi: "Methods select කරන්න" }, { value: "simple", labelSi: "Simple plan එකක්" } ], recommendedValue: "all", whyNeeded: "The selected methods change the revision workflow." },
              { id: "past_papers", questionSi: "2016–2025 past papers subject තුනටම complete කරන්න ඕනේද?", type: "single_choice", required: true, options: [ { value: "all_sections", labelSi: "Subject තුනටම MCQ, Structured සහ Essay" }, { value: "mcq_first", labelSi: "MCQ first" }, { value: "custom", labelSi: "Custom selection" } ], recommendedValue: "all_sections", whyNeeded: "Past-paper volume must fit the remaining days." },
              { id: "language", questionSi: "Final response එක ඕනේ මොන language එකෙන්ද?", type: "single_choice", required: true, options: [ { value: "si", labelSi: "සිංහල" }, { value: "en", labelSi: "English" }, { value: "mixed", labelSi: "සිංහල + English" } ], recommendedValue: "mixed", whyNeeded: "This controls the final response language." }
           ]
        }
     });
  }

  res.json({
    sessionId,
    requestMode: "simple_chat",
    status: "ready",
    streamUrl: `/api/ai-chat/${sessionId}/stream`
  });
});

aiRoutes.post("/ai-chat/:sessionId/answers", (req, res) => {
  const { sessionId } = req.params;
  const { answers } = req.body;
  // in a real backend, we'd store answers to session state (in memory Map or DB)
  // for this fix we'll just acknowledge, the stream endpoint will handle the actual payload from frontend
  res.json({ success: true, sessionId });
});

aiRoutes.post("/ai-chat/:sessionId/stream", handleAIStream);

aiRoutes.post("/ai-chat/:sessionId/cancel", (req, res) => {
  res.json({ success: true });
});

aiRoutes.get("/chat/history", (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) return res.status(400).json({ error: "Email required" });
      const userObj = readUser(email);
      res.json({ history: userObj.history || [] });
    } catch (e) {
      res.status(500).json({ error: "DB Error" });
    }
  });
aiRoutes.post("/chat/history", (req, res) => {
    try {
      const { email, history } = req.body;
      if (!email || !history)
        return res.status(400).json({ error: "Missing payload" });
      const userData = readUser(email);
      userData.history = history;
      writeUser(email, userData);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "DB Error" });
    }
  });
aiRoutes.post("/chat", async (req, res) => {
    try {
      const {
        prompt,
        marksData,
        allData,
        predictorData,
        allSyllabus,
        syllabus,
        activeSubject = "sft",
        history = [],
        model = "gemini-3.5-flash",
        attachments = [],
      } = req.body;

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const parts = [];
      if (attachments.length > 0) {
        for (const file of attachments) {
          parts.push({
            inlineData: { data: file.data, mimeType: file.mimeType },
          });
        }
      }
      if (prompt && prompt.trim() !== "") {
        parts.push({ text: prompt });
      }
      if (parts.length === 0) {
        parts.push({ text: "-" });
      }

      const contents = [];
      contents.push(...history);
      contents.push({ role: "user", parts });

      const uniqueModels = Array.from(
        new Set([
          model,
          ...[
            "gemini-3.5-flash",
            "gemini-2.5-flash",
            "gemini-3.1-flash-lite",
            "gemini-2.5-flash-lite",
          ],
        ]),
      );
      const tryModels = uniqueModels;

      let formattedAllData: any = [];
      let formattedPredictorData: any = {};
      try {
        if (allData) {
          formattedAllData = Object.keys(allData)
            .filter((k) => ["sft", "et", "ict"].includes(k))
            .map((subject) => {
              const subjectData = allData[subject];

              const topicsObj = subjectData?.topics || {};
              const lessons = Object.keys(topicsObj).map((topic) => ({
                topic,
                status: topicsObj[topic].checked ? "completed" : "in-progress",
              }));
              const completedLessons = lessons.filter(
                (l) => l.status === "completed",
              );
              const inProgressLessons = lessons.filter(
                (l) => l.status === "in-progress",
              );

              return {
                subject: subject.toUpperCase(),
                completedLessons: [...completedLessons, ...inProgressLessons],
                pastPaperMarks: Array.isArray(subjectData?.paperMarks)
                  ? subjectData.paperMarks.map((p: any) => ({
                      title: p.title || p.year,
                      mcq: Number(p.mcq) || 0,
                      essay: Number(p.essay) || 0,
                      grade: p.grade || "Pending",
                    }))
                  : [],
                lessonWiseMarks: subjectData.questionMarks || {},
                lessonHistory: subjectData.lessonHistory || [],
                targetZ: allData.targetZ || 0,
                weaknesses: [],
                strengths: [],
              };
            });
        }
        if (predictorData) {
          const overallZScore = predictorData.overallZScore || 0;
          const targetZ = predictorData.targetZ || 0;

          if (activeSubject === "all") {
            formattedPredictorData = {
              readinessScores: {
                sft: predictorData.sftMark || 0,
                et: predictorData.etMark || 0,
                ict: predictorData.ictMark || 0,
              },
              lessonWiseMarks: predictorData.lessonWiseMarks || {},
              overallZScore: overallZScore,
              targetZScore: targetZ,
              zScoreEstimate: {
                range: overallZScore
                  ? `${overallZScore.toFixed(4)} - ${(overallZScore + 0.2).toFixed(4)}`
                  : "0.0000 - 0.0000",
                confidence: overallZScore ? "Moderate" : "Low (Data Needed)",
                summary: overallZScore
                  ? "Based on your past paper marks."
                  : "තවමත් ප්‍රමාණවත් ලකුණු දත්ත නොමැත.",
              },
            };
          } else {
            const avg = predictorData[`${activeSubject}Mark`] || 0;
            formattedPredictorData = {
              readinessScore: avg,
              lessonWiseMarks:
                predictorData.lessonWiseMarks?.[activeSubject] || [],
              zScoreEstimate: {
                range: overallZScore
                  ? `${overallZScore.toFixed(4)} - ${(overallZScore + 0.2).toFixed(4)}`
                  : "0.0000 - 0.0000",
                confidence: overallZScore ? "Moderate" : "Low (Data Needed)",
                summary: overallZScore
                  ? "Based on your past paper marks."
                  : "තවමත් ප්‍රමාණවත් ලකුණු දත්ත නොමැත.",
              },
            };
          }
        }
      } catch (e) {
        console.error("Error formatting data:", e);
      }

      let response: any = null;
      let lastError: any = null;

      for (const m of tryModels) {
        try {
          const supportsSearch = m.startsWith("gemini-3");
          const dynamicTools: any[] = [];

          const promptLower = (prompt || "").toLowerCase();
          const isSearchReq =
            /paper|past|syllabus|scheme|resource|pdf|link|download|search|web|පේපර්|සිලබස්|g\.c\.e|marking/i.test(
              promptLower,
            );

          const fnDeclarations = [
            {
              name: "generateImage",
              description:
                "Generates/creates a beautiful scientific, educational, or creative image from a highly detailed text prompt ONLY WHEN the user explicitly requests to create, draw, generate, or paint an image.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  prompt: {
                    type: Type.STRING,
                    description:
                      "A detailed description in English of the image to generate. Include styling, context, and subject details.",
                  },
                },
                required: ["prompt"],
              },
            },
            {
              name: "addPaperMark",
              description:
                "Adds a past paper mark to the user's data ONLY WHEN the user explicitly provides their mark.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  subject: {
                    type: Type.STRING,
                    description: "Required subject ID: sft, et, or ict",
                  },
                  title: { type: Type.STRING },
                  mcq: { type: Type.NUMBER },
                  essay: { type: Type.NUMBER },
                  grade: { type: Type.STRING },
                },
                required: ["subject", "title", "mcq", "essay", "grade"],
              },
            },
            {
              name: "addLessonMark",
              description:
                "Adds a topic-specific lesson mark to the user's data ONLY WHEN the user explicitly provides their exact mark.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  subject: {
                    type: Type.STRING,
                    description: "Required subject ID: sft, et, or ict",
                  },
                  topic: { type: Type.STRING },
                  title: { type: Type.STRING },
                  part: { type: Type.STRING, description: "MCQ, A, or BCD" },
                  mark: {
                    type: Type.NUMBER,
                    description: "The normalized mark they received",
                  },
                },
                required: ["subject", "topic", "title", "part", "mark"],
              },
            },
            {
              name: "renderCustomGraph",
              description:
                "Renders a custom graph in the chat to analyze user data. You can use 'bar', 'line', 'pie', 'radar', 'area', or 'scatter'. DO NOT invent hypothetical data. Only plot data that actually exists in allData or predictorData payload. If there is no data, do not call this tool.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  type: {
                    type: Type.STRING,
                    description:
                      "The type of graph: 'bar', 'line', 'pie', 'radar', 'area', or 'scatter'",
                  },
                  data: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        value: { type: Type.NUMBER },
                      },
                    },
                  },
                },
                required: ["title", "type", "data"],
              },
            },
            {
              name: "createStudyPlan",
              description:
                "Generates a structured study plan table for the student.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  planTitle: { type: Type.STRING },
                  days: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        day: {
                          type: Type.STRING,
                          description: "e.g., Day 1, Monday",
                        },
                        topic: { type: Type.STRING },
                        activities: { type: Type.STRING },
                      },
                    },
                  },
                },
                required: ["planTitle", "days"],
              },
            },
            {
              name: "identifyHighYieldingLessons",
              description:
                "Identifies and ranks lessons based on how easily they yield marks.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  listTitle: { type: Type.STRING },
                  lessons: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: {
                          type: Type.STRING,
                          description:
                            "Name of the lesson with an emoji (e.g. 'සංඛ්‍යානය (Statistics) 📊')",
                        },
                        marksBreakdown: {
                          type: Type.STRING,
                          description:
                            "Breakdown of marks in the paper (e.g. 'ලකුණු: Essay Q5 (ලකුණු 150) + MCQ 3ක්.')",
                        },
                        reason: {
                          type: Type.STRING,
                          description:
                            "Why it yields high marks easily / specialty (e.g. 'විශේෂත්වය: තනි පාඩමකින්...')",
                        },
                        priority: {
                          type: Type.STRING,
                          description: "High, Medium, Low",
                        },
                      },
                    },
                  },
                },
                required: ["listTitle", "lessons"],
              },
            },
          ];

          if (supportsSearch && isSearchReq) {
            dynamicTools.push({ googleSearch: {} });
            dynamicTools.push({ functionDeclarations: fnDeclarations });
          } else {
            dynamicTools.push({ functionDeclarations: fnDeclarations });
          }

          const config: any = {
            systemInstruction: `You are Clora X Infinity. An autonomous AI Learning Operating System. You are not a chatbot.

You are:
• Personal Teacher
• Study Coach
• Academic Analyst
• Learning Psychologist
• Revision Planner
• Career Advisor
• University Advisor
• Performance Predictor
• Knowledge Manager
• Progress Tracker
• Motivation Coach
• Learning Companion

PRIMARY LANGUAGE
Sinhala. Use English only for technical terms.
Use modern, elegant markdown formatting typical of Clora X updates (e.g. clean bold headers, bullet points, intuitive emojis, clear mathematical layouts if needed).
Use rich, premium emojis (🍏, 🔥, 🎯, 🏆, ✨, 🧠, 📈, etc.) naturally and frequently in your text formatting.

━━━━━━━━━━━━━━━━━━━
CORE BEHAVIOR
━━━━━━━━━━━━━━━━━━━
Do not just give the final answer. Reference the official resource book and syllabus guidelines, think really hard, analyze where the logic failed, and break down the deep reasoning step-by-step so the user can truly learn the concept. Answer in the tone and depth of a World-Famous Stanford University Professor explaining why this is a 'Game Changer'.
Always:
• Be a proactive tutor. Don't wait for prompts. Observe, Compare, Prioritize, Guide.
• Memory & Context: Reference the student's past interactions, previous goals, and ongoing struggles naturally. Use phrases like "I remember you were struggling with...", "Last time you focused on...".
• Instant Useful Insight: Within the first sentence, provide a highly valuable observation directly related to the user's data or immediate question.
• Progressive Disclosure: Show a quick, scannable summary or the most vital insight first. Then, provide the detailed breakdown or deep dive below it. Don't overwhelm upfront.
• Follow-up Suggestions: Always end your response with 1-3 natural, actionable follow-up suggestions or questions to keep the learning momentum going.
• Be dynamic: Stream your thoughts as if you are reasoning playfully (e.g., "I did notice a weaker pattern..." -> "Those topics should probably be prioritized.").
• Use internal reasoning privately. Never expose raw JSON logic.
• Never invent data.
• Explain uncertainty.
• Learn from history.
• Personalize every answer.

━━━━━━━━━━━━━━━━━━━
INTERNET SEARCH & PAST PAPERS DIRECTIVE
━━━━━━━━━━━━━━━━━━━
When the student asks for past papers, syllabuses, resource books, marking schemes, or any PDF document links (e.g., '2024 al sft paper', '2023 ict paper pdf', 'sft resource book pdf', etc.):
1. You MUST use the googleSearch tool to perform a real-time internet search for that paper, book, or document.
2. Search for high-quality, trusted educational repositories or websites in Sri Lanka (e.g., pastpapers.wiki, apepanthiya.lk, guru.lk, mathsapi.com, fat.lk, and similar sites).
3. Extract direct, clickable PDF file URLs or official download page URLs.
4. Present these document links clearly using elegant bullet points, direct markdown anchors, and clear file-type annotations (e.g. "📥 **[Download 2024 SFT Past Paper PDF](https://...)**" or "📄 **[View 2024 AL SFT Marking Scheme PDF](https://...)**").
5. Clearly specify in a small note under the links that these files were fetched via real-time Google search grounding.

━━━━━━━━━━━━━━━━━━━
MEMORY ENGINE & ADAPTIVE MEMORY
━━━━━━━━━━━━━━━━━━━
Maintain continuously: studentProfile (goals, subjects, marks, streaks, weaknesses, strengths, learningStyle, etc.)
Remember: Long term goals, weak/strong subjects, repeated mistakes, preferred explanations, career interests. Keep only meaningful trends.

━━━━━━━━━━━━━━━━━━━
DETECTORS
━━━━━━━━━━━━━━━━━━━
• Personality: Competitive Achiever, Fast Learner, Deep Thinker, Exam Sprinter, Consistent Performer, Knowledge Explorer, Perfectionist, Distracted Learner.
• Learning Style: Visual, Practical, Reading/Writing, Auditory, Mixed. Adapt teaching style accordingly.
• Knowledge Gap: Weak Lessons, Skipped Topics, Repeated Mistakes, Low Performance Areas. Generate a Recovery/Revision Plan.
• Risk: Low Consistency, Backlogs, Missed Revisions, Weak Subjects, Exam Risk (Low, Moderate, High, Critical).

━━━━━━━━━━━━━━━━━━━
ACADEMIC ANALYTICS
━━━━━━━━━━━━━━━━━━━
Analyze: Lessons, Marks, Past Papers, Revision Logs. Generate Progress Score, Readiness Score, Mastery Score, Consistency Score, Risk Score.

━━━━━━━━━━━━━━━━━━━
SMART REVISION ENGINE
━━━━━━━━━━━━━━━━━━━
Use spaced repetition. Prioritize weak areas, forgotten topics, exam topics.

━━━━━━━━━━━━━━━━━━━
XP & ACHIEVEMENTS SYSTEM
━━━━━━━━━━━━━━━━━━━
Award XP for lessons, past papers, marks, streaks tracking (Daily, Weekly, Monthly).
Award Achievements (First Lesson, 7 Day Streak, ICT/ET/SFT Master, etc.).

━━━━━━━━━━━━━━━━━━━
PREDICTION ENGINE & Z SCORE ESTIMATOR
━━━━━━━━━━━━━━━━━━━
Predict Future Marks, Exam Readiness, Completion Probability, Improvement Trends. Set confidence. 
Estimate Z Score only if enough data exists (Output Range, Confidence, Reasoning Summary). Never claim official values/rank.

━━━━━━━━━━━━━━━━━━━
CAREER & UNIVERSITY ENGINE
━━━━━━━━━━━━━━━━━━━
Recommend universities (Computer Science, Software Engineering, etc.) and careers based on Performance, Interests, Personality, Learning Style. Calculate Math Score, Growth Potential, Confidence.

━━━━━━━━━━━━━━━━━━━
KNOWLEDGE GRAPH & RAG MODE
━━━━━━━━━━━━━━━━━━━
Maintain relationships: Student -> Subjects -> Lessons -> Skills -> Careers -> Universities.
When notes/files exist, retrieve relevant info first. Prioritize User Notes, Study History, Revision History, Past Mistakes.

━━━━━━━━━━━━━━━━━━━
OUTPUT STRUCTURE & DASHBOARD ENGINE
━━━━━━━━━━━━━━━━━━━
Generate chart-ready json (Bar, Line, Radar, Pie, Forecast) when applicable. Use actual data only. Never generate fake values.
Outputs can include Dashboard, Insights, Risks, Recommendations, Streak, Achievements, XP, Study Plan, Predictions, Career Guidance.

━━━━━━━━━━━━━━━━━━━
MISSION
━━━━━━━━━━━━━━━━━━━
Become the student's lifelong AI learning operating system. Understand the student. Track growth. Predict outcomes. Improve learning. Guide decisions. Maximize academic success.

CRITICAL RULES ON DATA AUTHENTICITY:
1. NEVER create fake or hypothetical data. 
2. NEVER generate fake marks.
3. NEVER render graphs with made-up or simulated numbers. When using the \`renderCustomGraph\` tool, you MUST use ONLY the exact real data found in \`allData\` or \`predictorData\`.
4. If there is no data to plot, apologize and explain that there is no data available instead of inventing fake data.

You can:
- Provide personalized study plans based on the user's progress across all subjects. Use the createStudyPlan tool if requested.
- Explain answers to past paper questions or assess papers.
- Analyze lesson-wise marks based on 'predictorData.lessonWiseMarks'.
  * When asked for high-yielding lessons ("lakunu wadiyen hambena padam") or paper structure marks, you MUST list ALL lessons from highest total marks to lowest total marks.
  * Do NOT summarize or limit the list. Show EVERY lesson in the syllabus from highest to lowest marks.
  * Clearly separate subjects (SFT, ET, ICT). Do NOT mix lessons from different subjects together.
  * Look at 'allData' to identify which lessons are completed (\`checked: true\`) vs incomplete (\`checked: false\`).
  * NOTE on paper structure: For SFT & ICT (MCQ = 1 mark, Essay = 10 marks, Structured Essay = 7.5 marks). For ET (MCQ = 0.75 marks, Essay = 5 marks, Structured Essay = 3.75 marks). Part A is Structured Essay, Parts B/C/D are Essay questions.
- Render custom graphs (Bar, Line, Pie) to analyze user data and show learning progress using the renderCustomGraph tool.
- Add past paper marks using the addPaperMark tool, and topic marks using addLessonMark.
Always use standard text if no tool is relevant.

CRITICAL TOOL USAGE: You MUST use the proper JSON tool call functions provided to you. Do NOT hallucinate python code like print(default_api.addLessonMark(...)) in the text response! You must only emit the proper requested function call object. Focus on the user's exam score predictor and target Z score. Do not hallucinate or guess lesson marks; use 'predictorData.lessonWiseMarks' for accurate values. Provide comprehensive cross-subject answers when asked.

${activeSubject === "all" ? "The user is currently in ALL SUBJECTS mode. You must analyze and respond considering data across SFT, ET, and ICT." : `The user's active subject is currently: ${activeSubject.toUpperCase()}. Focus primarily on this subject unless asked otherwise.`}

User Exam Score Predictor & Pre-calculated Lesson Marks:
${JSON.stringify(formattedPredictorData, null, 2)}

Current User Data context (Done lessons, playlists, study logs, past papers) for All Subjects:
${JSON.stringify(formattedAllData, null, 2)}`,
            tools: dynamicTools,
          };

          if (supportsSearch && isSearchReq) {
            config.toolConfig = { includeServerSideToolInvocations: true };
          }

          response = await enqueueGeminiTask(async () => {
            return await ai.models.generateContent({
              model: m,
              contents,
              config,
            });
          });
          break;
        } catch (e: any) {
          lastError = e;
          console.warn(`Model ${m} failed: ${e.message}. Trying next...`);
          continue;
        }
      }

      if (!response) {
        console.warn(
          "All Clora X models failed. Attempting Pollinations AI free fallback...",
        );
        try {
          const sysInstruction = `You are Clora X Infinity. An autonomous AI Learning Operating System. You are not a chatbot.
PRIMARY LANGUAGE: Sinhala. Use English only for technical terms.
Do not just give the final answer. Reference the official resource book and syllabus guidelines, think really hard, analyze where the logic failed, and break down the deep reasoning step-by-step so the user can truly learn the concept. Answer in the tone and depth of a World-Famous Stanford University Professor explaining why this is a 'Game Changer'.
Please respond exactly like Clora X Infinity would, preserving all personality traits and academic advice.
Make sure to format beautifully in markdown.`;

          const messages = [
            { role: "system", content: sysInstruction },
            ...history.map((h: any) => {
              const textParts = Array.isArray(h.parts)
                ? h.parts.map((p: any) => p.text || "").join("\n")
                : typeof h.parts === "string"
                  ? h.parts
                  : "";
              return {
                role: h.role === "model" ? "assistant" : "user",
                content: textParts || "-",
              };
            }),
            { role: "user", content: prompt || "-" },
          ];

          const fallbackText = await callPollinationsAI(messages, false);

          res.json({
            text: fallbackText,
            groundingMetadata: undefined,
            isFallback: true,
          });
          return;
        } catch (fallbackErr: any) {
          console.error("Pollinations AI fallback failed:", fallbackErr);
          // Fallback also failed. Throw error.
          throw lastError || fallbackErr;
        }
      }

      if (response.functionCalls && response.functionCalls.length > 0) {
        const call = response.functionCalls[0];
        res.json({
          text: "Action executed.",
          functionCall: { name: call.name, args: call.args },
        });
        return;
      }

      res.json({
        text: response.text,
        groundingMetadata: response.candidates?.[0]?.groundingMetadata,
      });
    } catch (error: any) {
      console.error(error);
      let msg = error.message || "Failed to generate response";
      if (msg.includes("You exceeded your current quota")) {
        msg =
          "Free tier limit reached for the selected model. Please wait a minute and try again, or switch to a different model.";
      }
      res.status(500).json({ error: msg });
    }
  });
aiRoutes.post("/generate-image", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      let base64Image = "";

      // Try gemini-2.5-flash-image first
      try {
        const response = await enqueueGeminiTask(async () => {
          return await ai.models.generateContent({
            model: "gemini-2.5-flash-image",
            contents: {
              parts: [{ text: prompt }],
            },
            config: {
              imageConfig: {
                aspectRatio: "1:1",
              },
            },
          });
        });

        if (response.candidates?.[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData?.data) {
              base64Image = part.inlineData.data;
              break;
            }
          }
        }
      } catch (err) {
        console.warn(
          "gemini-2.5-flash-image failed, falling back to Pollinations AI...",
          err,
        );
      }

      // Fallback directly to Pollinations AI if gemini-2.5-flash-image didn't return an image
      if (!base64Image) {
        console.log(
          "Clora X image generation unavailable on free tier. Using Pollinations AI URL fallback...",
        );
        const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
        return res.json({ imageUrl: fallbackUrl });
      }

      res.json({ imageUrl: `data:image/png;base64,${base64Image}` });
    } catch (error: any) {
      console.error("Image generation error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to generate image" });
    }
  });
aiRoutes.post("/notebook-quiz", async (req, res) => {
    try {
      cleanRequestLog();
      
      if (requestCountPD >= RPD_LIMIT) {
        return res.status(429).json({
          error: `Daily free tier limit (${RPD_LIMIT} requests) reached.`,
        });
      }
      if (requestCountPM >= RPM_LIMIT) {
        return res.status(429).json({
          error: `Too many requests (Rate limit: ${RPM_LIMIT}/min). Please wait.`,
        });
      }

      const { subject } = req.body;
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
      const tryQuizModels = [
        "gemini-3.5-flash",
        "gemini-2.5-flash",
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash-lite",
      ];
      let lastQuizErr = null;

      for (const quizModel of tryQuizModels) {
        try {
          console.log(
            `Generating quiz via Gemini fallback for NotebookLM: ${quizModel}...`,
          );
          const response = await enqueueGeminiTask(async () => {
            return await ai.models.generateContent({
              model: quizModel,
              contents: `You are an expert tutor generating a detailed quiz.
Generate a 5-question multiple-choice quiz about the Sri Lankan G.C.E. Advanced Level Technology syllabus.
Subject: ${subject}

Ensure the questions are high-quality, relevant to the A/L syllabus standards, and written in a combination of Sinhala/English (matching the bilingual teaching style of SFT or ET in Sri Lanka).
Return the output strictly in valid JSON format as an array of 5 questions.
Each question object MUST have:
1. "id" (integer 1 to 5)
2. "question" (string containing question text and any formula)
3. "options" (array of 4 strings representing MCQ choices)
4. "correctIndex" (integer 0 to 3 representing correct option index)
5. "explanation" (string explaining key theory and why it is correct in Sinhala/English)

Do NOT write markdown wraps like \`\`\`json or trailing extra symbols. Only return a raw JSON array.`,
              config: {
                responseMimeType: "application/json",
              },
            });
          });
          const text = response.text || "";
          const quiz = JSON.parse(text.trim());
          return res.json({ quiz });
        } catch (err: any) {
          lastQuizErr = err;
          console.warn(`Quiz generation model ${quizModel} failed:`, err);
        }
      }

      throw (
        lastQuizErr || new Error("All dynamic quiz generation models failed")
      );
    } catch (error: any) {
      console.error("Quiz generation failed:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to generate dynamic quiz." });
    }
  });
aiRoutes.post("/quiz", async (req, res) => {
    const { subject, topic } = req.body;
    if (!subject || !topic) {
      return res
        .status(400)
        .json({ error: "Missing G.C.E. A/L subject or topic area" });
    }

    // Check if we have preloaded questions for this exact topic (using dynamic import for top-level peace)
    const { preloadedQuestions } =
      await import("../../src/data/questionsData").catch(() => ({
        preloadedQuestions: [],
      }));
    const preloaded = preloadedQuestions.filter(
      (q: any) => topic.includes(q.category) || q.category.includes(topic),
    );
    if (preloaded && preloaded.length > 0) {
      const shuffled = [...preloaded].sort(() => 0.5 - Math.random());
      const selectedQs = shuffled.slice(0, 5).map((q, idx) => ({
        id: idx + 1,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation || "Correct.",
      }));
      return res.json({ quiz: selectedQs });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const tryQuizModels = [
        "gemini-3.5-flash",
        "gemini-2.5-flash",
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash-lite",
      ];
      let response: any = null;
      let lastQuizErr = null;

      for (const quizModel of tryQuizModels) {
        try {
          response = await enqueueGeminiTask(async () => {
            return await ai.models.generateContent({
              model: quizModel,
              contents:
                "Generate a 5-question multiple-choice quiz about the following topic in the Sri Lankan G.C.E. Advanced Level Technology syllabus.\nSubject: " +
                subject.toUpperCase() +
                "\nTopic: " +
                topic +
                '\n\nEnsure the questions are high-quality, relevant to the A/L syllabus standards, and written in a combination of Sinhala/English (matching the bilingual teaching style of SFT or ET in Sri Lanka).\nReturn the output strictly in valid JSON format as an array of 5 questions.\nEach question object MUST have:\n1. "id" (integer 1 to 5)\n2. "question" (string containing question text and any formula)\n3. "options" (array of 4 strings representing MCQ choices)\n4. "correctIndex" (integer 0 to 3 representing correct option index)\n5. "explanation" (string explaining key theory and why it is correct in Sinhala/English)\n\nDo NOT write markdown wraps like ```json or trailing extra symbols. Only return a raw JSON array.',
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.INTEGER },
                      question: { type: Type.STRING },
                      options: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      correctIndex: { type: Type.INTEGER },
                      explanation: { type: Type.STRING },
                    },
                    required: [
                      "id",
                      "question",
                      "options",
                      "correctIndex",
                      "explanation",
                    ],
                  },
                },
              },
            });
          });
          if (response && response.text) {
            break;
          }
        } catch (err: any) {
          lastQuizErr = err;
          console.warn(`Quiz generation model ${quizModel} failed:`, err);
        }
      }

      if (!response || !response.text) {
        throw (
          lastQuizErr || new Error("All dynamic quiz generation models failed")
        );
      }

      const text = response.text || "[]";
      const quiz = JSON.parse(text.trim());
      return res.json({ topic, quiz });
    } catch (error: any) {
      console.warn(
        "Quiz generation via Clora X failed, falling back to Pollinations AI...",
        error,
      );
      try {
        const messages = [
          {
            role: "system",
            content:
              "You are an expert tutor in Sri Lankan G.C.E. Advanced Level Technology (SFT/ET/ICT). You must return output STRICTLY formatted as a JSON array of 5 questions according to the specified schema. No markdown wrappers, no backticks, just raw parseable JSON.",
          },
          {
            role: "user",
            content:
              "Generate a 5-question multiple-choice quiz about the following topic in the Sri Lankan G.C.E. Advanced Level Technology syllabus.\nSubject: " +
              subject +
              "\nTopic: " +
              topic +
              '\n\nEnsure the questions are high-quality, relevant to the A/L syllabus standards, and written in a combination of Sinhala/English (matching the bilingual teaching style of SFT or ET in Sri Lanka).\nReturn output as a valid JSON array of 5 question objects.\nEach object must contain keys:\n1. "id" (integer 1 to 5)\n2. "question" (string containing question text)\n3. "options" (array of 4 strings representing MCQ choices)\n4. "correctIndex" (integer 0 to 3 representing correct option index)\n5. "explanation" (string explaining key theory in Sinhala and English as feedback for this question)\n\nOnly output raw parseable JSON list of questions, no other text or trailing elements. Do not wrap in markdown.',
          },
        ];

        const resText = await callPollinationsAI(messages, true);
        let cleaned = resText.trim();
        if (cleaned.startsWith("```json")) {
          cleaned = cleaned.substring(7);
        } else if (cleaned.startsWith("```")) {
          cleaned = cleaned.substring(3);
        }
        if (cleaned.endsWith("```")) {
          cleaned = cleaned.substring(0, cleaned.length - 3);
        }
        const quiz = JSON.parse(cleaned.trim());
        return res.json({ topic, quiz });
      } catch (fallbackErr: any) {
        console.error("Quiz generation fallback failed:", fallbackErr);
        return res.status(500).json({
          error:
            "Failed to generate dynamic quiz due to AI resource exhaustion. Please try again in a minute.",
        });
      }
    }
  });
aiRoutes.post("/analytics-summary", async (req, res) => {
    const { subject, data } = req.body;
    if (!subject || !data) {
      return res
        .status(400)
        .json({ error: "Missing parameters subject or audit data payload" });
    }

    // 5. Remove private and irrelevant data
    const sanitizePayload = (payload: any) => {
       const copy = JSON.parse(JSON.stringify(payload));
       const removeKeys = ["password", "passwordHash", "token", "sessionId", "nic", "mobile", "phone", "email", "firebaseUid"];
       
       const deepClean = (obj: any) => {
         if (!obj || typeof obj !== "object") return;
         for (const key in obj) {
            if (removeKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
               delete obj[key];
            } else if (typeof obj[key] === "object") {
               deepClean(obj[key]);
            }
         }
       };
       deepClean(copy);
       return copy;
    };
    
    const safeData = sanitizePayload(data);

    // Dynamic dates
    const today = new Date();
    // Using current time dynamically
    // Asia/Colombo timezone
    const colomboTime = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Colombo" }).format(today);
    
    const getDays = (dateStr: string) => Math.max(0, Math.ceil((new Date(dateStr).getTime() - today.getTime()) / (1000 * 3600 * 24)));
    
    const toJuly20 = getDays("2026-07-20");
    const toExamStart = getDays("2026-08-10");
    const toEtPaper1 = getDays("2026-08-12");
    const toEtPaper2 = getDays("2026-08-14");
    const toSftPaper1 = getDays("2026-08-19");
    const toSftPaper2 = getDays("2026-08-21");
    const toIctPaper1 = getDays("2026-08-27");
    const toIctPaper2 = getDays("2026-08-29");

    // Engineering Technology Stream University Z-Score Cut-offs
    const uniZScores = `
1. ප්‍රධාන ඉංජිනේරු තාක්ෂණවේදී (BET Hons) උපාධි සහ විශ්වවිද්‍යාල:
ශ්‍රී ජයවර්ධනපුර විශ්වවිද්‍යාලය: 1.60 - 1.75
කැලණිය විශ්වවිද්‍යාලය: 1.55 - 1.65
කොළඹ විශ්වවිද්‍යාලය (Instrumentation and Automation): 1.40 - 1.55
රුහුණ විශ්වවිද්‍යාලය: 1.35 - 1.45
වයඹ විශ්වවිද්‍යාලය: 1.25 - 1.35
සබරගමුව විශ්වවිද්‍යාලය: 1.20 - 1.30
රජරට විශ්වවිද්‍යාලය: 1.15 - 1.25
ඌව වෙල්ලස්ස විශ්වවිද්‍යාලය (Mechanical Engineering Technology): 1.10 - 1.20
යාපනය විශ්වවිද්‍යාලය: 0.85 - 1.05

2. වෙනත් ක්ෂේත්‍රවල උපාධි පාඨමාලා:
තොරතුරු තාක්ෂණය:
Information Technology (IT - මොරටුව): 1.55 - 1.75
Information Systems (කොළඹ UCSC සහ ජපුර): 1.45 - 1.65
Information Communication Technology (BICT Hons): 1.15 - 1.35 (විශ්වවිද්‍යාලය අනුව වෙනස් වේ)

කළමනාකරණය හා ව්‍යාපාර:
Food Business Management: 1.15 - 1.30
Human Resource Development: 1.05 - 1.20
Management Studies (TV): 1.00 - 1.20
Project Management: 0.95 - 1.10

නිර්මාණකරණය (මේවාට Z-Score එකට අමතරව අනිවාර්ය යෝග්‍යතා පරීක්ෂණයක් - Aptitude Test එකක් ඇත):
Design (මොරටුව): 1.05 - 1.25
Fashion Design & Product Development (මොරටුව): 1.00 - 1.20

සෞඛ්‍ය හා වෙනත්:
Biomedical Technology: 1.00 - 1.20
Health Information and Communication Technology: 0.90 - 1.15
Sports Sciences & Management (Aptitude Test අනිවාර්යයි): 0.85 - 1.10
Primary Education: 0.85 - 1.00
`;

    const answers = data?.answers || null;
    let answersPrompt = "";
    if (answers) {
      answersPrompt = `
### USER CUSTOMIZED PLANNING ANSWERS (REQUIRED INPUTS):
The student completed an interactive session and provided these specific constraints/preferences:
1. Plan Scope: ${answers.plan_scope || "not specified"}
2. Weekday Study Hours Available: ${answers.weekday_hours || "not specified"} hours
3. Weekend Study Hours Available: ${answers.weekend_hours || "not specified"} hours
4. Fixed Commitments: ${answers.fixed_commitments || "none or not specified"}
5. Sleep Schedule: ${answers.sleep_schedule || "not specified"}
6. Scientific Revision Techniques (e.g., Active Recall, Spaced Repetition): ${answers.scientific_methods || "all recommended"}
7. Past Papers Target Range (2016-2025): ${answers.past_papers || "all sections"}
8. Preferred Final Plan Language: ${answers.language || "mixed (sinhala/english)"}

You MUST tailor your advice, time schedules, daily goals, revision techniques, and past papers plan strictly to these parameters:
- Ensure the sleep schedule is fully respected and protected.
- Do not demand more hours than they can offer (weekday: ${answers.weekday_hours || 5}h, weekend: ${answers.weekend_hours || 8}h).
- Use their preferred final plan language.
`;
    }

    const promptText = `Analyze the student's progress, trends, and recent marks in Sri Lankan G.C.E. Advanced Level for the subject: ${subject.toUpperCase()}.
Here is their logged student metrics, checklist performance, and live z-score history with reasons:
${JSON.stringify(safeData, null, 2)}

${answersPrompt}

Current Colombo Time: ${colomboTime}
Days to July 20 milestone: ${toJuly20}
Days to ET exams: ${toEtPaper1} and ${toEtPaper2}
Days to SFT exams: ${toSftPaper1} and ${toSftPaper2}
Days to ICT exams: ${toIctPaper1} and ${toIctPaper2}

Here are the Sri Lankan University Z-Score Target cut-offs for Engineering Technology stream degrees:
${uniZScores}

You are Clora AI, an elite academic professor and critical-thinking examination strategist. You analyse the student’s evidence before giving advice. You distinguish measured performance, app estimates, assumptions and missing data. You explain why a change occurred, how much it changed, what the consequence is, and what action has the highest expected academic return. You never flatter the student with unsupported claims. You never frighten the student unnecessarily. You provide direct, realistic, detailed and executable guidance.

Provide your final output STRICTLY as valid JSON. Do not write any prose outside the JSON. Use Sinhala language with clear English technical terms where useful. Provide at least 1000 meaningful words within the JSON string fields!

The JSON schema MUST exactly match:
{
  "version": "6.0",
  "generatedAt": "${colomboTime}",
  "language": "mixed",
  "studentSummary": {
    "studentName": "Pramodya Ishan",
    "targetZScore": 2.5000,
    "milestoneDate": "2026-07-20",
    "examStartDate": "2026-08-10"
  },
  "dataQuality": {
    "confidence": "high|medium|low",
    "measuredSources": [""],
    "estimatedSources": [""],
    "assumptions": [""],
    "missingData": [""],
    "warnings": [""]
  },
  "countdown": {
    "toJuly20": ${toJuly20},
    "toExamStart": ${toExamStart},
    "toEtPaper1": ${toEtPaper1},
    "toEtPaper2": ${toEtPaper2},
    "toSftPaper1": ${toSftPaper1},
    "toSftPaper2": ${toSftPaper2},
    "toIctPaper1": ${toIctPaper1},
    "toIctPaper2": ${toIctPaper2}
  },
  "zScoreChange": {
    "previousOverallZ": 1.5,
    "currentOverallZ": 2.1,
    "delta": 0.6,
    "trend": "increased|decreased|stable|unknown",
    "interpretation": "Detailed Sinhala explanation of the Z-Score drop or rise over 100 words",
    "subjectContributions": [{"subject": "SFT", "delta": 0.2, "evidence": [""]}],
    "evidence": [{"source": "Paper 1", "reliability": "high", "detail": ""}]
  },
  "targetFeasibility": {
    "targetZ": 2.5,
    "targetDate": "2026-07-20",
    "gap": 0.4,
    "requiredWeeklyRate": 0.05,
    "feasibility": "highly_realistic|realistic|possible_uncertain|low_confidence_stretch|unsupported",
    "explanation": "Deep analysis of why 2.5 is possible or impossible by July 20. Include math."
  },
  "subjectAnalyses": [{"subject": "SFT", "analysis": "...", "currentZ": 1.2}],
  "incompleteLessonRanking": [{"subject": "SFT", "lesson": "Heat", "expectedZImpact": 0.15, "priority": 1, "reason": "...", "estimatedHours": 10}],
  "combinedTopLessons": [{"subject": "SFT", "lesson": "Heat", "expectedZImpact": 0.15, "priority": 1, "reason": "...", "estimatedHours": 10}],
  "recoveryScenarios": {
    "conservative": {"description": "...", "targetOverallZ": 2.0},
    "realistic": {"description": "...", "targetOverallZ": 2.3},
    "stretch": {"description": "...", "targetOverallZ": 2.5}
  },
  "first72Hours": [{"date": "1", "startTime": "08:00", "endTime": "10:00", "subject": "SFT", "task": "...", "explanation": "..."}],
  "sevenDayPlan": [{"date": "1", "startTime": "08:00", "endTime": "10:00", "subject": "SFT", "task": "...", "explanation": "..."}],
  "phases": [{"phase": "1", "dateRange": "Jul 1 - Jul 20", "goals": [""]}],
  "classDayTemplates": {
    "thursdayEt": [{"startTime": "08:00", "endTime": "16:00", "task": "ET Class"}],
    "fridaySft": [{"startTime": "08:00", "endTime": "16:00", "task": "SFT Class"}],
    "normalDay": [{"startTime": "00:00", "endTime": "00:00", "task": ""}],
    "weekendPaperDay": [{"startTime": "00:00", "endTime": "00:00", "task": ""}]
  },
  "pastPaperPlan": [{"year": 2020, "subject": "SFT", "status": "pending"}],
  "examStrategies": [{"subject": "SFT", "mcqStrategy": "...", "essayStrategy": "..."}],
  "sleepPlan": {
    "currentPattern": "5 hours",
    "risks": ["Memory loss", "Attention drop"],
    "recommendedPattern": "7 hours",
    "transitionPlan": ["Go to bed 30m earlier"]
  },
  "motivationSystem": {
    "startProtocol": ["5-min rule"],
    "sleepinessProtocol": ["Drink water"],
    "videoControlProtocol": ["No autoplay"],
    "dailyDisciplineRules": ["..."]
  },
  "campusReach": [{"university": "Moratuwa", "degree": "IT", "reachCategory": "Stretch", "confidence": "low"}],
  "weeklyCheckpoints": [{"week": 1, "target": "..."}],
  "immediateActions": ["Do X", "Do Y", "Do Z"],
  "finalAdvice": "A long profound Sinhala academic advice.",
  "meaningfulWordCount": 1500,
  "suggestions": ["SFT Heat ගණිත ගැටලු විසඳන්න උදව් ඕනේ", "ICT Python වලදී වැරදෙන තැන් හදාගන්න උදව් ඕනේ", "ET විෂයයේදී රූප සටහන් අඳින විදිය ගැන කියන්න"]
}`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
      res.write("event: status\n");
      res.write('data: {"phase":"analysing","message":"[STATUS: INGESTING_PAYLOAD] Reading the student database JSON object..."}\n\n');
      
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });

      const tryModels = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
      let responseText = "";
      let lastError = null;
      let generatedJson = null;

      res.write("event: status\n");
      res.write('data: {"phase":"generating","message":"[STATUS: DECODING_INTENT] Compiling profound academic insights..."}\n\n');

      for (const m of tryModels) {
        try {
          const resp = await enqueueGeminiTask(async () => {
             return await ai.models.generateContent({
               model: m,
               contents: promptText,
               config: { temperature: 0.7, responseMimeType: "application/json" },
             });
          });
          responseText = resp.text || "";
          try {
             generatedJson = JSON.parse(responseText.trim());
          } catch(e) {
             // maybe some markdown fences
             let cleaned = responseText.trim();
             if (cleaned.startsWith("```json")) cleaned = cleaned.substring(7);
             else if (cleaned.startsWith("```")) cleaned = cleaned.substring(3);
             if (cleaned.endsWith("```")) cleaned = cleaned.substring(0, cleaned.length - 3);
             generatedJson = JSON.parse(cleaned.trim());
          }
          break; // if successful, we have our json
        } catch (e: any) {
          lastError = e;
          console.warn(`Analytics summary generation failed on model ${m}, trying next:`, e.status || e.message);
        }
      }

      if (!generatedJson) {
        throw lastError || new Error("Failed to generate JSON");
      }

      res.write("event: report\n");
      res.write(`data: ${JSON.stringify({ report: generatedJson })}\n\n`);
      
      if (generatedJson.suggestions) {
         res.write("event: suggestions\n");
         res.write(`data: ${JSON.stringify({ suggestions: generatedJson.suggestions })}\n\n`);
      }

      res.write("event: done\ndata: {\"success\":true}\n\n");
      res.end();
    } catch (error: any) {
      console.error("AI diagnostics summary via stream failed", error);
      res.write("event: error\n");
      res.write(`data: ${JSON.stringify({ error: "Failed to connect to AI. Please try again." })}\n\n`);
      res.end();
    }
  });
aiRoutes.post("/lesson-optimizer", async (req, res) => {
    const { data, syllabus, history = [], prompt } = req.body;
    if (!data || !syllabus) {
      return res.status(400).json({ error: "Missing data payload" });
    }

    let historyPrompt = "";
    if (history && history.length > 0) {
      historyPrompt = `
Here is the previous conversation history of this advisory session:
${history.map((m: any) => `${m.sender === "user" || m.role === "user" ? "USER" : "AI"}: ${m.text || m.content}`).join("\n")}

The user is now asking/replying: "${prompt || ""}"
`;
    } else {
      historyPrompt = `This is the first message. Analyze progress and generate the primary personalized maximum yield lesson strategy plan.`;
    }

const uniZScores = `
1. ප්‍රධාන ඉංජිනේරු තාක්ෂණවේදී (BET Hons) උපාධි සහ විශ්වවිද්‍යාල:
ශ්‍රී ජයවර්ධනපුර විශ්වවිද්‍යාලය: 1.60 - 1.75
කැලණිය විශ්වවිද්‍යාලය: 1.55 - 1.65
කොළඹ විශ්වවිද්‍යාලය (Instrumentation and Automation): 1.40 - 1.55
රුහුණ විශ්වවිද්‍යාලය: 1.35 - 1.45
වයඹ විශ්වවිද්‍යාලය: 1.25 - 1.35
සබරගමුව විශ්වවිද්‍යාලය: 1.20 - 1.30
රජරට විශ්වවිද්‍යාලය: 1.15 - 1.25
ඌව වෙල්ලස්ස විශ්වවිද්‍යාලය (Mechanical Engineering Technology): 1.10 - 1.20
යාපනය විශ්වවිද්‍යාලය: 0.85 - 1.05

2. වෙනත් ක්ෂේත්‍රවල උපාධි පාඨමාලා:
තොරතුරු තාක්ෂණය:
Information Technology (IT - මොරටුව): 1.55 - 1.75
Information Systems (කොළඹ UCSC සහ ජපුර): 1.45 - 1.65
Information Communication Technology (BICT Hons): 1.15 - 1.35 (විශ්වවිද්‍යාලය අනුව වෙනස් වේ)
`;

    const promptText = `Analyze the student's lesson completion data across all subjects (SFT, ET, ICT).
Here is their logged student metrics and checklist performance:
${JSON.stringify(data, null, 2)}

Here is the syllabus containing the maximum "mcqMax" counts possible for each lesson:
${JSON.stringify(syllabus, null, 2)}

Here are standard University Z-score targets for Engineering Technology:
${uniZScores}

You are 1st Edition, an autonomous AI Learning Operating System. You are an elite strategic advisor.
DO NOT use informal Sinhala terms like "අයියා", "අක්කා", "මල්ලි", or "නංගි". Maintain a rigorous, critical-thinking, and motivational academic tone.

${historyPrompt}

Structure for first message strategy generation (if history is empty):
1. Give a full, detailed 12-point strategic breakdown.
2. Note exam dates strictly: ET (Aug 11), SFT (Aug 18), ICT (Aug 25).
3. Enforce a minimum 12-hour daily study plan ("hard work plan").
4. Outline the top 8 main lessons for all 3 subjects that the student must prioritize.
5. Provide a deep dive into Undone Lessons and Past Papers Methodologies across all subjects.
6. Give a realistic Z-score analysis: how to increase it, why it could decrease, current status, and possible degree paths.

Provide response in gorgeous Raw Markdown. Write predominantly in Sinhala, but be highly professional.
CRUCIAL: To make this advice highly interactive, formulate exactly 3 custom, highly relevant helpful Sinhala reply suggestions that the user can click next in their interface. You MUST place these suggestions at the absolute end of your response, formatted EXACTLY inside double pipes and preceded by SUGGESTIONS:, like this:
||SUGGESTIONS: ["ඊළඟට මා කළ යුත්තේ කුමක්ද?", "SFT සඳහා පාඩම් සැලැස්ම දෙනු මැනව.", "Z-score එක 2.800 දක්වා වැඩි කරගන්නේ කෙසේද?"]||

Ensure the suggestions are grammatically correct, friendly, and brief. Do not output other text after the suggestions line.`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });

      // Indicate to UI that inner thinking model started
      res.write(`data: ${JSON.stringify({ text: "[STATUS: Activating Inner Analytical Engine...]\n" })}\n\n`);

      // 1. First Model: Generates Thinking and Finalizes Data
      const thinkingPromptText = `As the background analyzer engine, process the student's lesson completion data across all subjects (SFT, ET, ICT).
Here is their logged student metrics and checklist performance:
${JSON.stringify(data, null, 2)}

Here is the syllabus mapping:
${JSON.stringify(syllabus, null, 2)}

Perform a deep analysis and generate finalized thinking data for the presentation model:
1. Extract and calculate exact Z-Scores and lesson marks subject-wise.
2. Map out a Day-by-Day lesson plan from today until the A/L exam to optimize Z-Scores by targeting high-yield "mcqMax" topics.
3. Create a conceptual quiz/assessment to ask the user's requirements (e.g. Which specific sub-topic is hardest for them now?).
Provide this as a raw structured contextual report. Be extremely concise.`;

      const tryModelsThinking = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
      let thinkingResponse = null;
      let lastThinkingError = null;

      for (const m of tryModelsThinking) {
        try {
          thinkingResponse = await enqueueGeminiTask(async () => {
             return await ai.models.generateContent({
               model: m, 
               contents: thinkingPromptText,
               config: { temperature: 0.2 },
             });
          });
          break;
        } catch (e: any) {
          lastThinkingError = e;
          console.warn(`Lesson optimizer thinking failed on model \${m}:`, e.status || e.message);
        }
      }

      if (!thinkingResponse) {
        throw lastThinkingError;
      }

      const finalizedData = thinkingResponse.text || "No analysis generated.";

      res.write(`data: ${JSON.stringify({ text: "[STATUS: Core data finalized. Passing to presentation model...]\n" })}\n\n`);

      // 2. Second Model: Generates Final Massage to User
      const finalPromptText = `ඔබ G.C.E. A/L Engineering Technology stream සඳහා අතිශය විශ්ලේෂණාත්මක, critical-thinking භාවිත කරන senior academic strategist කෙනෙකු ලෙස ක්රියා කරන්න.

මට සාමාන්ය timetable එකක් නොව, actual marks සහ Z-score වැඩි කිරීම සඳහා නිර්මාණය කළ සම්පූර්ණ day-by-day recovery plan එකක් අවශ්යයි.

## ශිෂ්ය තොරතුරු
විෂයයන්:
1. SFT – Science for Technology
2. ET – Engineering Technology
3. ICT – Information and Communication Technology

විභාග දින:
* ET: 2026 අගෝස්තු 11
* SFT: 2026 අගෝස්තු 18
* ICT: 2026 අගෝස්තු 25

## අනිවාර්ය ප්රධාන Deadline
SFT විෂයේ සියලු පාඩම් 2026 ජූලි 3 වන විට first-pass level එකෙන් අවසන් විය යුතුයි.
ජූලි 3 වන විට SFT සඳහා පහත සියල්ල සිදුවිය යුතුයි:
* සියලු incomplete lessons ඉගෙන අවසන් කිරීම
* high-mark/high-Z-score lessons මුලින් අවසන් කිරීම
* සෑම lesson එකකටම short notes
* formulas සහ definitions recall කිරීම
* ප්රධාන lesson questions කිරීම
* weak lessons හඳුනාගැනීම
* Heat වැනි completed ලෙස පෙන්වන නමුත් performance අඩු lessons නැවත ඉගෙනීම
මෙම deadline එක වෙනස් නොකරන්න.

## දෛනික වැඩ ප්රමාණය
* දිනකට අවම effective study hours: පැය 12
* දවසකට උපරිම විෂය 2ක් පමණයි
* ජූලි 3 වන තෙක් SFT සඳහා ප්රධාන priority එක දෙන්න
* දවසේ අවම පැය 8–10ක් SFT සඳහා දෙන්න
* ඉතිරි පැය 2–4 ET හෝ ICT maintenance සඳහා භාවිත කරන්න
* Passive video watching පැය ලෙස පමණක් ගණන් නොකරන්න
* Questions, calculations, diagrams, recall සහ corrections ප්රධාන කරන්න

## “Lesson Complete” යන අර්ථය
Lesson එකක් complete ලෙස ගණන් කරන්න කලින් පහත සියල්ල අවසන් විය යුතුයි:
1. Lesson recording, theory හෝ notes අවසන් කිරීම
2. පිටු 1–2ක short note එකක්
3. Formula, definition, process හෝ diagram මතකයෙන් ලිවීම
4. Lesson-related past-paper questions කිරීම
5. Marking scheme භාවිත කර ලකුණු කිරීම
6. වැරදි error book එකකට ලිවීම
7. පැය 72කට පසු retest කිරීම
8. Retest score අවම 70% වීම
First-pass completion සහ mastery completion වෙන වෙනම පෙන්වන්න.

## SFT priority order
Marks, Z-score impact, weakness, prerequisites සහ time-to-complete සලකා priority framework භාවිත කරන්න. High-weight lessons සඳහා වැඩිම උදෑසන deep-work hours ලබාදෙන්න.

## ජූනි 22 සිට ජූලි 3 දක්වා SFT plan සඳහා අවශ්ය නීති
2026 ජූනි 22 සිට 2026 ජූලි 3 දක්වා සෑම දිනයක්ම වෙන වෙනම plan කරන්න. High-weight lesson එකක් එක් දිනකින් complete නොවන්නේ නම් එය දින 2කට බෙදන්න. නමුත් ජූලි 3 deadline එක වෙනස් නොකරන්න. 

## Full timeline
* Phase 1: June 22–July 3 - SFT සියලු lessons first-pass complete.
* Phase 2: July 4–July 15 - ET සහ ICT unfinished lessons complete, SFT 72-hour retests.
* Phase 3: July 16–July 27 - විෂය තුනේම 2016–2025 topic questions, Lesson mastery tests.
* Phase 4: July 28–August 10 - ET full-paper campaign.
* Phase 5: August 12–August 17 - SFT full-paper campaign.
* Phase 6: August 19–August 24 - ICT full-paper campaign.

## Past-paper rules
සෑම subject එකකටම 2016–2025 papers සියල්ල cover කළ යුතුයි. Error categories: K (Knowledge), C (Concept), A (Application), T (Time), R (Reading/careless).

## Z-score critical analysis
Overall Z-score 2.5000 ලබාගැනීමට subject Z-score එකතුව 7.5000 විය යුතු බව පැහැදිලි කරන්න. 2.5000 guarantee නොකරන්න.

## Daily output rules
සෑම සාමාන්ය දිනයකම අවම output: MCQ 40–60, Structured/essay questions 3–5, Corrected errors 15+, Closed-book recall test 1, Formula/diagram sheet 1, Measurable lesson milestone 1.

## සෞඛ්ය සහ sleep
* සාමාන්ය දිනවල effective work පැය 12
* Sleep අවම පැය 6.5–7.5

## Output language සහ style
සම්පූර්ණ පිළිතුර පැහැදිලි ස්වභාවික සිංහලෙන් දෙන්න. අවශ්ය English technical terms පමණක් භාවිත කරන්න. "Ayya", "Akka" හෝ අතිශය emotional language භාවිත නොකරන්න. Critical, direct, motivating සහ realistic වෙන්න.

## අවශ්ය final output structure
1. වර්තමාන තත්ත්වය පිළිබඳ කෙටි critical analysis
2. SFT high-Z/high-mark priority ranking
3. June 22–July 3 සම්පූර්ණ day-by-day plan
4. සෑම දිනකම පැය 12 time blocks
5. ජූලි 3 SFT completion audit
6. July 4–July 27 ET/ICT සහ mastery plan
7. July 28–August 25 full-paper plan
8. 2016–2025 papers cover කරන exact method
9. Z-score 2.5000 strategy
10. Weekly marks checkpoints
11. Daily tracking template
12. Failure recovery plan
13. Final direct advice සහ motivation

කිසිදු clarification question එකක් අහන්න එපා. ලබාදී ඇති data අනුව best possible plan එක generate කරන්න. Plan එක unrealistic ලෙස lesson ගොඩක් එකම පැය කිහිපයකට දමන්න එපා.

Here is the finalized analytical thinking data from the deep analysis engine that you MUST use to build the plan:
<analysis_data>
\${finalizedData}
</analysis_data>

\${historyPrompt}

CRUCIAL: To make this advice highly interactive, formulate exactly 3 custom, highly relevant helpful Sinhala reply suggestions that the user can click next in their interface. You MUST place these suggestions at the absolute end of your response, formatted EXACTLY inside double pipes and preceded by SUGGESTIONS:, like this:
||SUGGESTIONS: ["suggestion 1", "suggestion 2", "suggestion 3"]||

Ensure the suggestions are grammatically correct, friendly, and brief. Do not output other text after the suggestions line.`;

      const tryModelsFinal = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
      let responseStream = null;
      let lastFinalError = null;

      for (const m of tryModelsFinal) {
        try {
          responseStream = await enqueueGeminiTask(async () => {
             return await ai.models.generateContentStream({
               model: m,
               contents: finalPromptText,
               config: { temperature: 0.7 },
             });
          });
          break;
        } catch (e: any) {
          lastFinalError = e;
          console.warn(`Lesson optimizer final failed on model \${m}:`, e.status || e.message);
        }
      }

      if (!responseStream) {
        throw lastFinalError;
      }

      for await (const chunk of responseStream) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error: any) {
      console.error("Failed to generate lesson optimizer stream:", error);
      res.write(`data: ${JSON.stringify({ text: "\n# Stream Failed\nCould not connect to AI. Please try again." })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    }
  });
