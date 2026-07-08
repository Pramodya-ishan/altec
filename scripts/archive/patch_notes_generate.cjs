const fs = require('fs');
let file = 'src/components/modals/NotesModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
  const handleGenerateAI = async () => {
    setIsGenerating(true);
    showNotification('AI is generating perfect notes...', 'info');
    try {
      const response = await fetch('/api/ai/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${auth?.currentUser ? await auth.currentUser.getIdToken() : ''}\` },
        body: JSON.stringify({ 
           prompt: \`Generate Sinhala exam-focused notes for \${currentSubject} lesson \${topic}. Use user's progress and retrieved sources. Include headings, formulas if relevant, exam tips, and short recall questions.\`,
           activeSubject: currentSubject,
           mode: "notes_generation"
        })
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || errBody.message || 'Failed to generate notes');
      }
      const resData = await response.json();
      const generated = resData.text || '';
      const newVal = textNotes ? textNotes + '\\n\\n' + generated : generated;
      setTextNotes(newVal);
      saveNotesToState(newVal);
      setIsPreviewMode(true);
      showNotification('Notes generated successfully!', 'success');
    } catch (e: any) {
      console.error(e);
      showNotification(\`AI Error: \${e.message}\`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };
`;

content = content.replace(/const handleGenerateAI = async \(\) => \{[\s\S]*?setIsGenerating\(false\);\s*\n\s*\}\s*\n\s*\};/, replacement.trim());

fs.writeFileSync(file, content);
