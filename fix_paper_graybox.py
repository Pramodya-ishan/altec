import re

with open("src/components/views/PaperStructureView.tsx", "r") as f:
    c = f.read()

old_gray = r'<div className="xl:col-span-8 bg-slate-50 border border-slate-200 rounded-3xl p-6 md:p-8">'
new_gray = '<div className="xl:col-span-8">'

c = re.sub(old_gray, new_gray, c)

with open("src/components/views/PaperStructureView.tsx", "w") as f:
    f.write(c)
