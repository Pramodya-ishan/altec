import fs from 'fs';
let content = fs.readFileSync('server/pastPapers/search.ts', 'utf8');

const oldFirestoreSearch = `    // Step 2: Firestore Search (from past_papers collection)
    try {
      let fRef: any = db.collection("past_papers");
      if (subjectMatch) {
        fRef = fRef.where("subject", "==", subjectMatch.toLowerCase());
      }
      if (yearMatch) {
        fRef = fRef.where("year", "==", yearMatch.toString());
      }
      
      const fSnap = await fRef.get();
      fSnap.docs.forEach((doc: any) => {
        const data = doc.data();
        const matchesSearch = !searchQuery || 
          data.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
          (data.year && data.year.toString().includes(searchQuery));
        
        if (matchesSearch) {
          sourceCards.push({
            source: "Firestore Storage",
            title: data.title,
            url: data.url,
            type: data.type || "PDF",
            snippet: \`\${data.year || ""} \${data.subject || ""} G.C.E. A/L past paper or marking scheme document uploaded to Clora storage.\`
          });
        }
      });
    } catch (e) {
      console.warn("Firestore past_papers query failed:", e);
    }`;

const newFirestoreSearch = `    // Step 2: Firestore Search (from ragSources collection)
    try {
      let fRef: any = db.collection("ragSources");
      if (subjectMatch) {
        fRef = fRef.where("subject", "==", subjectMatch.toLowerCase());
      }
      if (yearMatch) {
        fRef = fRef.where("year", "==", parseInt(yearMatch.toString(), 10));
      }
      
      const fSnap = await fRef.get();
      fSnap.docs.forEach((doc: any) => {
        const data = doc.data();
        if (data.sourceType !== 'past_paper' && data.sourceType !== 'marking_scheme') return;
        
        const matchesSearch = !searchQuery || 
          data.title.toLowerCase().includes(searchQuery.toLowerCase());
        
        if (matchesSearch) {
          sourceCards.push({
            source: "Knowledge Base",
            title: data.title,
            url: data.publicUrl || "#",
            type: data.sourceType === 'marking_scheme' ? 'Marking Scheme' : 'PDF',
            snippet: \`\${data.year || ""} \${data.subject || ""} G.C.E. A/L document. Status: \${data.status}.\`
          });
        }
      });
    } catch (e) {
      console.warn("Firestore ragSources query failed:", e);
    }`;

content = content.replace(oldFirestoreSearch, newFirestoreSearch);
fs.writeFileSync('server/pastPapers/search.ts', content);

// Now patch respondStream.ts to correctly use searchPastPapers result.
let respondStream = fs.readFileSync('server/ai/respondStream.ts', 'utf8');
const oldClarification = `      if (!subjectMatch) {
          const clarification = "🔍 කරුණාකර ඔබ සොයන ප්‍රශ්න පත්‍රයේ විෂය සඳහන් කරන්න. (SFT, ET, ICT අතරින් මොන subject එකද?)";
          sendSSE(res, "chunk", { text: clarification });
          await saveFinalChat({ uid: user.uid, email: user.email, userText: prompt, assistantText: clarification, mode: selectedMode, subject: activeSubject });
          sendSSE(res, "done", { ok: true, totalSeconds: Math.round((Date.now() - startedAt) / 1000), totalMs: Date.now() - startedAt });
          return;
      }`;
      
const newClarification = `      if (!subjectMatch) {
          const clarification = "🔍 කරුණාකර ඔබ සොයන ප්‍රශ්න පත්‍රයේ විෂය සඳහන් කරන්න. (SFT, ET, ICT අතරින් මොන subject එකද?)";
          sendSSE(res, "chunk", { text: clarification });
          await saveFinalChat({ uid: user.uid, email: user.email, userText: prompt, assistantText: clarification, mode: selectedMode, subject: activeSubject });
          sendSSE(res, "done", { ok: true, totalSeconds: Math.round((Date.now() - startedAt) / 1000), totalMs: Date.now() - startedAt });
          return;
      }`; // Kept the same as it correctly implements "ask if subject missing"

// Handle the response properly:
const searchResultHandling = `      if (searchResult?.sourceCards?.length > 0) {
        let markdown = \`\n\n**🔍 සොයාගත් ප්‍රශ්න පත්‍ර හා පිළිතුරු (Found Past Papers):**\n\n\`;
        searchResult.sourceCards.slice(0, 5).forEach((card: any, i: number) => {
          markdown += \`\${i + 1}. **[\${card.title}](\${card.url})** (\${card.type} - \${card.source})\n\`;
          if (card.snippet) markdown += \`   > \${card.snippet}\n\n\`;
        });
        
        markdown += \`\n\n*Note: Please verify the links before downloading.* \`;
        sendSSE(res, "chunk", { text: markdown });
        await saveFinalChat({ uid: user.uid, email: user.email, userText: prompt, assistantText: markdown, mode: selectedMode, subject: activeSubject });
        sendSSE(res, "done", { ok: true, totalSeconds: Math.round((Date.now() - startedAt) / 1000), totalMs: Date.now() - startedAt });
        return;
      } else {
        const notFoundText = "⚠️ මේ විෂයට සහ වර්ෂයට අදාළ past paper එකක් දැනට අපගේ Knowledge Base එකේ හෝ අන්තර්ජාලයෙන් සොයාගැනීමට නොමැත. කරුණාකර 'Knowledge Base' පිටුවට ගොස් ඔබේ PDF එක upload කරන්න.";
        sendSSE(res, "chunk", { text: notFoundText });
        await saveFinalChat({ uid: user.uid, email: user.email, userText: prompt, assistantText: notFoundText, mode: selectedMode, subject: activeSubject });
        sendSSE(res, "done", { ok: true, totalSeconds: Math.round((Date.now() - startedAt) / 1000), totalMs: Date.now() - startedAt });
        return;
      }`;
      
respondStream = respondStream.replace(/if \(searchResult\?\.sourceCards\?\.length > 0\) \{[\s\S]*?return;\n      \}/, searchResultHandling);

fs.writeFileSync('server/ai/respondStream.ts', respondStream);
