import re

with open("src/components/views/SyllabusLibraryView.tsx", "r") as f:
    c = f.read()

old_toggle = r'<div className="flex bg-slate-100 p-1 rounded-xl gap-1 border border-slate-200/50 w-full sm:w-80 shadow-inner">.*?</div>\s*\{/\* Resource grid table card \*/\}'

new_toggle = """<div className="flex bg-slate-100/80 p-1.5 rounded-2xl gap-1 border border-slate-200/50 w-full sm:w-[350px] shadow-inner relative">
          {(['ALL', 'SFT', 'ET', 'ICT'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={cn(
                "relative flex-1 text-xs font-bold py-2.5 rounded-xl transition-colors z-10 cursor-pointer outline-none",
                activeFilter === tab
                  ? "text-primary-700" 
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              {activeFilter === tab && (
                <motion.div
                  layoutId="activeFilterTab"
                  className="absolute inset-0 bg-white rounded-xl shadow-sm border border-slate-200/60 -z-10"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              {tab}
            </button>
          ))}
        </div>
        {/* Resource grid table card */}"""

c = re.sub(old_toggle, new_toggle, c, flags=re.DOTALL)

with open("src/components/views/SyllabusLibraryView.tsx", "w") as f:
    f.write(c)
