import re

with open("src/components/views/CloraXView.tsx", "r") as f:
    c = f.read()

c = c.replace("{msg.webCandidates && msg.webCandidates.length > 0 && isStreamingActive && (", "{msg.webCandidates && msg.webCandidates.length > 0 && (")

with open("src/components/views/CloraXView.tsx", "w") as f:
    f.write(c)
