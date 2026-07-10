import re

with open("src/components/views/AdmissionPredictorView.tsx", "r") as f:
    c = f.read()

# Replace API endpoint and body
old_api = r'apiFetch\("/api/lesson-optimizer", \{\s*method: "POST",\s*headers: \{\s*"Content-Type": "application/json",\s*Accept: "text/event-stream",\s*\},\s*body: JSON\.stringify\(\{\s*data: appData,\s*syllabus: SYLLABUS,\s*history: nextMessages\.map\(\(m\) => \(\{\s*role: m\.sender === "user" \? "user" : "model",\s*parts: \[\{ text: m\.text \}\],\s*\}\)\),\s*prompt: textToSend,\s*\}\),\s*\}\);'

new_api = """apiFetch("/api/ai/respond-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          activeSubject: currentSubject,
          mode: "zscore_prediction",
          history: nextMessages.map((m) => ({
            role: m.sender === "user" ? "user" : "model",
            parts: [{ text: m.text }],
          })),
          prompt: textToSend,
        }),
      });"""

c = re.sub(old_api, new_api, c, flags=re.DOTALL)

with open("src/components/views/AdmissionPredictorView.tsx", "w") as f:
    f.write(c)
