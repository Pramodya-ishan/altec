const fs = require('fs');
let file = 'src/components/views/CloraXView.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace everything with the new CloraXView component
content = `
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { cn } from '../../lib/utils';
import Markdown from 'react-markdown';
import { useAIWorkflowStream } from '../../hooks/useAIWorkflowStream';
import { AIWorkflowStatus } from '../ai/AIWorkflowStatus';
import { SafeReasoningSummary } from '../ai/SafeReasoningSummary';

export function CloraXView() {
  const { currentSubject } = useApp();
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string, id: string, summary?: string[] }[]>([
    {
      role: 'assistant',
      content: 'ආයුබෝවන්! මම Clora X Assistant. ඔබට අද කුමන පාඩමක් ගැනද දැනගන්න අවශ්‍ය?',
      id: 'welcome'
    }
  ]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { answer, status, isStreaming, safeSummary, error, sendAIMessage, cancel } = useAIWorkflowStream();
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, answer, status, summaryExpanded]);

  useEffect(() => {
    if (!isStreaming && status?.stage === 'done' && answer) {
        setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: answer, 
            id: Date.now().toString(),
            summary: safeSummary 
        }]);
    }
  }, [isStreaming, status?.stage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    const userMsg = input.trim();
    setInput('');
    setSummaryExpanded(false);
    
    setMessages(prev => [...prev, { role: 'user', content: userMsg, id: Date.now().toString() }]);
    
    await sendAIMessage({
        prompt: userMsg,
        activeSubject: currentSubject,
        mode: "auto",
        history: messages.slice(-10).map(m => ({ role: m.role, text: m.content }))
    });
  };

  return (
    <div className="flex flex-col h-full w-full max-w-3xl mx-auto px-4 sm:px-6 py-4 bg-white md:bg-transparent">
      
      {messages.length === 1 && !isStreaming && (
        <div className="flex-1 flex flex-col items-center justify-center -mt-20">
            <h1 className="text-4xl md:text-5xl font-medium text-slate-800 tracking-tight text-center leading-tight mb-2">
              <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 text-transparent bg-clip-text">Hello, I'm Clora X</span>
            </h1>
            <p className="text-lg md:text-xl font-medium text-slate-400 text-center">How can I help you learn today?</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-3xl mt-10">
              {['Explain complex theories', 'Generate a study plan', 'Quiz me on past papers'].map((txt, i) => (
                 <div key={i} onClick={() => setInput(txt)} className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-100 cursor-pointer transition-colors flex flex-col gap-2">
                    <p className="text-sm text-slate-600 font-medium">{txt}</p>
                 </div>
              ))}
            </div>
        </div>
      )}

      {(messages.length > 1 || isStreaming) && (
        <div className="flex-1 overflow-y-auto mb-6 pr-2 custom-scrollbar flex flex-col gap-8 pb-4" ref={scrollRef}>
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex w-full",
                  msg.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center shrink-0 mr-4 shadow-sm mt-1">
                    <i className="fa-solid fa-sparkles text-xs"></i>
                  </div>
                )}
                
                <div className={cn(
                  "max-w-[85%] md:max-w-[75%]",
                  msg.role === 'user' 
                     ? "bg-slate-100 px-5 py-3.5 rounded-3xl rounded-tr-sm text-slate-800 text-[15px]" 
                     : "prose prose-slate prose-p:leading-relaxed prose-pre:bg-slate-100 prose-pre:text-slate-800 text-[15px] pt-1"
                )}>
                  {msg.role === 'assistant' ? (
                    <div className="markdown-body">
                      {msg.summary && msg.summary.length > 0 && (
                          <div className="mb-4">
                            <AIWorkflowStatus status={{ stage: 'done', label: 'Thought' }} onClick={() => setSummaryExpanded(!summaryExpanded)} />
                            {summaryExpanded && <SafeReasoningSummary items={msg.summary} />}
                          </div>
                      )}
                      <Markdown>{msg.content}</Markdown>
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
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center shrink-0 mr-4 shadow-sm">
                  <i className="fa-solid fa-sparkles text-xs"></i>
                </div>
                <div className="prose prose-slate pt-1 w-full max-w-[85%] md:max-w-[75%]">
                    {status && (
                        <div className="mb-4">
                            <AIWorkflowStatus status={status} onClick={() => { if(status.stage==='done') setSummaryExpanded(!summaryExpanded) }} />
                            {summaryExpanded && safeSummary && safeSummary.length > 0 && <SafeReasoningSummary items={safeSummary} />}
                        </div>
                    )}
                    
                    {error && (
                        <div className="text-red-500 font-medium text-sm p-3 bg-red-50 rounded-lg">
                            {error}
                        </div>
                    )}
                    
                    <div className="markdown-body">
                        <Markdown>{answer}</Markdown>
                    </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="shrink-0 relative mt-auto max-w-3xl w-full mx-auto">
        <form onSubmit={handleSubmit} className="relative flex items-end bg-slate-100/80 rounded-[24px] shadow-sm border border-slate-200 p-2 focus-within:ring-1 focus-within:ring-slate-300 transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Ask Clora anything..."
            className="w-full bg-transparent border-none pl-4 pr-12 py-3 text-[15px] font-medium outline-none resize-none max-h-48 text-slate-800 placeholder:text-slate-500"
            rows={input.split('\\n').length > 1 ? Math.min(input.split('\\n').length, 5) : 1}
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
                disabled={!input.trim() || isStreaming}
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
`;
fs.writeFileSync(file, content);
