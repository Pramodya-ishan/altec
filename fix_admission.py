import re

with open("src/components/views/AdmissionPredictorView.tsx", "r") as f:
    c = f.read()

# 1. Remove [STATUS: INITIALIZING_ADVISOR] Connecting to core AI...
c = c.replace('"[STATUS: INITIALIZING_ADVISOR] Connecting to core AI..."', '""')

# 2. Remove [STATUS: INITIALIZING_ADVISOR] Engaging optimization heuristics...
c = c.replace('"[STATUS: INITIALIZING_ADVISOR] Engaging optimization heuristics..."', '""')

# 3. Make thinking container background white, no border
c = c.replace('<div className="py-12 flex flex-col items-center justify-center space-y-6">', '<div className="py-12 flex flex-col items-center justify-center space-y-6 bg-white border-0">')

# 4. Remove Lottie animation (chatbot logo / brain) and the thinkingStageText
old_loader = r'<Lottie\s*animationData=\{thinkingAnimation\}\s*loop=\{true\}\s*style=\{\{ width: "120px", height: "120px" \}\}\s*/>\s*<div className="space-y-1\.5 text-center px-4 w-full max-w-md relative overflow-hidden h-10 flex items-center justify-center">\s*<p\s*id="ai-status-loader-text"[^>]+>\s*\{thinkingStageText\}\s*</p>\s*</div>'
c = re.sub(old_loader, '', c)

with open("src/components/views/AdmissionPredictorView.tsx", "w") as f:
    f.write(c)
