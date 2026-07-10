import re

with open("src/components/views/AdmissionPredictorView.tsx", "r") as f:
    c = f.read()

# Only keep newlines that are after import statements, remove others that we added
# Actually wait, replacing ';' with ';\n' means:
# const a = 1; -> const a = 1;\n
# It might actually be valid Javascript/Typescript!
