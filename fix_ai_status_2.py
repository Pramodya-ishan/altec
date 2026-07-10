import re

with open("src/components/ai/AIWorkflowStatus.tsx", "r") as f:
    c = f.read()

# Only render icon and text if NOT done
new_return = """  return (
    <div 
      onClick={isDone ? onClick : undefined}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-slate-400 bg-white transition-all ${isDone ? 'cursor-pointer hover:bg-slate-50' : ''}`}
    >
      {!isDone && (icons[status.stage] || icons.thinking)}
      {!isDone && <span>{status.label} {(!isError) ? `for ${elapsed}s` : ''}</span>}
      {(!isDone && !isError) && <span className="flex gap-0.5 ml-1">
        <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
      </span>}
      {isDone && <span className="text-[10px] tracking-wider uppercase font-bold text-slate-400 flex items-center gap-1">Reasoning <ChevronRight className="w-3 h-3" /></span>}
    </div>
  );"""

c = re.sub(r'  return \(\n    <div.*    </div>\n  \);', new_return, c, flags=re.DOTALL)

with open("src/components/ai/AIWorkflowStatus.tsx", "w") as f:
    f.write(c)

