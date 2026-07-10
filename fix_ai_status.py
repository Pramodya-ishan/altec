import re

with open("src/components/ai/AIWorkflowStatus.tsx", "r") as f:
    c = f.read()

# Change the div className
c = re.sub(
    r'className={`inline-flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900/80 px-3 py-1.5 text-sm text-zinc-200 shadow-lg backdrop-blur-md transition-all \$\{isDone \? \'cursor-pointer hover:bg-zinc-800\' : \'\'\}`}',
    r'className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-slate-500 bg-white transition-all ${isDone ? \'cursor-pointer hover:bg-slate-50\' : \'\'}`}',
    c
)

with open("src/components/ai/AIWorkflowStatus.tsx", "w") as f:
    f.write(c)

