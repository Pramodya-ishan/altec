import React, { useEffect, useState } from "react";
import { Brain, Database, Search, PenLine, ShieldCheck, ChevronRight, AlertCircle, Sparkles } from "lucide-react";

export function AIWorkflowStatus({ status, onClick }: { status: any, onClick?: () => void }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!status || status.stage === 'done' || status.stage === 'error') return;
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - status.startedAt) / 1000));
    }, 300);
    return () => clearInterval(interval);
  }, [status]);

  if (!status) return null;

  const icons: any = {
    thinking: <Brain className="w-4 h-4 text-amber-500 animate-pulse" />,
    auth: <ShieldCheck className="w-4 h-4 text-emerald-500" />,
    profile: <Database className="w-4 h-4 text-blue-500" />,
    progress: <Database className="w-4 h-4 text-indigo-500" />,
    memory: <Brain className="w-4 h-4 text-purple-500" />,
    sources: <Database className="w-4 h-4 text-cyan-500" />,
    search: <Search className="w-4 h-4 text-sky-500 animate-pulse" />,
    planning: <PenLine className="w-4 h-4 text-fuchsia-500" />,
    generating: <PenLine className="w-4 h-4 text-rose-500 animate-pulse" />,
    saving: <Database className="w-4 h-4 text-emerald-500" />,
    done: <Sparkles className="w-4 h-4 text-emerald-400" />,
    error: <AlertCircle className="w-4 h-4 text-red-500" />
  };

  const isDone = status.stage === 'done';
  const isError = status.stage === 'error';

  return (
    <div 
      onClick={isDone ? onClick : undefined}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-slate-400 bg-white transition-all ${isDone ? 'cursor-pointer hover:bg-slate-50' : ''}`}
    >
      {!isDone && (icons[status.stage] || icons.thinking)}
      {!isDone && <span>{status.label} {(!isError) ? `for ${elapsed}s` : ''}</span>}
      {(!isDone && !isError) && <span className="flex gap-0.5 ml-1">
        <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
      </span>}
      {isDone && <span className="text-[10px] tracking-wider uppercase font-bold text-slate-400 flex items-center gap-1">Reasoning <ChevronRight className="w-3 h-3" /></span>}
    </div>
  );
}
