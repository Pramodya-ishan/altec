import re

with open("src/components/views/CloraXView.tsx", "r") as f:
    c = f.read()

# Add ThoughtProcessPanel component at the top of the file
thought_panel = """
function ThoughtProcessPanel({ msg, isStreamingActive, status, tools }: any) {
  const [expanded, setExpanded] = useState(false);
  
  if (!msg.summary?.length && !isStreamingActive && !msg.sources?.length) return null;

  return (
    <div className="flex flex-col gap-2 bg-white rounded-2xl mb-2">
      <div className="flex items-center gap-1.5">
        <AIWorkflowStatus
           status={ isStreamingActive ? (status || { stage: 'thinking', label: 'Thinking...' }) : { stage: 'done', label: 'Thought Process' } }
           onClick={() => setExpanded(!expanded)}
         />
        {isStreamingActive && tools?.map((t: any, i: number) => (
           <span key={i} className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-white border border-slate-200 rounded-full text-[10px] font-bold text-slate-500 animate-pulse shadow-sm">
             <Loader2 className="w-2.5 h-2.5 animate-spin text-indigo-500" />
             {t.status === 'reading' ? `Reading ${t.name}` : `Searching ${t.name}`}
           </span>
        ))}
      </div>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
             initial={{ opacity: 0, height: 0 }}
             animate={{ opacity: 1, height: "auto" }}
             exit={{ opacity: 0, height: 0 }}
             className="overflow-hidden"
          >
            <div className="pt-3 pb-1 border-t border-slate-100 mt-2">
              {msg.summary && msg.summary.length > 0 && <SafeReasoningSummary items={msg.summary} />}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">Sources checked:</span>
                  {msg.sources.map((src: any, i: number) => (
                    <span key={i} className="text-[10px] font-bold bg-slate-50 text-slate-600 px-2 py-1 rounded border border-slate-200 truncate max-w-[200px] flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => {
                        if (src.storagePath) {
                            import('../../lib/clientStorageUpload').then(m => m.openPrivateStoragePdf(src.storagePath));
                        } else if (src.url) {
                            window.open(src.url, '_blank');
                        }
                    }}>
                      <i className="fa-solid fa-file-pdf text-rose-500"></i>
                      {src.title || src.fileName || "Document"}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
"""

if "ThoughtProcessPanel" not in c:
    c = c.replace("export function CloraXView() {", thought_panel + "\nexport function CloraXView() {")

old_render = r'''                            \{\(\(msg\.summary && msg\.summary\.length > 0\) \|\| isStreamingActive\) && \(
                              <div className="flex flex-col gap-2 bg-white rounded-2xl">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1\.5">
                                    <AIWorkflowStatus 
                                       status=\{ isStreamingActive \? \(status \|\| \{ stage: 'thinking', label: 'Thinking\.\.\.' \}\) : \{ stage: 'done', label: 'Thought Process' \} \}
                                       onClick=\{\(\) => setSummaryExpanded\(!summaryExpanded\)\} 
                                     />
                                    \{/\* Inline tools / read statuses if streaming \*/\}
                                    \{isStreamingActive && tools\?\.map\(\(t: any, i: number\) => \(
                                       <span key=\{i\} className="inline-flex items-center gap-1 px-2\.5 py-0\.5 bg-white border border-slate-200 rounded-full text-\[10px\] font-bold text-slate-500 animate-pulse shadow-2xs">
                                         <Loader2 className="w-2\.5 h-2\.5 animate-spin text-indigo-500" />
                                         \{t\.status === 'reading' \? `Reading \$\{t\.name\}` : `Searching \$\{t\.name\}`\}
                                       </span>
                                    \)\)\}
                                  </div>
                                  
                                  
                                </div>
                                <AnimatePresence>
                                \{summaryExpanded && \(
                                  <motion\.div 
                                    initial=\{\{ opacity: 0, height: 0 \}\} 
                                    animate=\{\{ opacity: 1, height: "auto" \}\} 
                                    exit=\{\{ opacity: 0, height: 0 \}\}
                                    className="pt-2 border-t border-slate-200/50 overflow-hidden"
                                  >
                                    \{msg\.summary && msg\.summary\.length > 0 && <SafeReasoningSummary items=\{msg\.summary\} />\}
                                    \{msg\.sources && msg\.sources\.length > 0 && \(
                                      <div className="mt-2 flex flex-wrap gap-1\.5 items-center">
                                        <span className="text-\[10px\] font-bold text-slate-400 uppercase tracking-widest mr-1">Sources:</span>
                                        \{msg\.sources\.map\(\(src: any, i: number\) => \(
                                          <span key=\{i\} className="text-\[10px\] font-medium bg-slate-50 text-slate-600 px-2 py-0\.5 rounded border border-slate-200 truncate max-w-\[200px\]">
                                            \{src\.title \|\| src\.fileName \|\| "Document"\}
                                          </span>
                                        \)\)\}
                                      </div>
                                    \)\}
                                  </motion\.div>
                                \)\}
                                </AnimatePresence>
                              </div>
                            \)}'''

new_render = '''                            <ThoughtProcessPanel msg={msg} isStreamingActive={isStreamingActive} status={status} tools={tools} />'''

c = re.sub(old_render, new_render, c)

with open("src/components/views/CloraXView.tsx", "w") as f:
    f.write(c)
