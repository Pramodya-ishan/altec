const fs = require('fs');
let file = 'src/components/widgets/QuizGenerator.tsx';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    
    const userMsg = { role: 'user', text: chatInput };
    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const payload = {
        prompt: chatInput,
        activeSubject: currentSubject,
        history: messages.slice(-10),
        mode: "auto"
      };

      const res = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const resData = await res.json().catch(() => ({}));

      if (res.ok && (resData.text || resData.response)) {
         setMessages(prev => [...prev, { role: 'assistant', text: (resData.text || resData.response) }]);
      } else {
         throw new Error(resData.error || resData.message || "Failed to process request");
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', text: \`Error: \${e.message}\` }]);
    } finally {
      setChatLoading(false);
    }
  };
`;

content = content.replace(/const handleSendChat = async \(\) => \{[\s\S]*?setChatLoading\(false\);\s*\n\s*\}\s*\n\s*\};/, replacement.trim());

fs.writeFileSync(file, content);
