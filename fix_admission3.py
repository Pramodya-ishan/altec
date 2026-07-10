import re

with open("src/components/views/AdmissionPredictorView.tsx", "r") as f:
    c = f.read()

# Remove assistant avatar icon (Sparkles inside bg-gradient)
# Wait, look closely:
#                       {isAssistant ? (
#                         <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shrink-0 shadow-md border border-white/20 z-10 self-start mt-1">
#                           <Sparkles className="w-4 h-4 text-white" />
#                         </div>
#                       ) : (

avatar_regex = r'\{isAssistant \? \(\s*<div className="w-10 h-10 rounded-xl bg-gradient-[^>]+>\s*<Sparkles[^>]+>\s*</div>\s*\) : \('
c = re.sub(avatar_regex, '{isAssistant ? null : (', c, flags=re.DOTALL)

with open("src/components/views/AdmissionPredictorView.tsx", "w") as f:
    f.write(c)
