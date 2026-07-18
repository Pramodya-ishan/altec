import { readUser, syncUserFromFirestore } from "../data/userRepository";
import { getAdminDb } from "./admin";
import { buildExamScorePrediction } from "../../src/lib/scoreUtils";

const contextCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 10000; // 10 seconds cache to be responsive to changes

export async function loadUserAIContext(uid: string, email?: string) {
  const cacheKey = `${uid}_${email || ""}`;
  const now = Date.now();
  const cached = contextCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const db = getAdminDb();
    
    // 1. References for dual-path reading
    const userUidRef = db.collection("users").doc(uid);
    const userEmailRef = email ? db.collection("users").doc(email.toLowerCase()) : null;

    // 2. Fetch root, profile, and progress snapshots in one network round-trip.
    const [uidSnap, emailSnap, uidProfileSnap, emailProfileSnap, uidProg, emailProg] = await Promise.all([
      userUidRef.get().catch(() => null),
      userEmailRef ? userEmailRef.get().catch(() => null) : null,
      userUidRef.collection("profile").doc("main").get().catch(() => null),
      userEmailRef ? userEmailRef.collection("profile").doc("main").get().catch(() => null) : null,
      userUidRef.collection("progress").doc("data").get().catch(() => null),
      userEmailRef ? userEmailRef.collection("progress").doc("data").get().catch(() => null) : null,
    ]);

    let profileData: any = {};
    if (emailSnap && emailSnap.exists) {
      profileData = { ...profileData, ...emailSnap.data() };
    }
    if (uidSnap && uidSnap.exists) {
      profileData = { ...profileData, ...uidSnap.data() };
    }
    if (emailProfileSnap && emailProfileSnap.exists) {
      profileData = { ...profileData, ...emailProfileSnap.data() };
    }
    if (uidProfileSnap && uidProfileSnap.exists) {
      profileData = { ...profileData, ...uidProfileSnap.data() };
    }
    
    // 2.5 LOAD FROM LOCAL DB EXPORT (OLD SCHEMA)
    let localDbData: any = null;
    if (email) {
      try {
        await syncUserFromFirestore(email);
        localDbData = readUser(email);
        if (localDbData && Object.keys(localDbData).length > 0) {
          if (localDbData.profile) profileData = { ...localDbData.profile, ...profileData };
        }
      } catch (e) {
        console.warn("Failed to read local user data:", e);
      }
    }

    // 3. Extract AppData
    let appData: any = null;
    let loadedFrom = "none";
    
    // 1. Canonical UID progress wins over root/legacy copies.
    if (uidProg && uidProg.exists) {
      const p = uidProg.data();
      appData = p?.data || p;
      loadedFrom = "uid_progress_data";
    } else if (emailProg && emailProg.exists) {
      const p = emailProg.data();
      appData = p?.data || p;
      loadedFrom = "email_progress_data";
    } else if (profileData.appData) {
      appData = profileData.appData;
      loadedFrom = "root_appData";
    } else if (profileData.data) {
      appData = profileData.data;
      loadedFrom = "root_data";
    }

    // 2. Local DB Fallback
    if (!appData && localDbData && (localDbData.data || localDbData.appData)) {
      appData = localDbData.data || localDbData.appData;
      loadedFrom = "local_db_fallback";
    }

    // 4. Fetch memory and chat history from both paths (uniquely merged)
    const [memoryUid, memoryEmail] = await Promise.all([
      userUidRef.collection("ai_memory").limit(20).get().catch(() => ({ docs: [] })),
      userEmailRef ? userEmailRef.collection("ai_memory").limit(20).get().catch(() => ({ docs: [] })) : { docs: [] }
    ]);

    const [chatUid, chatEmail] = await Promise.all([
      userUidRef.collection("chat_history").orderBy("createdAt", "desc").limit(15).get().catch(() => ({ docs: [] })),
      userEmailRef ? userEmailRef.collection("chat_history").orderBy("createdAt", "desc").limit(15).get().catch(() => ({ docs: [] })) : { docs: [] }
    ]);

    const [mistakeSnapshot, weakPointSnapshot, commonSignalSnapshot] = await Promise.all([
      userUidRef.collection("mistake_notebook").orderBy("updatedAt", "desc").limit(30).get().catch(() => ({ docs: [] } as any)),
      userUidRef.collection("weak_points").orderBy("updatedAt", "desc").limit(30).get().catch(() => ({ docs: [] } as any)),
      db.collection("learning_signal_aggregates").orderBy("count", "desc").limit(12).get().catch(() => ({ docs: [] } as any)),
    ]);
    const recentMistakes = (mistakeSnapshot as any).docs.map((document: any) => ({ id: document.id, ...document.data() }));
    const learnedWeakPoints = (weakPointSnapshot as any).docs.map((document: any) => ({ id: document.id, ...document.data() }));
    const commonLearningSignals = (commonSignalSnapshot as any).docs.map((document: any) => ({ id: document.id, ...document.data() }));

    // Merge unique docs
    const memoryDocs = [...(memoryUid as any).docs, ...(memoryEmail as any).docs];
    const aiMemory = Array.from(new Map(memoryDocs.map(d => [d.id, d.data()])).values());

    const chatDocs = [...(chatUid as any).docs, ...(chatEmail as any).docs];
    const chatHistoryLast10 = Array.from(new Map(chatDocs.map(d => [d.id, d.data()])).values())
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-10);

    // 5. Parse AppData to find weak lessons and progress summary
    const weakLessons: any[] = [];
    const progressSummary: any[] = [];

    if (appData) {
      for (const subject of ['sft', 'et', 'ict'] as const) {
        const subjectData = appData[subject];
        if (!subjectData) continue;

        const topics = subjectData.topics || {};
        const topicKeys = Object.keys(topics);
        const checkedKeys = topicKeys.filter(k => topics[k]?.checked);
        const totalCount = topicKeys.length;
        const checkedCount = checkedKeys.length;
        const percent = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

        const completedLessonNames = checkedKeys;
        const pendingLessonNames = topicKeys.filter(k => !topics[k]?.checked);
        progressSummary.push({
          subject,
          totalTopics: totalCount,
          completedTopics: checkedCount,
          coveragePercent: percent,
          completedLessonNames,
          pendingLessonNames
        });

        // Extract weak lessons
        topicKeys.forEach(topicName => {
          const topicInfo = topics[topicName];
          if (!topicInfo) return;

          let isWeak = false;
          let reason = "";

          // Check notes
          if (topicInfo.notes) {
            const notesLower = topicInfo.notes.toLowerCase();
            const weakKeywords = [
              "hard", "difficult", "fail", "forget", "weak", "revise", "doubt", "wrong", 
              "problem", "amaru", "baha", "patalila", "puluwan na", "mathaka na", "epawa",
              "patali", "vadiyen", "karanna oni", "amaruida"
            ];
            const foundKeyword = weakKeywords.find(kw => notesLower.includes(kw));
            if (foundKeyword) {
              isWeak = true;
              reason = `User noted: "${topicInfo.notes}"`;
            }
          }

          // Check low score in question marks
          const qMarks = subjectData.questionMarks?.[topicName] || [];
          if (qMarks.length > 0) {
            qMarks.forEach((q: any) => {
              const score = q.total !== undefined ? q.total : ((q.mcqRaw || 0) + (q.partARaw || 0) + (q.partBcdRaw || 0));
              if (score > 0 && score < 45) {
                isWeak = true;
                reason = `Low score (${score}) on question: "${q.title}"`;
              }
            });
          }

          if (isWeak) {
            weakLessons.push({
              subject,
              topic: topicName,
              reason,
              notes: topicInfo.notes || ""
            });
          }
        });
      }
    }

    const latestMarks = appData ? [
      ...(appData.sft?.paperMarks || []).map((m: any) => ({ ...m, subject: 'sft' })),
      ...(appData.et?.paperMarks || []).map((m: any) => ({ ...m, subject: 'et' })),
      ...(appData.ict?.paperMarks || []).map((m: any) => ({ ...m, subject: 'ict' }))
    ] : [];

    
    // ----------------------------------------------------------------------
    // 1. Z-SCORE DATA LOADER
    // ----------------------------------------------------------------------
    const zScoreContext: any = {
      hasZScoreData: false,
      zScoreHistory: [],
      dataSources: [loadedFrom]
    };

    // Extract target Z-score
    const targetZ = profileData.targetZScore ?? profileData.targetZ ?? profileData.zTarget ??
                    profileData.profile?.targetZScore ?? profileData.profile?.targetZ ??
                    (uidProg && uidProg.exists ? uidProg.data()?.targetZScore ?? uidProg.data()?.data?.targetZ : undefined) ??
                    (emailProg && emailProg.exists ? emailProg.data()?.targetZScore ?? emailProg.data()?.data?.targetZ : undefined) ??
                    appData?.targetZScore ?? appData?.targetZ ?? appData?.zTarget ?? appData?.profile?.targetZ;
    if (targetZ !== undefined && targetZ !== null) {
       zScoreContext.targetZScore = Number(targetZ);
       zScoreContext.hasZScoreData = true;
    }

    // Extract current/estimated Z-score from flat fields
    let currentZ = profileData.estimatedZScore ?? profileData.currentZScore ?? profileData.zScore ?? profileData.overallZScore ?? profileData.predictedZScore ?? profileData.latestZScore ?? profileData.latestEstimate ?? profileData.latestResult ??
                   appData?.estimatedZScore ?? appData?.currentZScore ?? appData?.zScore ?? appData?.overallZScore ?? appData?.predictedZScore ?? appData?.latestZScore ?? appData?.latestEstimate ?? appData?.latestResult;

    if (currentZ !== undefined && currentZ !== null) {
       zScoreContext.latestOverallZScore = Number(currentZ);
       zScoreContext.hasZScoreData = true;
    }

    // Extract subjects
    const subjZ = profileData.subjectZScores ?? appData?.subjectZScores;
    const flatSubjZ = {
       sft: profileData.sftZ ?? appData?.sftZ ?? subjZ?.sft,
       et: profileData.etZ ?? appData?.etZ ?? subjZ?.et,
       ict: profileData.ictZ ?? appData?.ictZ ?? subjZ?.ict,
    };
    if ([flatSubjZ.sft, flatSubjZ.et, flatSubjZ.ict].some((value) => value !== undefined && value !== null)) {
       zScoreContext.subjectZScores = {
         sft: flatSubjZ.sft !== undefined && flatSubjZ.sft !== null ? Number(flatSubjZ.sft) : undefined,
         et: flatSubjZ.et !== undefined && flatSubjZ.et !== null ? Number(flatSubjZ.et) : undefined,
         ict: flatSubjZ.ict !== undefined && flatSubjZ.ict !== null ? Number(flatSubjZ.ict) : undefined,
       };
       zScoreContext.hasZScoreData = true;
    }

    // Ranks
    const ranks = profileData.rankEstimate ?? appData?.rankEstimate;
    const flatRanks = {
       districtRank: profileData.districtRank ?? appData?.districtRank ?? ranks?.districtRank,
       islandRank: profileData.islandRank ?? appData?.islandRank ?? ranks?.islandRank,
       district: profileData.district ?? appData?.district ?? ranks?.district,
    };
    if (flatRanks.districtRank || flatRanks.islandRank) {
       zScoreContext.rankEstimate = {
         districtRank: flatRanks.districtRank ? Number(flatRanks.districtRank) : undefined,
         islandRank: flatRanks.islandRank ? Number(flatRanks.islandRank) : undefined,
         district: flatRanks.district
       };
       zScoreContext.hasZScoreData = true;
    }

    // Extract history arrays
    let rawHistory = profileData.zScoreHistory ?? profileData.zHistory ?? profileData.predictions ?? profileData.admissionPrediction ??
                     appData?.zScoreHistory ?? appData?.zHistory ?? appData?.predictions ?? appData?.admissionPrediction;
    
    if (Array.isArray(rawHistory) && rawHistory.length > 0) {
       zScoreContext.zScoreHistory = rawHistory.map((r: any) => ({
          date: r.date ?? r.createdAt ?? r.timestamp,
          overall: r.overall ?? r.zScore ?? r.overallZScore,
          sft: r.sft ?? r.sftZ ?? r.subjectZScores?.sft,
          et: r.et ?? r.etZ ?? r.subjectZScores?.et,
          ict: r.ict ?? r.ictZ ?? r.subjectZScores?.ict,
          source: r.source ?? 'history_array'
       })).filter((r: any) => r.overall !== undefined);


       if (zScoreContext.zScoreHistory.length > 0) {
          zScoreContext.hasZScoreData = true;
          // Sort by date if available
          zScoreContext.zScoreHistory.sort((a:any, b:any) => {
             if (a.date && b.date) return new Date(a.date).getTime() - new Date(b.date).getTime();
             return 0;
          });
          const latestHist = zScoreContext.zScoreHistory[zScoreContext.zScoreHistory.length - 1];
          if (zScoreContext.latestOverallZScore === undefined || (latestHist.date && new Date(latestHist.date).getTime() > 0)) {
             zScoreContext.latestOverallZScore = latestHist.overall;
             zScoreContext.latestUpdatedAt = latestHist.date;
             
             if (!zScoreContext.subjectZScores && [latestHist.sft, latestHist.et, latestHist.ict].some((value) => value !== undefined && value !== null)) {
                zScoreContext.subjectZScores = {
                   sft: latestHist.sft,
                   et: latestHist.et,
                   ict: latestHist.ict
                };
             }
          }
       }
    }

    // Use the same Exam Score Predictor model as the UI. Preserve valid legacy
    // history instead of deleting the student's previous project timeline.
    const predictor = buildExamScorePrediction(appData || {});
    const predictorHistory = Array.isArray(appData?.zScoreHistory)
      ? appData.zScoreHistory
          .filter((entry: any) => Number.isFinite(Number(entry?.zScore ?? entry?.overall)))
          .map((entry: any) => ({
            date: entry.date,
            overall: Number(entry.zScore ?? entry.overall),
            sft: entry.subjectZScores?.sft,
            et: entry.subjectZScores?.et,
            ict: entry.subjectZScores?.ict,
            source: entry.calculationBasis || "legacy_exam_score_predictor",
            official: false,
          }))
      : [];
    zScoreContext.hasZScoreData = true;
    zScoreContext.calculationBasis = predictor.calculationBasis;
    zScoreContext.official = false;
    zScoreContext.complete = true;
    zScoreContext.reliability = "planning_estimate";
    zScoreContext.message = "Derived from the Exam Score Predictor syllabus-completion model.";
    zScoreContext.projectedMarks = predictor.projectedMarks;
    zScoreContext.rawPaperAverages = predictor.projectedMarks;
    zScoreContext.subjectZScores = predictor.subjectZScores;
    zScoreContext.zScoreHistory = predictorHistory;
    zScoreContext.latestOverallZScore = predictor.zScore;
    zScoreContext.rankEstimate = {
      districtRank: predictor.estimatedDistrictRank,
      islandRank: predictor.estimatedIslandRank,
      district: flatRanks.district,
      estimated: true,
    };
    const rawLatestPredictorDate = predictorHistory[predictorHistory.length - 1]?.date;
    const parsedLatestPredictorDate = new Date(String(rawLatestPredictorDate || ""));
    zScoreContext.latestUpdatedAt = Number.isFinite(parsedLatestPredictorDate.getTime())
      && parsedLatestPredictorDate.getFullYear() >= 2024
      && parsedLatestPredictorDate.getFullYear() <= new Date().getFullYear() + 1
      ? parsedLatestPredictorDate.toISOString()
      : new Date().toISOString();
    zScoreContext.gapToTarget = zScoreContext.targetZScore !== undefined
      ? Number((zScoreContext.targetZScore - predictor.zScore).toFixed(4))
      : undefined;
    // ----------------------------------------------------------------------
    const contextData = {
      loadedFrom,
      profile: {
        uid,
        name: profileData?.name || profileData?.username || profileData?.displayName || (email ? email.split('@')[0] : "Student"),
        email: email || profileData?.email,
        stream: profileData?.stream || "Technology",
        district: profileData?.district || "Unknown",
      },
      preferences: profileData?.preferences || {},
      latestMarks,
      weakLessons,
      recentProgress: progressSummary,
      aiMemory,
      chatHistoryLast10,
      recentMistakes,
      learnedWeakPoints,
      commonLearningSignals,
      examDates: profileData?.examDates || {},
      targetZ: zScoreContext.targetZScore,
      zScoreContext,
      currentTimeAsiaColombo: new Date().toLocaleString("en-US", {timeZone: process.env.APP_TIME_ZONE || "Asia/Colombo"})
    };

    contextCache.set(cacheKey, { data: contextData, timestamp: now });
    return contextData;
  } catch (e) {
    console.error("loadUserAIContext error", e);
    return {
      profile: { uid, name: "Student", email },
      preferences: {},
      latestMarks: [],
      weakLessons: [],
      recentProgress: [],
      aiMemory: [],
      chatHistoryLast10: [],
      recentMistakes: [],
      learnedWeakPoints: [],
      commonLearningSignals: [],
      examDates: {},
      currentTimeAsiaColombo: new Date().toLocaleString("en-US", {timeZone: "Asia/Colombo"})
    };
  }
}
