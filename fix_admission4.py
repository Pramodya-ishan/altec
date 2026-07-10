import re

with open("src/components/views/AdmissionPredictorView.tsx", "r") as f:
    c = f.read()

# Make User avatar disappear too? The user said "chat bot logo div and svg". 
# But earlier they selected focus-mode elements, let's just make sure.

with open("src/components/views/AdmissionPredictorView.tsx", "w") as f:
    f.write(c)
