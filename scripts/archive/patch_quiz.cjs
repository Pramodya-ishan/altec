const fs = require('fs');
let file = 'src/components/widgets/QuizGenerator.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/const handleGenerateQuiz = async \(\) => {[\s\S]*?(?=const handleSendChat)/, `
  const handleGenerateQuiz = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/ai/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${auth?.currentUser ? await auth.currentUser.getIdToken() : ''}\`
        },
        body: JSON.stringify({
          prompt: "Generate a practice quiz with 3 MCQ questions for " + currentSubject + ". Return the result in a valid JSON array format where each object has: 'question' (string), 'options' (array of 4 strings), 'correctIndex' (number 0-3), and 'explanation' (string). Provide NO other text, only the raw JSON array. Use Sinhala.",
          activeSubject: currentSubject,
          mode: 'quiz_generation'
        })
      });

      if (!response.ok) {
        throw new Error(\`Failed to generate (\${response.status})\`);
      }
      const data = await response.json();
      const aiText = data.text || data.response;
      
      let parsed;
      try {
        const cleaned = aiText.replace(/\\n/g, "").replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch (e) {
        throw new Error("Failed to parse AI response into quiz format.");
      }
      
      setQuizResults(parsed);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };
`);

fs.writeFileSync(file, content);
