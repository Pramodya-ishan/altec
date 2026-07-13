import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../../lib/utils';
import { Globe, BookOpen, Layers, AlertCircle } from 'lucide-react';

export interface ToolOption {
  id: string;
  command: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const defaultTools: ToolOption[] = [
  {
    id: "web",
    command: "@web",
    title: "Web Search",
    description: "Search the internet for up-to-date information.",
    icon: <Globe className="w-4 h-4 text-blue-500" />
  },
  {
    id: "pdf",
    command: "@pdf",
    title: "PDF Library",
    description: "Search within syllabus and past papers.",
    icon: <BookOpen className="w-4 h-4 text-purple-500" />
  },
  {
    id: "deep",
    command: "@deep",
    title: "Deep Search",
    description: "Multi-step reasoning for complex questions.",
    icon: <Layers className="w-4 h-4 text-indigo-500" />
  },
  {
    id: "error",
    command: "@error",
    title: "Error Log",
    description: "Log a mistake for AI diagnostic & analysis.",
    icon: <AlertCircle className="w-4 h-4 text-rose-500" />
  }
];

interface CloraToolPaletteProps {
  isOpen: boolean;
  query: string;
  onSelect: (tool: ToolOption) => void;
  position: { top: number; left: number };
}

export function CloraToolPalette({ isOpen, query, onSelect, position }: CloraToolPaletteProps) {
  const filteredTools = defaultTools.filter(t => 
    t.title.toLowerCase().includes(query.toLowerCase()) || 
    t.command.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="absolute z-50 w-72 bg-white rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden"
          style={{ 
            bottom: `calc(100% - ${position.top - 16}px)`,
            left: position.left 
          }}
        >
          <div className="p-2 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 px-3">
            Select an AI Tool
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filteredTools.length > 0 ? (
              filteredTools.map((tool, index) => (
                <button
                  key={tool.id}
                  onClick={() => onSelect(tool)}
                  className="w-full flex items-start gap-3 p-2 rounded-xl hover:bg-slate-50 focus:bg-slate-50 outline-none text-left transition-colors cursor-pointer"
                >
                  <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100 mt-0.5">
                    {tool.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700 text-sm">{tool.title}</span>
                      <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">
                        {tool.command}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1">{tool.description}</p>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-sm text-slate-500">
                No tools found for "{query}"
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
