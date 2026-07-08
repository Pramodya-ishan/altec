import { SYLLABUS } from "../../src/constants/syllabus";
import { pastPapersData } from "../../src/data/pastPapersData";
import { getAdminDb } from "../firebase/admin";

export type KnowledgeChunk = {
  title: string;
  subject?: string;
  topic?: string;
  type: "syllabus" | "past_paper" | "note" | "firebase_progress" | "notebooklm" | "web";
  url?: string;
  text: string;
  score: number;
};

type RetrieveParams = {
  prompt: string;
  activeSubject?: string;
  mode?: string;
  limit?: number;
  uid?: string;
  email?: string;
  userContext?: any;
};

function tokens(value: string) {
  return new Set(
    String(value || "")
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length >= 2)
  );
}

function scoreText(promptTokens: Set<string>, text: string, subject?: string, activeSubject?: string) {
  const lower = String(text || "").toLowerCase();
  let score = 0;
  promptTokens.forEach((token) => {
    if (lower.includes(token)) score += token.length > 3 ? 2 : 1;
  });
  if (activeSubject && subject && subject.toLowerCase() === activeSubject.toLowerCase()) score += 4;
  return score;
}

function addLocalSyllabusChunks(chunks: KnowledgeChunk[], promptTokens: Set<string>, activeSubject?: string) {
  Object.entries(SYLLABUS as any).forEach(([subject, def]: [string, any]) => {
    if (activeSubject && subject !== activeSubject) return;

    def.mcqItems?.forEach((item: any) => {
      const text = `Subject ${subject.toUpperCase()} MCQ syllabus ${item.q}: ${item.title}. Expected MCQ count: ${item.count || 1}.`;
      chunks.push({
        title: `${subject.toUpperCase()} ${item.q} ${item.title}`,
        subject,
        topic: item.title,
        type: "syllabus",
        text,
        score: scoreText(promptTokens, text, subject, activeSubject),
      });
    });

    const essayItems = [
      ...(def.partAItems || []).map((item: any) => ({ ...item, section: "Part A" })),
      ...(def.partBCDItems || []).map((item: any) => ({ ...item, section: "Essay" })),
      ...((def.bcdGroups || []).flatMap((group: any) => (group.items || []).map((item: any) => ({ ...item, section: group.label })))),
    ];

    essayItems.forEach((item: any) => {
      const topics = (item.topics || [item.title]).join(", ");
      const text = `Subject ${subject.toUpperCase()} ${item.section} ${item.q}: ${item.subTitle || item.title}. Topics: ${topics}. Max marks: ${item.max || "not set"}.`;
      chunks.push({
        title: `${subject.toUpperCase()} ${item.section} ${item.q}`,
        subject,
        topic: topics,
        type: "syllabus",
        text,
        score: scoreText(promptTokens, text, subject, activeSubject),
      });
    });
  });
}

function addUserContextChunks(chunks: KnowledgeChunk[], promptTokens: Set<string>, context: any, activeSubject?: string) {
  context?.recentProgress?.forEach((item: any) => {
    const text = `${item.subject?.toUpperCase()} progress: ${item.completedTopics}/${item.totalTopics} lessons completed (${item.coveragePercent}%).`;
    chunks.push({
      title: `${item.subject?.toUpperCase()} progress summary`,
      subject: item.subject,
      type: "firebase_progress",
      text,
      score: scoreText(promptTokens, text, item.subject, activeSubject) + 3,
    });
  });

  context?.weakLessons?.slice(0, 20).forEach((lesson: any) => {
    const text = `${lesson.subject?.toUpperCase()} weak/incomplete lesson: ${lesson.topic || lesson.lesson}. Reason: ${lesson.reason || "not recorded"}. Priority weight: ${lesson.priorityWeight || 1}. Last status: ${lesson.lastDoneStatus || "unknown"}.`;
    chunks.push({
      title: `${lesson.subject?.toUpperCase()} weak lesson ${lesson.topic || lesson.lesson}`,
      subject: lesson.subject,
      topic: lesson.topic || lesson.lesson,
      type: "firebase_progress",
      text,
      score: scoreText(promptTokens, text, lesson.subject, activeSubject) + (lesson.priorityWeight || 1),
    });
  });

  context?.paperMarks?.slice(-20).forEach((mark: any) => {
    const text = `${mark.subject?.toUpperCase()} paper mark: ${mark.title || "untitled"} total ${mark.total ?? "unknown"}, MCQ ${mark.mcq ?? mark.mcqRaw ?? "unknown"}, essay ${mark.essay ?? "unknown"}, grade ${mark.grade || "unknown"}.`;
    chunks.push({
      title: `${mark.subject?.toUpperCase()} mark ${mark.title || ""}`.trim(),
      subject: mark.subject,
      type: "firebase_progress",
      text,
      score: scoreText(promptTokens, text, mark.subject, activeSubject) + 2,
    });
  });

  const appData = context?.appData;
  if (!appData) return;
  ["sft", "et", "ict"].forEach((subject) => {
    if (activeSubject && activeSubject !== subject) return;
    const topics = appData[subject]?.topics || {};
    Object.entries(topics).forEach(([topic, data]: [string, any]) => {
      const notes = String(data?.notes || "").trim();
      if (!notes) return;
      const text = `${subject.toUpperCase()} user note for ${topic}: ${notes.slice(0, 1200)}`;
      chunks.push({
        title: `${subject.toUpperCase()} note ${topic}`,
        subject,
        topic,
        type: "note",
        text,
        score: scoreText(promptTokens, text, subject, activeSubject) + 5,
      });
    });
  });
}

