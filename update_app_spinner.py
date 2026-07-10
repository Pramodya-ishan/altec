import re

with open("src/App.tsx", "r") as f:
    c = f.read()

skeleton = """<div className="flex-1 w-full h-full p-4 sm:p-6 lg:p-8 animate-pulse flex flex-col gap-6">
                  <div className="w-1/3 h-8 bg-slate-200 rounded-xl mb-4"></div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="h-32 bg-slate-200 rounded-2xl"></div>
                    <div className="h-32 bg-slate-200 rounded-2xl"></div>
                    <div className="h-32 bg-slate-200 rounded-2xl"></div>
                  </div>
                  <div className="w-full h-64 bg-slate-200 rounded-2xl"></div>
                </div>"""

# Ensure it replaces correctly
old_fallback = '<div className="flex-1 flex justify-center items-center py-24"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>'

c = c.replace(old_fallback, skeleton)

with open("src/App.tsx", "w") as f:
    f.write(c)
