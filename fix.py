import re

with open('src/components/views/CloraXView.tsx', 'r') as f:
    content = f.read()

import textwrap

new_func = """function ThoughtProcessPanel({ msg, isStreamingActive, status, tools }: any) {
  const [expanded, setExpanded] = useState(false);
  
  // Auto-expand while streaming, collapse when done
  useEffect(() => {
    if (isStreamingActive) setExpanded(true);
  }, [isStreamingActive]);

  if (!msg.summary?.length && !isStreamingActive && !msg.sources?.length) return null;

  return (
    <div className="flex flex-col gap-2 mb-3">
      <div className="flex flex-wrap items-center gap-2">
        <AIWorkflowStatus 
          status={ isStreamingActive ? (status || { stage: 'thinking', label: 'Thinking...' }) : { stage: 'done', label: 'Reasoning Process' } } 
          onClick={() => setExpanded(!expanded)} 
        />
        {isStreamingActive && tools?.map((t: any, i: number) => (
           <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-full text-[10px] font-bold text-slate-500 shadow-sm">
             <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
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
            <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl mt-1 space-y-4 shadow-inner">
              {msg.sources && msg.sources.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" />
                    Sources Connected
                  </h4>
                  <div className="flex flex-wrap gap-2.5">
                    {msg.sources.map((src: any, i: number) => (
                      <button 
                        key={i} 
                        className="flex items-center gap-2.5 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-left pl-2 pr-4 py-2 rounded-xl transition-all shadow-sm group active:scale-95"
                        onClick={() => {
                          if (src.storagePath) {
                              import('../../lib/clientStorageUpload').then(m => m.openPrivateStoragePdf(src.storagePath));
                          } else if (src.url) {
                              window.open(src.url, '_blank');
                          }
                        }}
                      >
                        <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center shrink-0 group-hover:bg-rose-100 transition-colors border border-rose-100/50">
                          <FileText className="w-4 h-4 text-rose-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-700 truncate max-w-[200px] leading-tight">
                            {src.title || src.fileName || "Document"}
                          </p>
                          {(src.subject || src.year) && (
                            <p className="text-[9px] font-bold text-slate-400 mt-0.5 truncate max-w-[200px]">
                              {src.subject} {src.year ? `• ${src.year}` : ''}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {msg.summary && msg.summary.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mt-2">
                    <BrainCircuit className="w-3.5 h-3.5" />
                    Agent Reasoning Log
                  </h4>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-xs leading-relaxed text-slate-600">
                    <SafeReasoningSummary items={msg.summary} />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}"""

# find function ThoughtProcessPanel({ msg, isStreamingActive, status, tools }: any) {
start_idx = content.find("function ThoughtProcessPanel({ msg, isStreamingActive, status, tools }: any) {")

# find the export function CloraXView() {
end_idx = content.find("export function CloraXView() {", start_idx)

content = content[:start_idx] + new_func + "\n\n" + content[end_idx:]

with open('src/components/views/CloraXView.tsx', 'w') as f:
    f.write(content)
