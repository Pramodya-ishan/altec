import re

with open("src/components/modals/NotesModal.tsx", "r") as f:
    c = f.read()

c = c.replace("""        <div className="px-6 py-4 flex justify-end items-center shrink-0 z-10 relative">
          <button onClick={close} className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors shrink-0">
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>
        </div>""", """        <div className="px-6 py-4 flex justify-end items-center shrink-0 z-10 relative">
          <button onClick={close} className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors shrink-0">
              <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>""")

with open("src/components/modals/NotesModal.tsx", "w") as f:
    f.write(c)
