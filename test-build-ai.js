import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { readUser, writeUser } from "../data/userRepository";
export const aiRoutes = express.Router();
aiRoutes.get("/chat/history", (req, res) => {
  try {
    const email = req.query.email;
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
      attachments = []
    } = req.body;
    const ai2 = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
    const parts = [];
    if (attachments.length > 0) {
      for (const file of attachments) {
        parts.push({
          inlineData: { data: file.data, mimeType: file.mimeType }
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
      /* @__PURE__ */ new Set([
        model,
        ...[
          "gemini-pro-latest",
          "gemini-1.5-pro",
          "gemini-2.5-flash",
          "gemini-3.1-flash-lite",
          "gemini-2.5-flash-lite"
        ]
      ])
    );
    const tryModels = uniqueModels;
    let formattedAllData = [];
    let formattedPredictorData = {};
    try {
      if (allData) {
        formattedAllData = Object.keys(allData).filter((k) => ["sft", "et", "ict"].includes(k)).map((subject) => {
          const subjectData = allData[subject];
          const topicsObj = subjectData?.topics || {};
          const lessons = Object.keys(topicsObj).map((topic) => ({
            topic,
            status: topicsObj[topic].checked ? "completed" : "in-progress"
          }));
          const completedLessons = lessons.filter(
            (l) => l.status === "completed"
          );
          const inProgressLessons = lessons.filter(
            (l) => l.status === "in-progress"
          );
          return {
            subject: subject.toUpperCase(),
            completedLessons: [...completedLessons, ...inProgressLessons],
            pastPaperMarks: Array.isArray(subjectData?.paperMarks) ? subjectData.paperMarks.map((p) => ({
              title: p.title || p.year,
              mcq: Number(p.mcq) || 0,
              essay: Number(p.essay) || 0,
              grade: p.grade || "Pending"
            })) : [],
            lessonWiseMarks: subjectData.questionMarks || {},
            lessonHistory: subjectData.lessonHistory || [],
            targetZ: allData.targetZ || 0,
            weaknesses: [],
            strengths: []
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
              ict: predictorData.ictMark || 0
            },
            lessonWiseMarks: predictorData.lessonWiseMarks || {},
            overallZScore,
            targetZScore: targetZ,
            zScoreEstimate: {
              range: overallZScore ? `${overallZScore.toFixed(4)} - ${(overallZScore + 0.2).toFixed(4)}` : "0.0000 - 0.0000",
              confidence: overallZScore ? "Moderate" : "Low (Data Needed)",
              summary: overallZScore ? "Based on your past paper marks." : "\u0DAD\u0DC0\u0DB8\u0DAD\u0DCA \u0DB4\u0DCA\u200D\u0DBB\u0DB8\u0DCF\u0DAB\u0DC0\u0DAD\u0DCA \u0DBD\u0D9A\u0DD4\u0DAB\u0DD4 \u0DAF\u0DAD\u0DCA\u0DAD \u0DB1\u0DDC\u0DB8\u0DD0\u0DAD."
            }
          };
        } else {
          const avg = predictorData[`${activeSubject}Mark`] || 0;
          formattedPredictorData = {
            readinessScore: avg,
            lessonWiseMarks: predictorData.lessonWiseMarks?.[activeSubject] || [],
            zScoreEstimate: {
              range: overallZScore ? `${overallZScore.toFixed(4)} - ${(overallZScore + 0.2).toFixed(4)}` : "0.0000 - 0.0000",
              confidence: overallZScore ? "Moderate" : "Low (Data Needed)",
              summary: overallZScore ? "Based on your past paper marks." : "\u0DAD\u0DC0\u0DB8\u0DAD\u0DCA \u0DB4\u0DCA\u200D\u0DBB\u0DB8\u0DCF\u0DAB\u0DC0\u0DAD\u0DCA \u0DBD\u0D9A\u0DD4\u0DAB\u0DD4 \u0DAF\u0DAD\u0DCA\u0DAD \u0DB1\u0DDC\u0DB8\u0DD0\u0DAD."
            }
          };
        }
      }
    } catch (e) {
      console.error("Error formatting data:", e);
    }
    let response = null;
    let lastError = null;
    for (const m of tryModels) {
      try {
        const supportsSearch = m.startsWith("gemini-3");
        const dynamicTools = [];
        const promptLower = (prompt || "").toLowerCase();
        const isSearchReq = /paper|past|syllabus|scheme|resource|pdf|link|download|search|web|පේපර්|සිලබස්|g\.c\.e|marking/i.test(
          promptLower
        );
        const fnDeclarations = [
          {
            name: "generateImage",
            description: "Generates/creates a beautiful scientific, educational, or creative image from a highly detailed text prompt ONLY WHEN the user explicitly requests to create, draw, generate, or paint an image.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                prompt: {
                  type: Type.STRING,
                  description: "A detailed description in English of the image to generate. Include styling, context, and subject details."
                }
              },
              required: ["prompt"]
            }
          },
          {
            name: "addPaperMark",
            description: "Adds a past paper mark to the user's data ONLY WHEN the user explicitly provides their mark.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                subject: {
                  type: Type.STRING,
                  description: "Required subject ID: sft, et, or ict"
                },
                title: { type: Type.STRING },
                mcq: { type: Type.NUMBER },
                essay: { type: Type.NUMBER },
                grade: { type: Type.STRING }
              },
              required: ["subject", "title", "mcq", "essay", "grade"]
            }
          },
          {
            name: "addLessonMark",
            description: "Adds a topic-specific lesson mark to the user's data ONLY WHEN the user explicitly provides their exact mark.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                subject: {
                  type: Type.STRING,
                  description: "Required subject ID: sft, et, or ict"
                },
                topic: { type: Type.STRING },
                title: { type: Type.STRING },
                part: { type: Type.STRING, description: "MCQ, A, or BCD" },
                mark: {
                  type: Type.NUMBER,
                  description: "The normalized mark they received"
                }
              },
              required: ["subject", "topic", "title", "part", "mark"]
            }
          },
          {
            name: "renderCustomGraph",
            description: "Renders a custom graph in the chat to analyze user data. You can use 'bar', 'line', 'pie', 'radar', 'area', or 'scatter'. DO NOT invent hypothetical data. Only plot data that actually exists in allData or predictorData payload. If there is no data, do not call this tool.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                type: {
                  type: Type.STRING,
                  description: "The type of graph: 'bar', 'line', 'pie', 'radar', 'area', or 'scatter'"
                },
                data: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      value: { type: Type.NUMBER }
                    }
                  }
                }
              },
              required: ["title", "type", "data"]
            }
          },
          {
            name: "createStudyPlan",
            description: "Generates a structured study plan table for the student.",
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
                        description: "e.g., Day 1, Monday"
                      },
                      topic: { type: Type.STRING },
                      activities: { type: Type.STRING }
                    }
                  }
                }
              },
              required: ["planTitle", "days"]
            }
          },
          {
            name: "identifyHighYieldingLessons",
            description: "Identifies and ranks lessons based on how easily they yield marks.",
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
                        description: "Name of the lesson with an emoji (e.g. '\u0DC3\u0D82\u0D9B\u0DCA\u200D\u0DBA\u0DCF\u0DB1\u0DBA (Statistics) \u{1F4CA}')"
                      },
                      marksBreakdown: {
                        type: Type.STRING,
                        description: "Breakdown of marks in the paper (e.g. '\u0DBD\u0D9A\u0DD4\u0DAB\u0DD4: Essay Q5 (\u0DBD\u0D9A\u0DD4\u0DAB\u0DD4 150) + MCQ 3\u0D9A\u0DCA.')"
                      },
                      reason: {
                        type: Type.STRING,
                        description: "Why it yields high marks easily / specialty (e.g. '\u0DC0\u0DD2\u0DC1\u0DDA\u0DC2\u0DAD\u0DCA\u0DC0\u0DBA: \u0DAD\u0DB1\u0DD2 \u0DB4\u0DCF\u0DA9\u0DB8\u0D9A\u0DD2\u0DB1\u0DCA...')"
                      },
                      priority: {
                        type: Type.STRING,
                        description: "High, Medium, Low"
                      }
                    }
                  }
                }
              },
              required: ["listTitle", "lessons"]
            }
          }
        ];
        if (supportsSearch && isSearchReq) {
          dynamicTools.push({ googleSearch: {} });
          dynamicTools.push({ functionDeclarations: fnDeclarations });
        } else {
          dynamicTools.push({ functionDeclarations: fnDeclarations });
        }
        const config = {
          systemInstruction: `You are Clora X Infinity. An autonomous AI Learning Operating System. You are not a chatbot.

You are:
\u2022 Personal Teacher
\u2022 Study Coach
\u2022 Academic Analyst
\u2022 Learning Psychologist
\u2022 Revision Planner
\u2022 Career Advisor
\u2022 University Advisor
\u2022 Performance Predictor
\u2022 Knowledge Manager
\u2022 Progress Tracker
\u2022 Motivation Coach
\u2022 Learning Companion

PRIMARY LANGUAGE
Sinhala. Use English only for technical terms.
Use modern, elegant markdown formatting typical of Clora X updates (e.g. clean bold headers, bullet points, intuitive emojis, clear mathematical layouts if needed).
Use rich, premium emojis (\u{1F34F}, \u{1F525}, \u{1F3AF}, \u{1F3C6}, \u2728, \u{1F9E0}, \u{1F4C8}, etc.) naturally and frequently in your text formatting.

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
CORE BEHAVIOR
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Do not just give the final answer. Reference the official resource book and syllabus guidelines, think really hard, analyze where the logic failed, and break down the deep reasoning step-by-step so the user can truly learn the concept. Answer in the tone and depth of a World-Famous Stanford University Professor explaining why this is a 'Game Changer'.
Always:
\u2022 Be a proactive tutor. Don't wait for prompts. Observe, Compare, Prioritize, Guide.
\u2022 Memory & Context: Reference the student's past interactions, previous goals, and ongoing struggles naturally. Use phrases like "I remember you were struggling with...", "Last time you focused on...".
\u2022 Instant Useful Insight: Within the first sentence, provide a highly valuable observation directly related to the user's data or immediate question.
\u2022 Progressive Disclosure: Show a quick, scannable summary or the most vital insight first. Then, provide the detailed breakdown or deep dive below it. Don't overwhelm upfront.
\u2022 Follow-up Suggestions: Always end your response with 1-3 natural, actionable follow-up suggestions or questions to keep the learning momentum going.
\u2022 Be dynamic: Stream your thoughts as if you are reasoning playfully (e.g., "I did notice a weaker pattern..." -> "Those topics should probably be prioritized.").
\u2022 Use internal reasoning privately. Never expose raw JSON logic.
\u2022 Never invent data.
\u2022 Explain uncertainty.
\u2022 Learn from history.
\u2022 Personalize every answer.

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
INTERNET SEARCH & PAST PAPERS DIRECTIVE
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
When the student asks for past papers, syllabuses, resource books, marking schemes, or any PDF document links (e.g., '2024 al sft paper', '2023 ict paper pdf', 'sft resource book pdf', etc.):
1. You MUST use the googleSearch tool to perform a real-time internet search for that paper, book, or document.
2. Search for high-quality, trusted educational repositories or websites in Sri Lanka (e.g., pastpapers.wiki, apepanthiya.lk, guru.lk, mathsapi.com, fat.lk, and similar sites).
3. Extract direct, clickable PDF file URLs or official download page URLs.
4. Present these document links clearly using elegant bullet points, direct markdown anchors, and clear file-type annotations (e.g. "\u{1F4E5} **[Download 2024 SFT Past Paper PDF](https://...)**" or "\u{1F4C4} **[View 2024 AL SFT Marking Scheme PDF](https://...)**").
5. Clearly specify in a small note under the links that these files were fetched via real-time Google search grounding.

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
MEMORY ENGINE & ADAPTIVE MEMORY
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Maintain continuously: studentProfile (goals, subjects, marks, streaks, weaknesses, strengths, learningStyle, etc.)
Remember: Long term goals, weak/strong subjects, repeated mistakes, preferred explanations, career interests. Keep only meaningful trends.

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
DETECTORS
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u2022 Personality: Competitive Achiever, Fast Learner, Deep Thinker, Exam Sprinter, Consistent Performer, Knowledge Explorer, Perfectionist, Distracted Learner.
\u2022 Learning Style: Visual, Practical, Reading/Writing, Auditory, Mixed. Adapt teaching style accordingly.
\u2022 Knowledge Gap: Weak Lessons, Skipped Topics, Repeated Mistakes, Low Performance Areas. Generate a Recovery/Revision Plan.
\u2022 Risk: Low Consistency, Backlogs, Missed Revisions, Weak Subjects, Exam Risk (Low, Moderate, High, Critical).

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
ACADEMIC ANALYTICS
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Analyze: Lessons, Marks, Past Papers, Revision Logs. Generate Progress Score, Readiness Score, Mastery Score, Consistency Score, Risk Score.

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
SMART REVISION ENGINE
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Use spaced repetition. Prioritize weak areas, forgotten topics, exam topics.

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
XP & ACHIEVEMENTS SYSTEM
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Award XP for lessons, past papers, marks, streaks tracking (Daily, Weekly, Monthly).
Award Achievements (First Lesson, 7 Day Streak, ICT/ET/SFT Master, etc.).

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
PREDICTION ENGINE & Z SCORE ESTIMATOR
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Predict Future Marks, Exam Readiness, Completion Probability, Improvement Trends. Set confidence. 
Estimate Z Score only if enough data exists (Output Range, Confidence, Reasoning Summary). Never claim official values/rank.

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
CAREER & UNIVERSITY ENGINE
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Recommend universities (Computer Science, Software Engineering, etc.) and careers based on Performance, Interests, Personality, Learning Style. Calculate Math Score, Growth Potential, Confidence.

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
KNOWLEDGE GRAPH & RAG MODE
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Maintain relationships: Student -> Subjects -> Lessons -> Skills -> Careers -> Universities.
When notes/files exist, retrieve relevant info first. Prioritize User Notes, Study History, Revision History, Past Mistakes.

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
OUTPUT STRUCTURE & DASHBOARD ENGINE
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Generate chart-ready json (Bar, Line, Radar, Pie, Forecast) when applicable. Use actual data only. Never generate fake values.
Outputs can include Dashboard, Insights, Risks, Recommendations, Streak, Achievements, XP, Study Plan, Predictions, Career Guidance.

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
MISSION
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
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
          tools: dynamicTools
        };
        if (supportsSearch && isSearchReq) {
          config.toolConfig = { includeServerSideToolInvocations: true };
        }
        response = await enqueueGeminiTask(async () => {
          return await ai2.models.generateContent({
            model: m,
            contents,
            config
          });
        });
        break;
      } catch (e) {
        lastError = e;
        console.warn(`Model ${m} failed: ${e.message}. Trying next...`);
        continue;
      }
    }
    if (!response) {
      console.warn(
        "All Clora X models failed. Attempting Pollinations AI free fallback..."
      );
      try {
        const sysInstruction = `You are Clora X Infinity. An autonomous AI Learning Operating System. You are not a chatbot.
PRIMARY LANGUAGE: Sinhala. Use English only for technical terms.
Do not just give the final answer. Reference the official resource book and syllabus guidelines, think really hard, analyze where the logic failed, and break down the deep reasoning step-by-step so the user can truly learn the concept. Answer in the tone and depth of a World-Famous Stanford University Professor explaining why this is a 'Game Changer'.
Please respond exactly like Clora X Infinity would, preserving all personality traits and academic advice.
Make sure to format beautifully in markdown.`;
        const messages = [
          { role: "system", content: sysInstruction },
          ...history.map((h) => {
            const textParts = Array.isArray(h.parts) ? h.parts.map((p) => p.text || "").join("\n") : typeof h.parts === "string" ? h.parts : "";
            return {
              role: h.role === "model" ? "assistant" : "user",
              content: textParts || "-"
            };
          }),
          { role: "user", content: prompt || "-" }
        ];
        const fallbackText = await callPollinationsAI(messages, false);
        res.json({
          text: fallbackText,
          groundingMetadata: void 0,
          isFallback: true
        });
        return;
      } catch (fallbackErr) {
        console.error("Pollinations AI fallback failed:", fallbackErr);
        throw lastError || fallbackErr;
      }
    }
    if (response.functionCalls && response.functionCalls.length > 0) {
      const call = response.functionCalls[0];
      res.json({
        text: "Action executed.",
        functionCall: { name: call.name, args: call.args }
      });
      return;
    }
    res.json({
      text: response.text,
      groundingMetadata: response.candidates?.[0]?.groundingMetadata
    });
  } catch (error) {
    console.error(error);
    let msg = error.message || "Failed to generate response";
    if (msg.includes("You exceeded your current quota")) {
      msg = "Free tier limit reached for the selected model. Please wait a minute and try again, or switch to a different model.";
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
    const ai2 = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
    let base64Image = "";
    try {
      const response = await enqueueGeminiTask(async () => {
        return await ai2.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: {
            parts: [{ text: prompt }]
          },
          config: {
            imageConfig: {
              aspectRatio: "1:1"
            }
          }
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
        err
      );
    }
    if (!base64Image) {
      console.log(
        "Clora X image generation unavailable on free tier. Using Pollinations AI URL fallback..."
      );
      const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 1e6)}`;
      return res.json({ imageUrl: fallbackUrl });
    }
    res.json({ imageUrl: `data:image/png;base64,${base64Image}` });
  } catch (error) {
    console.error("Image generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate image" });
  }
});
aiRoutes.post("/notebook-quiz", async (req, res) => {
  try {
    cleanRequestLog();
    const now = Date.now();
    const requestsLastMinute = requestLog.filter(
      (t) => now - t < 6e4
    ).length;
    if (requestLog.length >= RPD_LIMIT) {
      return res.status(429).json({
        error: `Daily free tier limit (${RPD_LIMIT} requests) reached.`
      });
    }
    if (requestsLastMinute >= RPM_LIMIT) {
      return res.status(429).json({
        error: `Too many requests (Rate limit: ${RPM_LIMIT}/min). Please wait.`
      });
    }
    const { subject } = req.body;
    const ai2 = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
    const tryQuizModels = [
      "gemini-pro-latest",
      "gemini-1.5-pro",
      "gemini-2.5-flash",
      "gemini-3.1-flash-lite",
      "gemini-2.5-flash-lite"
    ];
    let lastQuizErr = null;
    for (const quizModel of tryQuizModels) {
      try {
        console.log(
          `Generating quiz via Gemini fallback for NotebookLM: ${quizModel}...`
        );
        const response = await enqueueGeminiTask(async () => {
          return await ai2.models.generateContent({
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
              responseMimeType: "application/json"
            }
          });
        });
        const text = response.text() || "";
        const quiz = JSON.parse(text.trim());
        return res.json({ quiz });
      } catch (err) {
        lastQuizErr = err;
        console.warn(`Quiz generation model ${quizModel} failed:`, err);
      }
    }
    throw lastQuizErr || new Error("All dynamic quiz generation models failed");
  } catch (error) {
    console.error("Quiz generation failed:", error);
    res.status(500).json({ error: error.message || "Failed to generate dynamic quiz." });
  }
});
aiRoutes.post("/quiz", async (req, res) => {
  const { subject, topic } = req.body;
  if (!subject || !topic) {
    return res.status(400).json({ error: "Missing G.C.E. A/L subject or topic area" });
  }
  const { preloadedQuestions } = await import("./src/data/questionsData").catch(() => ({
    preloadedQuestions: []
  }));
  const preloaded = preloadedQuestions.filter(
    (q) => topic.includes(q.category) || q.category.includes(topic)
  );
  if (preloaded && preloaded.length > 0) {
    const shuffled = [...preloaded].sort(() => 0.5 - Math.random());
    const selectedQs = shuffled.slice(0, 5).map((q, idx) => ({
      id: idx + 1,
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation || "Correct."
    }));
    return res.json({ quiz: selectedQs });
  }
  try {
    const ai2 = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
    const tryQuizModels = [
      "gemini-pro-latest",
      "gemini-1.5-pro",
      "gemini-2.5-flash",
      "gemini-3.1-flash-lite",
      "gemini-2.5-flash-lite"
    ];
    let response = null;
    let lastQuizErr = null;
    for (const quizModel of tryQuizModels) {
      try {
        response = await enqueueGeminiTask(async () => {
          return await ai2.models.generateContent({
            model: quizModel,
            contents: "Generate a 5-question multiple-choice quiz about the following topic in the Sri Lankan G.C.E. Advanced Level Technology syllabus.\nSubject: " + subject.toUpperCase() + "\nTopic: " + topic + '\n\nEnsure the questions are high-quality, relevant to the A/L syllabus standards, and written in a combination of Sinhala/English (matching the bilingual teaching style of SFT or ET in Sri Lanka).\nReturn the output strictly in valid JSON format as an array of 5 questions.\nEach question object MUST have:\n1. "id" (integer 1 to 5)\n2. "question" (string containing question text and any formula)\n3. "options" (array of 4 strings representing MCQ choices)\n4. "correctIndex" (integer 0 to 3 representing correct option index)\n5. "explanation" (string explaining key theory and why it is correct in Sinhala/English)\n\nDo NOT write markdown wraps like ```json or trailing extra symbols. Only return a raw JSON array.',
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
                      items: { type: Type.STRING }
                    },
                    correctIndex: { type: Type.INTEGER },
                    explanation: { type: Type.STRING }
                  },
                  required: [
                    "id",
                    "question",
                    "options",
                    "correctIndex",
                    "explanation"
                  ]
                }
              }
            }
          });
        });
        if (response && response.text) {
          break;
        }
      } catch (err) {
        lastQuizErr = err;
        console.warn(`Quiz generation model ${quizModel} failed:`, err);
      }
    }
    if (!response || !response.text) {
      throw lastQuizErr || new Error("All dynamic quiz generation models failed");
    }
    const text = response.text || "[]";
    const quiz = JSON.parse(text.trim());
    return res.json({ topic, quiz });
  } catch (error) {
    console.warn(
      "Quiz generation via Clora X failed, falling back to Pollinations AI...",
      error
    );
    try {
      const messages = [
        {
          role: "system",
          content: "You are an expert tutor in Sri Lankan G.C.E. Advanced Level Technology (SFT/ET/ICT). You must return output STRICTLY formatted as a JSON array of 5 questions according to the specified schema. No markdown wrappers, no backticks, just raw parseable JSON."
        },
        {
          role: "user",
          content: "Generate a 5-question multiple-choice quiz about the following topic in the Sri Lankan G.C.E. Advanced Level Technology syllabus.\nSubject: " + subject + "\nTopic: " + topic + '\n\nEnsure the questions are high-quality, relevant to the A/L syllabus standards, and written in a combination of Sinhala/English (matching the bilingual teaching style of SFT or ET in Sri Lanka).\nReturn output as a valid JSON array of 5 question objects.\nEach object must contain keys:\n1. "id" (integer 1 to 5)\n2. "question" (string containing question text)\n3. "options" (array of 4 strings representing MCQ choices)\n4. "correctIndex" (integer 0 to 3 representing correct option index)\n5. "explanation" (string explaining key theory in Sinhala and English as feedback for this question)\n\nOnly output raw parseable JSON list of questions, no other text or trailing elements. Do not wrap in markdown.'
        }
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
    } catch (fallbackErr) {
      console.error("Quiz generation fallback failed:", fallbackErr);
      return res.status(500).json({
        error: "Failed to generate dynamic quiz due to AI resource exhaustion. Please try again in a minute."
      });
    }
  }
});
aiRoutes.post("/analytics-summary", async (req, res) => {
  const { subject, data } = req.body;
  if (!subject || !data) {
    return res.status(400).json({ error: "Missing parameters subject or audit data payload" });
  }
  const daysRemaining = Math.max(
    0,
    Math.ceil(
      ((/* @__PURE__ */ new Date("2026-08-01")).getTime() - (/* @__PURE__ */ new Date()).getTime()) / (1e3 * 3600 * 24)
    )
  );
  const uniZScores = `
1. \u0DB4\u0DCA\u200D\u0DBB\u0DB0\u0DCF\u0DB1 \u0D89\u0D82\u0DA2\u0DD2\u0DB1\u0DDA\u0DBB\u0DD4 \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DC0\u0DDA\u0DAF\u0DD3 (BET Hons) \u0D8B\u0DB4\u0DCF\u0DB0\u0DD2 \u0DC3\u0DC4 \u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DBD:
\u0DC1\u0DCA\u200D\u0DBB\u0DD3 \u0DA2\u0DBA\u0DC0\u0DBB\u0DCA\u0DB0\u0DB1\u0DB4\u0DD4\u0DBB \u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DBD\u0DBA: 1.60 - 1.75
\u0D9A\u0DD0\u0DBD\u0DAB\u0DD2\u0DBA \u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DBD\u0DBA: 1.55 - 1.65
\u0D9A\u0DDC\u0DC5\u0DB9 \u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DBD\u0DBA (Instrumentation and Automation): 1.40 - 1.55
\u0DBB\u0DD4\u0DC4\u0DD4\u0DAB \u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DBD\u0DBA: 1.35 - 1.45
\u0DC0\u0DBA\u0DB9 \u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DBD\u0DBA: 1.25 - 1.35
\u0DC3\u0DB6\u0DBB\u0D9C\u0DB8\u0DD4\u0DC0 \u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DBD\u0DBA: 1.20 - 1.30
\u0DBB\u0DA2\u0DBB\u0DA7 \u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DBD\u0DBA: 1.15 - 1.25
\u0D8C\u0DC0 \u0DC0\u0DD9\u0DBD\u0DCA\u0DBD\u0DC3\u0DCA\u0DC3 \u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DBD\u0DBA (Mechanical Engineering Technology): 1.10 - 1.20
\u0DBA\u0DCF\u0DB4\u0DB1\u0DBA \u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DBD\u0DBA: 0.85 - 1.05

2. \u0DC0\u0DD9\u0DB1\u0DAD\u0DCA \u0D9A\u0DCA\u0DC2\u0DDA\u0DAD\u0DCA\u200D\u0DBB\u0DC0\u0DBD \u0D8B\u0DB4\u0DCF\u0DB0\u0DD2 \u0DB4\u0DCF\u0DA8\u0DB8\u0DCF\u0DBD\u0DCF:
\u0DAD\u0DDC\u0DBB\u0DAD\u0DD4\u0DBB\u0DD4 \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DBA:
Information Technology (IT - \u0DB8\u0DDC\u0DBB\u0DA7\u0DD4\u0DC0): 1.55 - 1.75
Information Systems (\u0D9A\u0DDC\u0DC5\u0DB9 UCSC \u0DC3\u0DC4 \u0DA2\u0DB4\u0DD4\u0DBB): 1.45 - 1.65
Information Communication Technology (BICT Hons): 1.15 - 1.35 (\u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DBD\u0DBA \u0D85\u0DB1\u0DD4\u0DC0 \u0DC0\u0DD9\u0DB1\u0DC3\u0DCA \u0DC0\u0DDA)

\u0D9A\u0DC5\u0DB8\u0DB1\u0DCF\u0D9A\u0DBB\u0DAB\u0DBA \u0DC4\u0DCF \u0DC0\u0DCA\u200D\u0DBA\u0DCF\u0DB4\u0DCF\u0DBB:
Food Business Management: 1.15 - 1.30
Human Resource Development: 1.05 - 1.20
Management Studies (TV): 1.00 - 1.20
Project Management: 0.95 - 1.10

\u0DB1\u0DD2\u0DBB\u0DCA\u0DB8\u0DCF\u0DAB\u0D9A\u0DBB\u0DAB\u0DBA (\u0DB8\u0DDA\u0DC0\u0DCF\u0DA7 Z-Score \u0D91\u0D9A\u0DA7 \u0D85\u0DB8\u0DAD\u0DBB\u0DC0 \u0D85\u0DB1\u0DD2\u0DC0\u0DCF\u0DBB\u0DCA\u0DBA \u0DBA\u0DDD\u0D9C\u0DCA\u200D\u0DBA\u0DAD\u0DCF \u0DB4\u0DBB\u0DD3\u0D9A\u0DCA\u0DC2\u0DAB\u0DBA\u0D9A\u0DCA - Aptitude Test \u0D91\u0D9A\u0D9A\u0DCA \u0D87\u0DAD):
Design (\u0DB8\u0DDC\u0DBB\u0DA7\u0DD4\u0DC0): 1.05 - 1.25
Fashion Design & Product Development (\u0DB8\u0DDC\u0DBB\u0DA7\u0DD4\u0DC0): 1.00 - 1.20

\u0DC3\u0DDE\u0D9B\u0DCA\u200D\u0DBA \u0DC4\u0DCF \u0DC0\u0DD9\u0DB1\u0DAD\u0DCA:
Biomedical Technology: 1.00 - 1.20
Health Information and Communication Technology: 0.90 - 1.15
Sports Sciences & Management (Aptitude Test \u0D85\u0DB1\u0DD2\u0DC0\u0DCF\u0DBB\u0DCA\u0DBA\u0DBA\u0DD2): 0.85 - 1.10
Primary Education: 0.85 - 1.00
`;
  const promptText = `Analyze the student's progress, trends, and recent marks in Sri Lankan G.C.E. Advanced Level for the subject: ${subject.toUpperCase()}.
Here is their logged student metrics, checklist performance, ${subject === "z-core" ? "recent lesson completions history," : ""} and live z-score history with reasons:
${JSON.stringify(data, null, 2)}

Here are the Sri Lankan University Z-Score Target cut-offs for Engineering Technology stream degrees:
${uniZScores}

You are Clora X, the advanced GCE Advanced Level AI Strategic Advisor. 

[Role & Cognitive Posture]
You are an Elite AI Strategic Advisor. Your primary cognitive mode is deep analytical reasoning. Do not generate immediate answers. You must engage in structured, multi-step thinking before providing the final output.

[Reasoning Protocol (Thinking Phase)]
Before answering the user, you MUST process the request internally using the following steps inside <thinking> and </thinking> text tags:
1. Deconstruction: Break down the user's prompt into core variables, implicit assumptions, and ultimate goals. MUST prefix this with: [STATUS: DECONSTRUCTING]
2. Multi-Path Analysis: Generate at least 3 distinct approaches to solve the problem. Evaluate the pros and cons of each. MUST prefix this with: [STATUS: SIMULATING]
3. Self-Reflection: Critique your own best approach. Identify edge cases, potential biases, or missing data. MUST prefix this with: [STATUS: SYNTHESIZING]
4. Payload Finalization: Finalize the most robust and optimal solution based on the critique. MUST prefix this with: [STATUS: FINALIZING_PAYLOAD]

[Execution & Steps]
Once the thinking phase is complete, execute the final response following these steps:
1. State the core strategy directly.
2. Provide actionable, step-by-step implementation tactics.
3. Highlight high-risk variables the user must monitor.

[Output Expectations]
Provide your final answer inside <advisor_output> and </advisor_output> tags.
Use markdown strictly for hierarchy (## for sections, bullet points for lists). 
Ensure the tone is highly professional, decisive, and objective. Speak with the authority and explanatory depth of a veteran university professor.

[Narrowing & Constraints]
- Positive Framing: Focus on what TO do (e.g., instead of "Don't ignore the budget", use "Strictly adhere to the budget").
- Zero Fluff: Omit all conversational filler, apologies, or generic introductory phrases like "\u0DC4\u0DCF\u0DBA\u0DD2 \u0DB8\u0DBD\u0DCA\u0DBD\u0DD3" or "\u0D94\u0DBA\u0DCF\u0D9C\u0DDA A/L \u0DC0\u0DD0\u0DA9".
- Data Grounding: If a factual premise is missing, state the assumption clearly before proceeding.

You MUST deeply analyze their 'zScoreHistory' array. Intersect these metrics with the 'date', 'reason' (why the score changed), and the actual z-score fluctuations to identify critical patterns, stagnation periods, progress velocities, or recent setbacks. In your report, explicitly reference these dates, district ranks, island ranks, subject grades, and reasons to give context and build a compelling, statistically-sound narrative of their current trajectory.

There are approximately ${daysRemaining} days remaining for the A/L exams on August 1, 2026. Use this timeframe to provide an exhaustive, prioritized, and hard-hitting study plan. Strictly DO NOT use terms like "\u0DB8\u0DBD\u0DCA\u0DBD\u0DD3", "\u0DAF\u0DD4\u0DC0", "\u0D85\u0DBA\u0DD2\u0DBA\u0DCF", "\u0D85\u0D9A\u0DCA\u0D9A\u0DDA", or "\u0D85\u0DBA\u0DD2\u0DBA\u0DDA". DO NOT act like an older brother. Act as a professional AI Academic Supervisor providing "Hard, Statistical Advice".

Your response MUST be ONLY raw Markdown text wrapped inside the <advisor_output> block (and <thinking> block before it). Do NOT wrap it in JSON.

At the very end of your response, AFTER the </advisor_output> tag, you MUST output an array of 3 highly relevant follow-up questions the user can ask to dive deeper into their strategy. This array MUST be formatted EXACTLY as a JSON array inside the following string pattern:
||SUGGESTIONS: ["Question 1", "Question 2", "Question 3"]||

In your <advisor_output> section, follow this exact markdown structure and use high-quality Sinhala mixed with necessary English terms:
1. **\u0DC0\u0DAD\u0DCA\u0DB8\u0DB1\u0DCA \u0DAD\u0DAD\u0DCA\u0DAD\u0DCA\u0DC0 \u0DC0\u0DD2\u0D9C\u0DCA\u200D\u0DBB\u0DC4\u0DBA (Current Status & Trajectory Analysis)**: Professor-level statistical analysis of their latest Z-score, Island Rank, and District rank.
2. **\u0DC0\u0DD2\u0DC2\u0DBA \u0D85\u0DB1\u0DD4\u0DC0 \u0DB4\u0DCA\u200D\u0DBB\u0D9C\u0DAD\u0DD2\u0DBA \u0DC3\u0DC4 \u0DB4\u0DC3\u0DD4\u0DB6\u0DD1\u0DB8\u0DCA (Subject-wise Deep Dive)**: Detailed analysis of their subject scores based on the latest history entry vs overall metrics.
3. **Z-Score \u0D89\u0DAD\u0DD2\u0DC4\u0DCF\u0DC3\u0DBA\u0DDA \u0DBB\u0DA7\u0DCF (Z-Score Historical Patterns)**: Detailed look at how and why their scores have changed over the recorded dates.
4. **\u0DC5\u0D9F\u0DCF \u0DC0\u0DD2\u0DBA \u0DC4\u0DD0\u0D9A\u0DD2 \u0D8B\u0DB4\u0DCF\u0DB0\u0DD2 \u0DC3\u0DC4 \u0D89\u0DBD\u0D9A\u0DCA\u0D9A (Attainable Degrees & Targets)**: State which university degrees are currently within reach based on the current Z-Score, and what they can unlock if they increase their Z-score further.
5. **\u0DC0\u0DD2\u0DC2\u0DBA\u0DB1\u0DCA \u0DAD\u0DCA\u200D\u0DBB\u0DD2\u0DAD\u0DCA\u0DC0\u0DBA \u0DC3\u0DB3\u0DC4\u0DCF \u0D89\u0DAD\u0DD2\u0DBB\u0DD2 \u0DAF\u0DD2\u0DB1 ${daysRemaining} \u0DC3\u0DB3\u0DC4\u0DCF \u0DC0\u0DB1 \u0DC0\u0DD2\u0DC1\u0DDA\u0DC2\u0DA5 \u0D9A\u0DCF\u0DBD\u0DC3\u0DA7\u0DC4\u0DB1 (Expert Action Plan)**: Provide an intensive, prioritized daily study plan for SFT, ET, and ICT to cover the remaining lessons focusing on maximizing Z-score yield.
6. **2016-2025 \u0DB4\u0DC3\u0DD4\u0D9C\u0DD2\u0DBA \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1 \u0DB4\u0DAD\u0DCA\u200D\u0DBB \u0DC3\u0DD0\u0DBD\u0DC3\u0DD4\u0DB8 (2016-2025 Past Papers Plan)**: Provide a strict, actionable plan on how to do the 2016 to 2025 past papers for all 3 subjects effectively before the exam.
7. **\u0DAF\u0DD0\u0DA9\u0DD2 \u0D85\u0DB0\u0DCA\u200D\u0DBA\u0DBA\u0DB1 \u0D8B\u0DB4\u0DAF\u0DDA\u0DC1\u0DB1\u0DBA (Final Strict Advice)**: Provide a powerful, strict, and motivating final advice paragraph emphasizing that the A/L exam is on August 1st, 2026. Give hard facts and strong motivation to push forward without wasting time. Do NOT use any brotherly/sisterly terms. Just raw motivation and strict guidance.`;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  try {
    const ai2 = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });
    const tryModels = ["gemini-1.5-flash", "gemini-2.5-flash", "gemini-1.5-pro", "gemini-2.5-flash-lite"];
    let responseStream = null;
    let lastError = null;
    for (const m of tryModels) {
      try {
        responseStream = await ai2.models.generateContentStream({
          model: m,
          contents: promptText,
          config: { temperature: 0.7 }
        });
        break;
      } catch (e) {
        lastError = e;
        console.warn(`Analytics summary stream failed on model ${m}, trying next:`, e.status || e.message);
      }
    }
    if (!responseStream) {
      throw lastError;
    }
    for await (const chunk of responseStream) {
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}

`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("AI diagnostics summary via stream failed", error);
    res.write(`data: ${JSON.stringify({ text: "\n# Stream Failed\nCould not connect to AI. Please try again." })}

`);
    res.write("data: [DONE]\n\n");
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
${history.map((m) => `${m.sender === "user" || m.role === "user" ? "USER" : "AI"}: ${m.text || m.content}`).join("\n")}

The user is now asking/replying: "${prompt || ""}"
`;
  } else {
    historyPrompt = `This is the first message. Analyze progress and generate the primary personalized maximum yield lesson strategy plan.`;
  }
  const uniZScores = `
1. \u0DB4\u0DCA\u200D\u0DBB\u0DB0\u0DCF\u0DB1 \u0D89\u0D82\u0DA2\u0DD2\u0DB1\u0DDA\u0DBB\u0DD4 \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DC0\u0DDA\u0DAF\u0DD3 (BET Hons) \u0D8B\u0DB4\u0DCF\u0DB0\u0DD2 \u0DC3\u0DC4 \u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DBD:
\u0DC1\u0DCA\u200D\u0DBB\u0DD3 \u0DA2\u0DBA\u0DC0\u0DBB\u0DCA\u0DB0\u0DB1\u0DB4\u0DD4\u0DBB \u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DBD\u0DBA: 1.60 - 1.75
\u0D9A\u0DD0\u0DBD\u0DAB\u0DD2\u0DBA \u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DBD\u0DBA: 1.55 - 1.65
\u0D9A\u0DDC\u0DC5\u0DB9 \u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DBD\u0DBA (Instrumentation and Automation): 1.40 - 1.55
\u0DBB\u0DD4\u0DC4\u0DD4\u0DAB \u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DBD\u0DBA: 1.35 - 1.45
\u0DC0\u0DBA\u0DB9 \u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DBD\u0DBA: 1.25 - 1.35
\u0DC3\u0DB6\u0DBB\u0D9C\u0DB8\u0DD4\u0DC0 \u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DBD\u0DBA: 1.20 - 1.30
\u0DBB\u0DA2\u0DBB\u0DA7 \u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DBD\u0DBA: 1.15 - 1.25
\u0D8C\u0DC0 \u0DC0\u0DD9\u0DBD\u0DCA\u0DBD\u0DC3\u0DCA\u0DC3 \u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DBD\u0DBA (Mechanical Engineering Technology): 1.10 - 1.20
\u0DBA\u0DCF\u0DB4\u0DB1\u0DBA \u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DBD\u0DBA: 0.85 - 1.05

2. \u0DC0\u0DD9\u0DB1\u0DAD\u0DCA \u0D9A\u0DCA\u0DC2\u0DDA\u0DAD\u0DCA\u200D\u0DBB\u0DC0\u0DBD \u0D8B\u0DB4\u0DCF\u0DB0\u0DD2 \u0DB4\u0DCF\u0DA8\u0DB8\u0DCF\u0DBD\u0DCF:
\u0DAD\u0DDC\u0DBB\u0DAD\u0DD4\u0DBB\u0DD4 \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DBA:
Information Technology (IT - \u0DB8\u0DDC\u0DBB\u0DA7\u0DD4\u0DC0): 1.55 - 1.75
Information Systems (\u0D9A\u0DDC\u0DC5\u0DB9 UCSC \u0DC3\u0DC4 \u0DA2\u0DB4\u0DD4\u0DBB): 1.45 - 1.65
Information Communication Technology (BICT Hons): 1.15 - 1.35 (\u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DBD\u0DBA \u0D85\u0DB1\u0DD4\u0DC0 \u0DC0\u0DD9\u0DB1\u0DC3\u0DCA \u0DC0\u0DDA)
`;
  const promptText = `Analyze the student's lesson completion data across all subjects (SFT, ET, ICT).
Here is their logged student metrics and checklist performance:
${JSON.stringify(data, null, 2)}

Here is the syllabus containing the maximum "mcqMax" counts possible for each lesson:
${JSON.stringify(syllabus, null, 2)}

Here are standard University Z-score targets for Engineering Technology:
${uniZScores}

You are an advanced AI Progress Optimizer & Advisor. Act as a friendly campus advanced student / undergraduate in Sri Lanka who has already passed the A/L exams. Relate to the user as a peer (\u0D85\u0DBA\u0DD2\u0DBA\u0DCF/\u0D85\u0D9A\u0DCA\u0D9A\u0DCF) giving practical advice. Do NOT act like a professor or tutor. Address the user friendly and warmly.

${historyPrompt}

Structure for first message strategy generation (if history is empty):
1. **Z-Score \u0DC3\u0DC4 Rank \u0D89\u0DBD\u0D9A\u0DCA\u0D9A\u0DBA (Z-Score & Rank Target)**: Estimate what Island Rank, District Rank, and Z-Score they are predicting right now, and which Universities/Degrees they can reach.
2. **\u0D89\u0DC4\u0DC5\u0DB8 MCQ \u0D87\u0DAD\u0DD2 \u0DB4\u0DCF\u0DA9\u0DB8\u0DCA (High-Yield MCQ Lessons)**: Identify specific lessons with high MCQ maximum counts in the syllabus that the user hasn't fully completed, showing them which topics can boost their score fastest.
3. **\u0DB8\u0DD9\u0DC4\u0DD9\u0DBA\u0DD4\u0DB8\u0DCA \u0DC3\u0DD0\u0DBD\u0DD0\u0DC3\u0DCA\u0DB8 (Action Plan)**: Practical step-by-step game plan.
4. **\u0DC3\u0DD4\u0DC4\u0DAF \u0DB4\u0DAB\u0DD2\u0DC0\u0DD2\u0DA9\u0DBA (Friendly Note)**: A motivating closing message from a campus senior.

Provide response in gorgeous Raw Markdown. Write predominantly in Sinhala.
CRUCIAL: To make this advice highly interactive, formulate exactly 3 custom, highly relevant helpful Sinhala reply suggestions that the user can click next in their interface. You MUST place these suggestions at the absolute end of your response, formatted EXACTLY inside double pipes and preceded by SUGGESTIONS:, like this:
||SUGGESTIONS: ["\u0D8A\u0DC5\u0D9F\u0DA7 \u0DB8\u0DCF \u0D9A\u0DC5 \u0DBA\u0DD4\u0DAD\u0DCA\u0DAD\u0DDA \u0D9A\u0DD4\u0DB8\u0D9A\u0DCA\u0DAF?", "SFT \u0DC3\u0DB3\u0DC4\u0DCF \u0DB4\u0DCF\u0DA9\u0DB8\u0DCA \u0DC3\u0DD0\u0DBD\u0DD0\u0DC3\u0DCA\u0DB8 \u0DAF\u0DD9\u0DB1\u0DD4 \u0DB8\u0DD0\u0DB1\u0DC0.", "Z-score \u0D91\u0D9A 2.800 \u0DAF\u0D9A\u0DCA\u0DC0\u0DCF \u0DC0\u0DD0\u0DA9\u0DD2 \u0D9A\u0DBB\u0D9C\u0DB1\u0DCA\u0DB1\u0DDA \u0D9A\u0DD9\u0DC3\u0DDA\u0DAF?"]||

Ensure the suggestions are grammatically correct, friendly, and brief. Do not output other text after the suggestions line.`;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  try {
    const ai2 = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });
    res.write(`data: ${JSON.stringify({ text: "[STATUS: Activating Inner Analytical Engine...]\n" })}

`);
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
    const tryModelsThinking = ["gemini-1.5-flash", "gemini-2.5-flash", "gemini-1.5-pro", "gemini-2.5-flash-lite"];
    let thinkingResponse = null;
    let lastThinkingError = null;
    for (const m of tryModelsThinking) {
      try {
        thinkingResponse = await ai2.models.generateContent({
          model: m,
          contents: thinkingPromptText,
          config: { temperature: 0.2 }
        });
        break;
      } catch (e) {
        lastThinkingError = e;
        console.warn(`Lesson optimizer thinking failed on model \${m}:`, e.status || e.message);
      }
    }
    if (!thinkingResponse) {
      throw lastThinkingError;
    }
    const finalizedData = thinkingResponse.text || "No analysis generated.";
    res.write(`data: ${JSON.stringify({ text: "[STATUS: Core data finalized. Passing to presentation model...]\n" })}

`);
    const finalPromptText = `You are an advanced AI Progress Optimizer & Advisor. Act as a friendly campus advanced student / undergraduate in Sri Lanka who has already passed the A/L exams. Relate to the user as a peer (\u0D85\u0DBA\u0DD2\u0DBA\u0DCF/\u0D85\u0D9A\u0DCA\u0D9A\u0DCF) giving practical advice.

Here is the finalized analytical thinking data from the deep analysis engine:
<analysis_data>
${finalizedData}
</analysis_data>

${historyPrompt}

Structure your response clearly:
1. **\u0DC0\u0DD2\u0DC2\u0DBA \u0D85\u0DB1\u0DD4\u0DC0 \u0DBD\u0D9A\u0DD4\u0DAB\u0DD4 \u0DC3\u0DC4 Z-Score (Subject-wise Lesson Marks & Z-Scores)**: Show the student's current Z-Scores and specific lesson marks for SFT, ET, and ICT based on the analysis.
2. **z-score \u0DC0\u0DD0\u0DA9\u0DD2 \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8\u0DDA \u0DAF\u0DDB\u0DB1\u0DD2\u0D9A \u0DC3\u0DD0\u0DBD\u0DD0\u0DC3\u0DCA\u0DB8 (Day-by-Day Z-Score Lesson Plan)**: Present a full day-by-day action plan highlighting specific lessons to focus on based on Z-Score boosting priorities. Give specific daily targets to start until A/Ls.
3. **\u0D94\u0DB6\u0DDA \u0D85\u0DC0\u0DC1\u0DCA\u200D\u0DBA\u0DAD\u0DCF\u0DC0\u0DBA \u0DC3\u0DC4 \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DCF\u0DC0\u0DBD\u0DD2\u0DBA (Quick Quiz / Your Requirements)**: Ask interactive quiz questions or questions regarding their requirements based on the analysis context.

Provide response in gorgeous Raw Markdown. Write predominantly in Sinhala.
CRUCIAL: To make this advice highly interactive, formulate exactly 3 custom, highly relevant helpful Sinhala reply suggestions that the user can click next in their interface. You MUST place these suggestions at the absolute end of your response, formatted EXACTLY inside double pipes and preceded by SUGGESTIONS:, like this:
||SUGGESTIONS: ["suggestion 1", "suggestion 2", "suggestion 3"]||

Ensure the suggestions are grammatically correct, friendly, and brief. Do not output other text after the suggestions line.`;
    const tryModelsFinal = ["gemini-1.5-flash", "gemini-2.5-flash", "gemini-1.5-pro", "gemini-2.5-flash-lite"];
    let responseStream = null;
    let lastFinalError = null;
    for (const m of tryModelsFinal) {
      try {
        responseStream = await ai2.models.generateContentStream({
          model: m,
          contents: finalPromptText,
          config: { temperature: 0.7 }
        });
        break;
      } catch (e) {
        lastFinalError = e;
        console.warn(`Lesson optimizer final failed on model \${m}:`, e.status || e.message);
      }
    }
    if (!responseStream) {
      throw lastFinalError;
    }
    for await (const chunk of responseStream) {
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}

`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Failed to generate lesson optimizer stream:", error);
    res.write(`data: ${JSON.stringify({ text: "\n# Stream Failed\nCould not connect to AI. Please try again." })}

`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});
