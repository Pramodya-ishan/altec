import re

with open("src/components/views/SyllabusLibraryView.tsx", "r") as f:
    c = f.read()

# Remove the instructional text and badge
old_title_block = r'<span className="inline-flex items-center gap-1\.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-\[10px\] font-bold uppercase tracking-wider rounded-full mb-2">.*?</span>.*?<h1 className="text-2xl font-extrabold text-slate-800 font-display flex items-center gap-2">.*?</h1>.*?<p className="text-sm font-semibold text-slate-500 mt-1">.*?</p>'
new_title_block = """<h1 className="text-2xl font-extrabold text-slate-800 font-display flex items-center gap-2">
            <FileText className="w-7 h-7 text-primary-600" /> Syllabus Library
          </h1>"""

c = re.sub(old_title_block, new_title_block, c, flags=re.DOTALL)

with open("src/components/views/SyllabusLibraryView.tsx", "w") as f:
    f.write(c)
