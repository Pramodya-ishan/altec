import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { cn } from '../../lib/utils';
import Markdown from 'react-markdown';
import { useAIWorkflowStream } from '../../hooks/useAIWorkflowStream';
import { AIWorkflowStatus } from '../ai/AIWorkflowStatus';
import { SafeReasoningSummary } from '../ai/SafeReasoningSummary';
import { apiFetch } from '../../lib/api';
import { Paperclip, Loader2 } from 'lucide-react';

export function CloraXView() {
  const { currentSubject } = useApp();
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string, id: string, summary?: string[], sources?: any[] }[]>([
    {
      role: 'assistant',
      content: 'ආයුබෝවන්! මම Clora X Assistant. ඔබට අද කුමන පාඩමක් ගැනද දැනගන්න අවශ්‍ය?',
      id: 'welcome'
    }
  ]);
  const [input, setInput] = useState('');
  const [historyWarning, setHistoryWarning] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { answer, status, tools, isStreaming, safeSummary, sources, error, isRecoverableError, sendAIMessage, cancel } = useAIWorkflowStream();
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const currentRequestIdRef = useRef<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await apiFetch("/api/chat-history");
        if (res.ok && res.chatHistory && res.chatHistory.length > 0) {
           setMessages(res.chatHistory.map((m: any) => ({
             role: m.role,
             content: m.text || m.assistantAnswer || m.userPrompt,
             id: m.id || m.requestId || Date.now().toString(),
             sources: m.sources
           })));
        }
      } catch (e) {
        console.warn("Failed to load history", e);
      }
    };
    loadHistory();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, answer, status, tools, isStreaming]);

  useEffect(() => {
    if (!isStreaming && status?.stage === 'done' && answer && currentRequestIdRef.current) {
      setMessages(prev => {
        if (prev.some(m => m.id === currentRequestIdRef.current)) {
           return prev.map(m => m.id === currentRequestIdRef.current ? { ...m, content: answer, summary: safeSummary, sources } : m);
        }
        return [...prev, { role: 'assistant', content: answer, id: currentRequestIdRef.current!, summary: safeSummary, sources }];
      });
      currentRequestIdRef.current = null;
    }
  }, [isStreaming, status?.stage, answer, safeSummary, sources]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const res = await apiFetch("/api/rag/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type,
            title: file.name,
            pdfBase64: base64
          })
        });

        if (res.ok) {
          setInput(prev => prev + `\n[Uploaded PDF: ${file.name}] Please read this pdf and answer: `);
        } else {
          alert("Upload failed: " + res.error);
        }
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setUploading(false);
      alert("Error reading file.");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleContinue = () => {
    if (isStreaming) return;
    const historyPayload = messages.map(m => ({ role: m.role, content: m.content }));
    const continuePrompt = "Continue the previous answer (ඉතිරි ටික කියන්න).";
    
    setMessages(prev => [...prev, { role: 'user', content: continuePrompt, id: Date.now().toString() }]);
    currentRequestIdRef.current = (Date.now() + 1).toString();
    setSummaryExpanded(false);
    
    sendAIMessage({ 
       prompt: continuePrompt, 
       activeSubject: currentSubject,
       mode: 'auto',
       history: historyPayload
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    const userMsg = input.trim();
    setInput('');
    setSummaryExpanded(false);
    
    const userMsgId = Date.now().toString();
    const assistantMsgId = (Date.now() + 1).toString();
    currentRequestIdRef.current = assistantMsgId;
    
    setMessages(prev => [...prev, { role: 'user', content: userMsg, id: userMsgId }]);
    
    await sendAIMessage({
        prompt: userMsg,
        activeSubject: currentSubject,
        mode: "auto",
        history: messages.slice(-10).map(m => ({ role: m.role, text: m.content }))
    });
  };

  const clearHistory = async () => {
     if(confirm("Are you sure you want to clear chat history?")) {
        setMessages([{ role: 'assistant', content: 'ආයුබෝවන්! මම Clora X Assistant. අද මොනවද දැනගන්න අවශ්‍ය?', id: 'welcome' }]);
        await apiFetch("/api/chat-history/clear", { method: "POST" });
     }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-3xl mx-auto px-4 sm:px-6 py-4 bg-white md:bg-transparent">
      
      <div className="flex justify-between items-center mb-6 px-2 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-sparkles text-blue-500"></i> Clora X
          </h1>
          <p className="text-sm font-medium text-slate-500">Hybrid Knowledge Brain v2</p>
        </div>
        <button onClick={clearHistory} className="text-slate-400 hover:text-slate-600 transition-colors text-sm font-medium">
          <i className="fa-solid fa-trash-can mr-1"></i> Clear History
        </button>
      </div>

      {historyWarning && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm font-medium flex items-center shrink-0">
          <i className="fa-solid fa-triangle-exclamation mr-2"></i> {historyWarning}
          <button onClick={() => setHistoryWarning(null)} className="ml-auto opacity-70 hover:opacity-100">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 pb-6 pr-2 space-y-6 md:space-y-8 scrollbar-thin">
        <AnimatePresence initial={false}>
          {messages.map((msg, index) => (
            <motion.div
              key={msg.id || index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex w-full",
                msg.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center shrink-0 mr-3 md:mr-4 shadow-sm border border-white/50 mt-1">
                  <i className="fa-solid fa-sparkles text-[10px]"></i>
                </div>
              )}
              
              <div
                className={cn(
                  "prose prose-slate max-w-[85%] md:max-w-[75%]",
                  msg.role === 'user'
                    ? "bg-black text-white px-5 py-3 rounded-2xl rounded-tr-sm shadow-sm"
                    : "pt-1"
                )}
              >
                {msg.role === 'assistant' ? (
                  <div className="markdown-body">
                    {msg.summary && msg.summary.length > 0 && (
                        <div className="mb-4">
                          <AIWorkflowStatus status={{ stage: 'done', label: 'Thought' }} onClick={() => setSummaryExpanded(!summaryExpanded)} />
                          {summaryExpanded && <SafeReasoningSummary items={msg.summary} />}
                        </div>
                    )}
                    
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mb-4 flex flex-wrap gap-2">
                        {msg.sources.map((src: any, i: number) => (
                          <div key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 shadow-sm">
                            <i className="fa-solid fa-file-pdf text-red-500"></i>
                            <span className="truncate max-w-[150px]">{src.title || "Document"}</span>
                            {src.badge && <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] uppercase tracking-wider">{src.badge}</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    <Markdown
                      components={{
                      img: ({ node, ...props }) => {
                        const src = props.src || "";
                        if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:image/")) {
                          return <img {...props} className="rounded-lg shadow-sm border border-slate-200 my-4 max-w-full" loading="lazy" />;
                        }
                        return null;
                      }
                    }}
                    >
                      {msg.content}
                    </Markdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </motion.div>
          ))}

          {isStreaming && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="self-start flex w-full"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center shrink-0 mr-3 md:mr-4 shadow-sm border border-white/50 mt-1">
                <i className="fa-solid fa-sparkles text-[10px] animate-pulse"></i>
              </div>
              <div className="prose prose-slate pt-1 w-full max-w-[85%] md:max-w-[75%]">
                  
                  {status && (
                      <div className="mb-4 flex flex-wrap gap-2 items-center">
                          <AIWorkflowStatus status={status} onClick={() => { if(status.stage==='done') setSummaryExpanded(!summaryExpanded) }} />
                          {tools.map((t, i) => (
                             <div key={i} className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-full text-xs font-medium text-slate-500 animate-pulse">
                               <Loader2 className="w-3 h-3 animate-spin" />
                               {t.status === 'reading' ? `Reading ${t.name}` : `Searching ${t.name}`}
                             </div>
                          ))}
                      </div>
                  )}

                  {summaryExpanded && safeSummary && safeSummary.length > 0 && <SafeReasoningSummary items={safeSummary} />}
                  
                  {sources && sources.length > 0 && (
                      <div className="mb-4 flex flex-wrap gap-2">
                        {sources.map((src: any, i: number) => (
                          <div key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 shadow-sm">
                            <i className="fa-solid fa-file-pdf text-red-500"></i>
                            <span className="truncate max-w-[150px]">{src.title || "Document"}</span>
                            {src.badge && <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] uppercase tracking-wider">{src.badge}</span>}
                          </div>
                        ))}
                      </div>
                  )}

                  {error && (
                      <div className="text-red-500 font-medium text-sm p-3 bg-red-50 rounded-lg mb-4 border border-red-100">
                          {error}
                      </div>
                  )}
                  
                  <div className="markdown-body">
                      <Markdown
                        components={{
                      img: ({ node, ...props }) => {
                        const src = props.src || "";
                        if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:image/")) {
                          return <img {...props} className="rounded-lg shadow-sm border border-slate-200 my-4 max-w-full" loading="lazy" />;
                        }
                        return null;
                      }
                    }}
                      >
                        {answer}
                      </Markdown>
                  </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {isRecoverableError && !isStreaming && (
        <div className="flex justify-center mb-4 shrink-0">
          <button 
            onClick={handleContinue}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded-full transition-colors text-sm shadow-sm border border-blue-200"
          >
            <i className="fa-solid fa-play"></i> Continue Answer
          </button>
        </div>
      )}

      <div className="shrink-0 relative mt-auto max-w-3xl w-full mx-auto">
        <form onSubmit={handleSubmit} className="relative flex items-end bg-slate-100/80 rounded-[24px] shadow-sm border border-slate-200 p-2 focus-within:ring-1 focus-within:ring-slate-300 transition-all">
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,image/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming || uploading}
            className="absolute left-3 bottom-2.5 w-9 h-9 flex items-center justify-center text-slate-500 hover:text-slate-800 disabled:opacity-50 transition-colors"
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin text-blue-500" /> : <Paperclip className="w-5 h-5" />}
          </button>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Ask Clora anything or upload a PDF..."
            className="w-full bg-transparent border-none pl-12 pr-12 py-3 text-[15px] font-medium outline-none resize-none max-h-48 text-slate-800 placeholder:text-slate-500"
            rows={input.split('\n').length > 1 ? Math.min(input.split('\n').length, 5) : 1}
            disabled={isStreaming}
          />
          
          {isStreaming ? (
            <button
                type="button"
                onClick={cancel}
                className="absolute right-3 bottom-2.5 w-9 h-9 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-full transition-all cursor-pointer shadow-sm active:scale-95"
            >
                <div className="w-3 h-3 bg-white rounded-sm"></div>
            </button>
          ) : (
            <button
                type="submit"
                disabled={!input.trim() || isStreaming || uploading}
                className="absolute right-3 bottom-2.5 w-9 h-9 flex items-center justify-center bg-black hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-full transition-all cursor-pointer shadow-sm active:scale-95 disabled:active:scale-100 disabled:cursor-not-allowed"
            >
                <i className="fa-solid fa-arrow-up"></i>
            </button>
          )}
        </form>
        <p className="text-center text-xs text-slate-400 mt-3 mb-2 font-medium">Clora X can make mistakes. Verify important information.</p>
      </div>
    </div>
  );
}
