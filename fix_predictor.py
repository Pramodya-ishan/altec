import re

with open("src/components/widgets/PredictorWidget.tsx", "r") as f:
    c = f.read()

# Make the PredictorWidget look amazing
old_section = r'<section className="bg-white border border-transparent rounded-\[22px\] p-4 sm:p-8 shadow-sm overflow-hidden text-left">'
new_section = '<section className="bg-gradient-to-b from-white to-indigo-50/30 border border-slate-200/60 rounded-3xl p-6 sm:p-8 shadow-lg overflow-hidden text-left">'

c = re.sub(old_section, new_section, c)

old_card = r'<div className="flex flex-col items-center justify-between p-4 sm:p-5 bg-slate-50/50 rounded-2xl border border-slate-200 w-full">'
new_card = '<div className="flex flex-col items-center justify-between p-6 bg-white rounded-2xl border border-slate-100 shadow-sm w-full">'

c = re.sub(old_card, new_card, c)

with open("src/components/widgets/PredictorWidget.tsx", "w") as f:
    f.write(c)
