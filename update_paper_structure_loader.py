with open("src/components/views/PaperStructureView.tsx", "r") as f:
    c = f.read()

old = """<div className="flex-1 py-20 flex flex-col items-center justify-center space-y-4">
 <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
 <div className="text-center space-y-1">
 <h4 className="text-sm font-bold text-slate-800">Assessing Knowledge Gaps...</h4>
 <p className="text-xs text-slate-500 max-w-xs px-4">
 The AI is tailoring 5 A/L style questions targeted specifically on your weak syllabus milestone.
 </p>
 </div>
 </div>"""

new = """<div className="flex-1 p-6 space-y-6 w-full animate-pulse">
  {/* Progress Header Skeleton */}
  <div className="flex items-center justify-between">
    <div className="w-24 h-4 bg-slate-200 rounded-full"></div>
    <div className="w-12 h-4 bg-slate-200 rounded-full"></div>
  </div>
  
  {/* Question Context Skeleton */}
  <div className="w-full h-32 bg-slate-100 rounded-2xl border border-slate-200 mt-4"></div>
  
  {/* Options Skeleton */}
  <div className="space-y-3 mt-8">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="w-full h-14 bg-slate-100 border border-slate-200 rounded-2xl"></div>
    ))}
  </div>
</div>"""

if old in c:
    c = c.replace(old, new)
else:
    print("Could not find the exact snippet to replace in PaperStructureView.")

with open("src/components/views/PaperStructureView.tsx", "w") as f:
    f.write(c)
