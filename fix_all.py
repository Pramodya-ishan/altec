with open("src/components/views/AdmissionPredictorView.tsx", "r") as f:
    c = f.read()

c = c.replace(';', ';\n')
with open("src/components/views/AdmissionPredictorView.tsx", "w") as f:
    f.write(c)
