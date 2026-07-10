with open("src/components/views/SyllabusLibraryView.tsx", "r") as f:
    c = f.read()

old = """<div className="flex flex-col items-center justify-center py-16 bg-white border border-slate-200/60 rounded-2xl shadow-sm">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600 mb-2" />
            <p className="text-xs font-bold text-slate-400">Loading resources indexed in Pinecone & Firestore...</p>
          </div>"""

new = """<div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm p-4 animate-pulse">
            <div className="h-10 bg-slate-100 rounded-lg mb-4 w-full"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-12 bg-slate-50 rounded-lg w-1/3"></div>
                  <div className="h-12 bg-slate-50 rounded-lg w-1/6"></div>
                  <div className="h-12 bg-slate-50 rounded-lg w-1/4"></div>
                  <div className="h-12 bg-slate-50 rounded-lg w-1/4"></div>
                </div>
              ))}
            </div>
          </div>"""

if old in c:
    c = c.replace(old, new)
else:
    print("Could not find the exact snippet to replace in SyllabusLibraryView.")

with open("src/components/views/SyllabusLibraryView.tsx", "w") as f:
    f.write(c)
