import fs from 'fs';
let code = fs.readFileSync('server/firebase/userContext.ts', 'utf-8');

// I will insert the ZScore logic right before `const contextData = {`

const zscoreLogic = `
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
                    appData?.targetZScore ?? appData?.targetZ ?? appData?.zTarget;
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
    if (flatSubjZ.sft || flatSubjZ.et || flatSubjZ.ict) {
       zScoreContext.subjectZScores = {
         sft: flatSubjZ.sft ? Number(flatSubjZ.sft) : undefined,
         et: flatSubjZ.et ? Number(flatSubjZ.et) : undefined,
         ict: flatSubjZ.ict ? Number(flatSubjZ.ict) : undefined,
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
          sft: r.sft ?? r.sftZ,
          et: r.et ?? r.etZ,
          ict: r.ict ?? r.ictZ,
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
          if (!zScoreContext.latestOverallZScore || (latestHist.date && new Date(latestHist.date).getTime() > 0)) {
             zScoreContext.latestOverallZScore = latestHist.overall;
             zScoreContext.latestUpdatedAt = latestHist.date;
             
             if (!zScoreContext.subjectZScores && (latestHist.sft || latestHist.et || latestHist.ict)) {
                zScoreContext.subjectZScores = {
                   sft: latestHist.sft,
                   et: latestHist.et,
                   ict: latestHist.ict
                };
             }
          }
       }
    }

    if (zScoreContext.targetZScore !== undefined && zScoreContext.latestOverallZScore !== undefined) {
       zScoreContext.gapToTarget = Number((zScoreContext.targetZScore - zScoreContext.latestOverallZScore).toFixed(4));
    }
    // ----------------------------------------------------------------------
`;

code = code.replace(/const contextData = \{/, zscoreLogic + '    const contextData = {');
code = code.replace(/targetZ: appData\?\.targetZ \|\| profileData\?\.targetZ,/, 'targetZ: appData?.targetZ || profileData?.targetZ,\n      zScoreContext,');

fs.writeFileSync('server/firebase/userContext.ts', code);
