import re

with open("src/components/views/AdmissionPredictorView.tsx", "r") as f:
    c = f.read()

c = c.replace("const { showNotification } = useApp();", "const { showNotification, currentSubject } = useApp();")

with open("src/components/views/AdmissionPredictorView.tsx", "w") as f:
    f.write(c)