function addPastPaperChunks(chunks: KnowledgeChunk[], promptTokens: Set<string>, activeSubject?: string) {
  (pastPapersData.papers || []).forEach((paper: any) => {
    const subject = paper.metadata?.subjectKey || "";
    if (activeSubject && subject !== activeSubject) return;
    const answers = (paper.answers || []).slice(0, 50).map((item: any) => `Q${item.question}:${item.answer}`).join(", ");
    const text = `${paper.metadata?.exam} ${paper.metadata?.subject} ${paper.metadata?.medium || ""} MCQ answer key. Answers: ${answers}`;
    chunks.push({
      title: `${paper.metadata?.exam} ${paper.metadata?.subject} answer key`,
      subject,
      type: "past_paper",
      url: `/api/past-papers/local/${subject}/${String(paper.metadata?.exam || "").match(/\b(20\d{2}|19\d{2})\b/)?.[1] || "unknown"}`,
      text,
      score: scoreText(promptTokens, text, subject, activeSubject),
    });
  });
}

async function addFirestoreChunks(chunks: KnowledgeChunk[], params: RetrieveParams, promptTokens: Set<string>) {
  const db = getAdminDb();
  const activeSubject = params.activeSubject;

  try {
    let query: any = db.collection("knowledge_chunks");
    if (activeSubject) query = query.where("subject", "==", activeSubject);
    const snap = await query.limit(60).get();
    snap.docs.forEach((doc: any) => {
      const data = doc.data();
      const text = String(data.text || data.content || data.summary || "");
      if (!text) return;
      chunks.push({
        title: data.title || data.sourceTitle || `Knowledge ${doc.id}`,
        subject: data.subject,
        topic: data.topic,
        type: data.type || "syllabus",
        url: data.url || data.sourceUrl,
        text: text.slice(0, 1800),
        score: scoreText(promptTokens, `${data.title || ""} ${data.topic || ""} ${text}`, data.subject, activeSubject) + (data.score || 0),
      });
    });
  } catch (e) {
    console.warn("knowledge_chunks retrieval failed:", e);
  }

  if (!params.uid) return;
  const refs = [
    db.collection("users").doc(params.uid),
    params.email ? db.collection("users").doc(params.email.toLowerCase()) : null,
  ].filter(Boolean);

  for (const ref of refs as any[]) {
    try {
      const notesSnap = await ref.collection("notes").limit(30).get();
      notesSnap.docs.forEach((doc: any) => {
        const data = doc.data();
        const text = String(data.text || data.content || data.notes || "");
        if (!text) return;
        chunks.push({
          title: data.title || `Saved note ${doc.id}`,
          subject: data.subject,
          topic: data.topic,
          type: "note",
          url: data.url,
          text: text.slice(0, 1200),
          score: scoreText(promptTokens, `${data.title || ""} ${data.topic || ""} ${text}`, data.subject, activeSubject) + 4,
        });
      });
    } catch (e) {
      console.warn("user notes retrieval failed:", e);
    }

    try {
      const filesSnap = await ref.collection("files").limit(30).get();
      filesSnap.docs.forEach((doc: any) => {
        const data = doc.data();
        const text = String(data.extractedText || data.summary || data.title || "");
        if (!text && !data.url) return;
        chunks.push({
          title: data.title || data.name || `Uploaded source ${doc.id}`,
          subject: data.subject,
          topic: data.topic,
          type: data.notebookLmUrl ? "notebooklm" : "web",
          url: data.notebookLmUrl || data.url || data.downloadURL,
          text: (text || "Uploaded file metadata; text was not extracted yet.").slice(0, 1200),
          score: scoreText(promptTokens, `${data.title || ""} ${data.topic || ""} ${text}`, data.subject, activeSubject) + 2,
        });
      });
    } catch (e) {
      console.warn("user files retrieval failed:", e);
    }
  }
}

export async function retrieveRelevantKnowledge(params: RetrieveParams): Promise<KnowledgeChunk[]> {
  const limit = Math.max(1, Math.min(params.limit || 8, 20));
  const promptTokens = tokens(`${params.prompt || ""} ${params.activeSubject || ""} ${params.mode || ""}`);
  const chunks: KnowledgeChunk[] = [];

  addLocalSyllabusChunks(chunks, promptTokens, params.activeSubject);
  addPastPaperChunks(chunks, promptTokens, params.activeSubject);
  addUserContextChunks(chunks, promptTokens, params.userContext, params.activeSubject);
  await addFirestoreChunks(chunks, params, promptTokens);

  const deduped = Array.from(new Map(chunks.map((chunk) => [`${chunk.type}:${chunk.title}:${chunk.url || ""}:${chunk.text.slice(0, 80)}`, chunk])).values());
  return deduped
    .map((chunk) => ({ ...chunk, score: chunk.score || 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
