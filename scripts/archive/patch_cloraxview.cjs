const fs = require('fs');
let file = 'src/components/views/CloraXView.tsx';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
    try {
      const response = await fetch('/api/ai/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${auth?.currentUser ? await auth.currentUser.getIdToken() : ''}\` },
        body: JSON.stringify({
            prompt: userMsg,
            activeSubject: currentSubject,
            history: messages.slice(-10),
            mode: "auto"
        })
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || errBody.message || \`AI failed (\${response.status})\`);
      }
      const data = await response.json();
      
      setMessages(prev => [...prev, { role: 'assistant', content: data.text, id: Date.now().toString() + 'r' }]);
    } catch (err: any) {
      console.error(err);
      showNotification(\`AI Error: \${err.message}\`, 'error');
    } finally {
      setIsLoading(false);
    }
`;

content = content.replace(/try \{\s*\n\s*const response = await fetch\('\/api\/gemini-chat'[\s\S]*?\} finally \{\s*\n\s*setIsLoading\(false\);\s*\n\s*\}/, replacement.trim());

fs.writeFileSync(file, content);
