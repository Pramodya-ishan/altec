import { SYLLABUS } from "../../src/constants/syllabus";
import { readUser } from "../data/userRepository";
import { getAdminDb } from "./admin";

const contextCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 10000;
const SUBJECTS = ["sft", "et", "ict"] as const;

function unwrapProgressDoc(value: any) {
  if (!value) return null;
  return value.data || value.appData || value;
}

function mergeDefined(...items: any[]) {
  return items.reduce((acc, item) => {
    if (item && typeof item === "object") {
      Object.assign(acc, item);
    }
    return acc;
  }, {} as any);
}

function collectSyllabusTopics(subject: string) {
  const def = (SYLLABUS as any)[subject];
  const topics = new Map<string, { count: number; refs: string[] }>();
  const add = (title: string, count = 1, ref = "") => {
    if (!title) return;
    const existing = topics.get(title) || { count: 0, refs: [] };
    existing.count += count || 1;
    if (ref) existing.refs.push(ref);
    topics.set(title, existing);
  };

  def?.mcqItems?.forEach((item: any) => add(item.title, item.count || 1, `MCQ ${item.q}`));
  def?.partAItems?.forEach((item: any) => {
    const weight = item.max || 1;
    (item.topics || [item.title]).forEach((topic: string) => add(topic, weight, `Part A ${item.q}`));
  });
  def?.partBCDItems?.forEach((item: any) => {
    const weight = item.max || 1;
    (item.topics || [item.title]).forEach((topic: string) => add(topic, weight, item.q));
  });
  def?.bcdGroups?.forEach((group: any) => {
    group.items?.forEach((item: any) => {
      const weight = item.max || 1;
      (item.topics || [item.title]).forEach((topic: string) => add(topic, weight, `${group.label} ${item.q}`));
    });
  });

  return topics;
}

function scoreFromQuestionMark(mark: any) {
  const values = [mark?.total, mark?.mcqRaw, mark?.partARaw, mark?.partBcdRaw, mark?.mcqPer, mark?.partAPer, mark?.partBcdPer]
    .filter((value) => typeof value === "number");
  if (typeof mark?.total === "number") return mark.total;
  if (values.length) return values.reduce((sum, value) => sum + value, 0);
  return 0;
}

function buildProgressFromAppData(appData: any) {
  const weakMap = new Map<string, any>();
  const recentProgress: any[] = [];
  const latestMarks: any[] = [];
  const paperMarks: any[] = [];
  const questionMarks: any[] = [];
  const lessonHistory: any[] = [];

  for (const subject of SUBJECTS) {
    const subjectData = appData?.[subject] || {};
    const topics = subjectData.topics || {};
    const syllabusTopics = collectSyllabusTopics(subject);
    const allTopicNames = new Set([...Object.keys(topics), ...syllabusTopics.keys()]);
    const completedTopics = [...allTopicNames].filter((topic) => topics[topic]?.checked);

    recentProgress.push({
      subject,
      totalTopics: allTopicNames.size,
      completedTopics: completedTopics.length,
      coveragePercent: allTopicNames.size > 0 ? Math.round((completedTopics.length / allTopicNames.size) * 100) : 0,
    });

    (subjectData.lessonHistory || []).forEach((item: any) => {
      lessonHistory.push({ ...item, subject });
    });

    (subjectData.paperMarks || []).forEach((mark: any) => {
      const normalized = { ...mark, subject };
      paperMarks.push(normalized);
      latestMarks.push(normalized);
    });

    Object.entries(subjectData.questionMarks || {}).forEach(([topic, marks]) => {
      (Array.isArray(marks) ? marks : []).forEach((mark: any) => {
        const normalized = { ...mark, subject, topic };
        questionMarks.push(normalized);
        const score = scoreFromQuestionMark(mark);
        if (score > 0 && score < 45) {
          const key = `${subject}:${topic}`;
          weakMap.set(key, {
            subject,
            topic,
            lesson: topic,
            reason: `Low question score (${score})${mark?.title ? ` on ${mark.title}` : ""}`,
            priorityWeight: Math.max(syllabusTopics.get(topic)?.count || 1, 1),
            marksWeakness: true,
            lastDoneStatus: topics[topic]?.checked ? "completed" : "incomplete",
          });
        }
      });
    });

    allTopicNames.forEach((topic) => {
      const topicInfo = topics[topic] || {};
      const syllabus = syllabusTopics.get(topic);
      const key = `${subject}:${topic}`;
      const notes = String(topicInfo.notes || "");
      const weakKeywords = [
        "hard", "difficult", "fail", "forget", "weak", "revise", "doubt", "wrong",
        "problem", "amaru", "baha", "patalila", "puluwan na", "mathaka na", "patali",
      ];
      const weakNote = weakKeywords.find((kw) => notes.toLowerCase().includes(kw));

      if (weakNote) {
        weakMap.set(key, {
          ...(weakMap.get(key) || {}),
          subject,
          topic,
          lesson: topic,
          reason: `User note indicates weakness: ${notes.slice(0, 160)}`,
          notes,
          priorityWeight: Math.max(syllabus?.count || 1, 1),
          lastDoneStatus: topicInfo.checked ? "completed" : "incomplete",
        });
      }

      if (!topicInfo.checked && syllabus && syllabus.count >= 2) {
        weakMap.set(key, {
          ...(weakMap.get(key) || {}),
          subject,
          topic,
          lesson: topic,
          reason: weakMap.get(key)?.reason || "Incomplete high-weight syllabus topic",
          priorityWeight: Math.max(syllabus.count, 1),
          lastDoneStatus: "incomplete",
          syllabusRefs: syllabus.refs.slice(0, 5),
        });
      }
    });
  }

  const zHistory = Array.isArray(appData?.zScoreHistory) ? appData.zScoreHistory : [];
  const latestZEntry = zHistory[zHistory.length - 1] || null;

  return {
    weakLessons: [...weakMap.values()].sort((a, b) => (b.priorityWeight || 0) - (a.priorityWeight || 0)).slice(0, 25),
    recentProgress,
    latestMarks: latestMarks.slice(-15),
    paperMarks,
    questionMarks,
    lessonHistory,
    latestZ: latestZEntry?.zScore ?? appData?.latestZScore ?? appData?.currentZScore ?? null,
    subjectZScores: latestZEntry?.subjectZScores || appData?.subjectZScores || null,
  };
}

