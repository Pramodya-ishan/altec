import re

with open("src/components/views/CloraXView.tsx", "r") as f:
    c = f.read()

old_summary = r'\{summaryExpanded && \(\s*<div className="pt-2 border-t border-slate-200/50">\s*\{msg\.summary.*?</div>\s*\)\}'

new_summary = """<AnimatePresence>
                                {summaryExpanded && (
                                  <motion.div 
                                    initial={{ opacity: 0, height: 0 }} 
                                    animate={{ opacity: 1, height: "auto" }} 
                                    exit={{ opacity: 0, height: 0 }}
                                    className="pt-2 border-t border-slate-200/50 overflow-hidden"
                                  >
                                    {msg.summary && msg.summary.length > 0 && <SafeReasoningSummary items={msg.summary} />}
                                    {msg.sources && msg.sources.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">Sources:</span>
                                        {msg.sources.map((src: any, i: number) => (
                                          <span key={i} className="text-[10px] font-medium bg-slate-50 text-slate-600 px-2 py-0.5 rounded border border-slate-200 truncate max-w-[200px]">
                                            {src.title || src.fileName || "Document"}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </motion.div>
                                )}
                                </AnimatePresence>"""

c = re.sub(old_summary, new_summary, c, flags=re.DOTALL)

with open("src/components/views/CloraXView.tsx", "w") as f:
    f.write(c)
