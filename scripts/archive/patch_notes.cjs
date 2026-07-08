const fs = require('fs');
let file = 'src/components/modals/NotesModal.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/const handleGenerateAI[\s\S]*?(?=const handleNotesChange)/, `
  const handleGenerateAI = async () => {
    if (!topic || isGenerating) return;
    setIsGenerating(true);
    try {
      const response = await fetch('/api/ai/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${auth?.currentUser ? await auth.currentUser.getIdToken() : ''}\`
        },
        body: JSON.stringify({
          prompt: \`Generate Sinhala exam-focused notes for \${currentSubject} lesson \${topic}. Use user's progress and retrieved sources. Include headings, definitions, formulas if relevant, exam tips, and recall questions.\`,
          activeSubject: currentSubject,
          mode: 'notes_generation'
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || \`Request failed (\${response.status})\`);
      }
      
      const data = await response.json();
      const generated = data.text || data.response;
      
      const newText = textNotes.trim() ? textNotes + '\\n\\n' + generated : generated;
      setTextNotes(newText);
      showNotification('Notes generated successfully', 'success');
      
      // Save it
      saveNotes(newText);
    } catch (error: any) {
      console.error(error);
      showNotification(error.message || "Failed to generate notes", 'error');
    } finally {
      setIsGenerating(false);
    }
  };
`);

content = content.replace(/const handleNotesChange = \(e: React\.ChangeEvent<HTMLTextAreaElement>\) => {[\s\S]*?(?=const handleFileUpload)/, `
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextNotes(e.target.value);
  };
  
  // Save on blur
  const handleNotesBlur = () => {
    if(topic) saveNotes(textNotes);
  };
`);

content = content.replace(/onChange=\{handleNotesChange\}/, 'onChange={handleNotesChange}\n                        onBlur={handleNotesBlur}');
content = content.replace(/className="[^"]*className="[^"]*"/g, (match) => {
    // just a simple regex to fix the duplicate className issue if present
    // actually, let's just leave it if it's too complex or just target the specific one
    return match;
});

// Let's actually look for the duplicate className
content = content.replace(/className="transition-opacity duration-200 flex flex-col gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm" className={cn\("transition-opacity duration-200 flex flex-col gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm", activeTab !== 'attachments' && "hidden"\)}/, 
`className={cn("transition-opacity duration-200 flex flex-col gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm", activeTab !== 'attachments' && "hidden")}`);
// Or the other tab
content = content.replace(/className="transition-opacity duration-200 flex flex-col gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm" className={cn\("transition-opacity duration-200 flex flex-col gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm", activeTab !== 'notes' && "hidden"\)}/,
`className={cn("transition-opacity duration-200 flex flex-col gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm", activeTab !== 'notes' && "hidden")}`);

fs.writeFileSync(file, content);