export async function loadUserAIContext(uid: string, email?: string) {
  const normalizedEmail = email?.toLowerCase();
  const cacheKey = `${uid}_${normalizedEmail || ""}`;
  const now = Date.now();
  const cached = contextCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const diagnostics: any = {
    uid,
    email: normalizedEmail || null,
    oldPathFound: false,
    newPathFound: false,
    localExportFound: false,
    migratedLegacyProgress: false,
    progressRecordsChecked: 0,
    lessonHistoryCount: 0,
    paperMarksCount: 0,
    questionMarksCount: 0,
  };

  try {
    const db = getAdminDb();
    const uidRef = db.collection("users").doc(uid);
    const emailRef = normalizedEmail ? db.collection("users").doc(normalizedEmail) : null;

    const [
      uidRoot,
      emailRoot,
      uidProfile,
      emailProfile,
      uidProgress,
      emailProgress,
      uidSettings,
      emailSettings,
    ] = await Promise.all([
      uidRef.get().catch(() => null),
      emailRef ? emailRef.get().catch(() => null) : null,
      uidRef.collection("profile").doc("main").get().catch(() => null),
      emailRef ? emailRef.collection("profile").doc("info").get().catch(() => null) : null,
      uidRef.collection("progress").doc("data").get().catch(() => null),
      emailRef ? emailRef.collection("progress").doc("data").get().catch(() => null) : null,
      uidRef.collection("settings").doc("main").get().catch(() => null),
      emailRef ? emailRef.collection("settings").doc("main").get().catch(() => null) : null,
    ]);

    diagnostics.newPathFound = Boolean(uidRoot?.exists || uidProfile?.exists || uidProgress?.exists);
    diagnostics.oldPathFound = Boolean(emailRoot?.exists || emailProfile?.exists || emailProgress?.exists);

    const uidProgressData = uidProgress?.exists ? unwrapProgressDoc(uidProgress.data()) : null;
    const emailProgressData = emailProgress?.exists ? unwrapProgressDoc(emailProgress.data()) : null;
    const uidRootData = uidRoot?.exists ? uidRoot.data() : null;
    const emailRootData = emailRoot?.exists ? emailRoot.data() : null;

    let appData = uidProgressData
      || emailProgressData
      || uidRootData?.appData
      || uidRootData?.data
      || emailRootData?.appData
      || emailRootData?.data;

    if (!appData && normalizedEmail) {
      const localUser = readUser(normalizedEmail);
      appData = localUser?.data || localUser?.appData || null;
      diagnostics.localExportFound = Boolean(appData);
    }

    if (!uidProgressData && emailProgressData) {
      await uidRef.collection("progress").doc("data").set({
        data: emailProgressData,
        migratedFromEmail: normalizedEmail,
        migratedAt: new Date().toISOString(),
      }, { merge: true }).catch(() => null);
      diagnostics.migratedLegacyProgress = true;
    }

    const profileData = mergeDefined(
      emailRootData,
      emailProfile?.exists ? emailProfile.data() : null,
      uidRootData,
      uidProfile?.exists ? uidProfile.data() : null,
    );

    if (normalizedEmail && uidProfile && !uidProfile.exists && (emailProfile?.exists || profileData.email || profileData.username)) {
      await uidRef.collection("profile").doc("main").set({
        ...profileData,
        email: normalizedEmail,
        migratedFromEmail: normalizedEmail,
        migratedAt: new Date().toISOString(),
      }, { merge: true }).catch(() => null);
    }

    const parsed = buildProgressFromAppData(appData);
    diagnostics.progressRecordsChecked = parsed.recentProgress.length;
    diagnostics.lessonHistoryCount = parsed.lessonHistory.length;
    diagnostics.paperMarksCount = parsed.paperMarks.length;
    diagnostics.questionMarksCount = parsed.questionMarks.length;

    const [memoryUid, memoryEmail, chatUid, chatEmail] = await Promise.all([
      uidRef.collection("ai_memory").limit(20).get().catch(() => ({ docs: [] })),
      emailRef ? emailRef.collection("ai_memory").limit(20).get().catch(() => ({ docs: [] })) : { docs: [] },
      uidRef.collection("chat_history").orderBy("createdAt", "desc").limit(15).get().catch(() => ({ docs: [] })),
      emailRef ? emailRef.collection("chat_history").orderBy("createdAt", "desc").limit(15).get().catch(() => ({ docs: [] })) : { docs: [] },
    ]);

    const memoryDocs = [...(memoryUid as any).docs, ...(memoryEmail as any).docs];
    const chatDocs = [...(chatUid as any).docs, ...(chatEmail as any).docs];

    const contextData = {
      profile: {
        uid,
        name: profileData?.name || profileData?.username || profileData?.displayName || (normalizedEmail ? normalizedEmail.split("@")[0] : "Student"),
        email: normalizedEmail || profileData?.email,
        stream: profileData?.stream || "G.C.E. A/L Technology",
        district: profileData?.district || "Unknown",
      },
      preferences: mergeDefined(emailSettings?.exists ? emailSettings.data() : null, uidSettings?.exists ? uidSettings.data() : null, profileData?.preferences),
      appData,
      latestMarks: parsed.latestMarks,
      paperMarks: parsed.paperMarks,
      questionMarks: parsed.questionMarks,
      lessonHistory: parsed.lessonHistory.slice(-30),
      weakLessons: parsed.weakLessons,
      recentProgress: parsed.recentProgress,
      latestZ: parsed.latestZ,
      subjectZScores: parsed.subjectZScores,
      aiMemory: Array.from(new Map(memoryDocs.map((doc: any) => [doc.id, doc.data()])).values()),
      chatHistoryLast10: Array.from(new Map(chatDocs.map((doc: any) => [doc.id, { id: doc.id, ...doc.data() }])).values())
        .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .slice(-10),
      examDates: profileData?.examDates || {},
      targetZ: appData?.targetZScore ?? appData?.targetZ ?? profileData?.targetZScore ?? profileData?.targetZ ?? null,
      currentTimeAsiaColombo: new Date().toLocaleString("en-US", { timeZone: process.env.APP_TIME_ZONE || "Asia/Colombo" }),
      diagnostics,
    };

    contextCache.set(cacheKey, { data: contextData, timestamp: now });
    return contextData;
  } catch (e) {
    console.error("loadUserAIContext error", e);
    return {
      profile: { uid, name: "Student", email: normalizedEmail },
      preferences: {},
      appData: null,
      latestMarks: [],
      paperMarks: [],
      questionMarks: [],
      lessonHistory: [],
      weakLessons: [],
      recentProgress: [],
      latestZ: null,
      subjectZScores: null,
      aiMemory: [],
      chatHistoryLast10: [],
      examDates: {},
      currentTimeAsiaColombo: new Date().toLocaleString("en-US", { timeZone: "Asia/Colombo" }),
      diagnostics,
    };
  }
}
