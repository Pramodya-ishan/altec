import re

with open("src/components/views/AdminDashboardView.tsx", "r") as f:
    c = f.read()

# Replace loading text with skeletons
old_loading = r'\{loading \? \(\s*<div className="p-4 text-center text-slate-400 font-bold text-sm">Loading users from Firestore\.\.\.</div>\s*\)'

new_loading = """{loading ? (
 <div className="space-y-3">
   {[1, 2, 3, 4, 5].map((i) => (
     <div key={i} className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-slate-100 animate-pulse">
       <div className="w-8 h-8 rounded-full bg-slate-200"></div>
       <div className="space-y-2 flex-1">
         <div className="h-3 bg-slate-200 rounded w-1/2"></div>
         <div className="h-2 bg-slate-100 rounded w-3/4"></div>
       </div>
     </div>
   ))}
 </div>
)"""

c = re.sub(old_loading, new_loading, c, flags=re.DOTALL)

with open("src/components/views/AdminDashboardView.tsx", "w") as f:
    f.write(c)
