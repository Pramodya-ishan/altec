with open("src/components/views/CloraXView.tsx", "r") as f:
    c = f.read()

header = """      {/* HEADER BAR */}
      <div className="shrink-0 h-14 border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between bg-white/80 backdrop-blur-md z-30 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{currentSubject} COGNITIVE WORKSPACE</span>
        </div>
        
        {/* Safe React-based Clear Chat Trigger */}
        <button
          type="button"
          onClick={() => setShowClearConfirm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-full text-xs font-extrabold transition-all border border-slate-200 active:scale-95 cursor-pointer shadow-xs"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Chat</span>
        </button>
      </div>"""

empty_state = """              /* Premium Empty State */
              <motion.div 
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="w-full max-w-2xl mx-auto md:pt-24 pt-8 flex flex-col items-center"
              >
                <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white flex items-center justify-center shadow-lg shadow-indigo-100/40 border border-indigo-200 mb-8 animate-fadeIn">
                  <Sparkle className="w-7 h-7 text-white animate-pulse" />
                </div>
                
                <h2 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 font-sans tracking-tight mb-3 text-center leading-tight">
                  Explore Clora X 3.5
                </h2>
                <p className="text-sm sm:text-base font-semibold text-slate-500 mb-12 text-center leading-relaxed max-w-lg">
                  Sri Lankan G.C.E. A/L Technology (SFT, ET, ICT) විෂය නිර්දේශයේ සියලුම ප්‍රශ්නෝත්තර, marking schemes සහ auto summaries මෙතැනින් විමසන්න.
                </p>

                <div className="w-full">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-left mb-4 px-1">Quick Actions</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {quickChips.map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleChipClick(chip.label)}
                        className="text-left px-5 py-4.5 bg-white border border-slate-200/80 hover:border-indigo-200 hover:bg-indigo-50/10 rounded-2xl text-sm font-bold text-slate-600 hover:text-indigo-950 transition-all flex items-center justify-between shadow-xs group active:scale-[0.98] cursor-pointer"
                      >
                        <span className="truncate pr-2">{chip.text}</span>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 shrink-0 transition-transform group-hover:translate-x-1 duration-200" />
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>"""

c = c.replace(header, "")
c = c.replace(empty_state, "")

with open("src/components/views/CloraXView.tsx", "w") as f:
    f.write(c)
