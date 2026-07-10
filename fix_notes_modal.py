import re

with open("src/components/modals/NotesModal.tsx", "r") as f:
    c = f.read()

# Replace the header to just have the close button
old_header = r'<div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0 shadow-sm z-10 relative">.*?<h2 className="text-xl font-black text-slate-900 flex items-center gap-3 tracking-tight min-w-0 pr-4">.*?<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">.*?<i className="fa-solid fa-paperclip"></i>.*?</div>.*?<span className="truncate hidden sm:inline">Attachments</span>.*?<span className="truncate sm:hidden text-lg">Attachments</span>.*?</h2>.*?<div className="flex items-center gap-2">.*?<button onClick=\{close\}'

new_header = """<div className="px-6 py-4 flex justify-end items-center shrink-0 z-10 relative">
          <button onClick={close}"""

c = re.sub(old_header, new_header, c, flags=re.DOTALL)

with open("src/components/modals/NotesModal.tsx", "w") as f:
    f.write(c)
