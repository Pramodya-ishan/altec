import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
    title: "Web search",
    description: "Search the web for current information.",
    icon: <Globe className="w-4 h-4 text-slate-700" />
  },
  {
    id: "pdf",
    command: "@pdf",
    title: "PDF library",
    description: "Search lessons and past papers.",
    icon: <BookOpen className="w-4 h-4 text-slate-700" />
  },
  {
    id: "deep",
    command: "@deep",
    title: "Deep search",
    description: "Check multiple sources for a complex question.",
    icon: <Layers className="w-4 h-4 text-slate-700" />
  },
  {
    id: "error",
    command: "@error",
    title: "Error log",
    description: "Save an error for later revision.",
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
          className="absolute z-50 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
          style={{ 
            bottom: `calc(100% - ${position.top - 16}px)`,
            left: position.left 
          }}
        >
          <div className="border-b border-slate-100 bg-white px-3 py-2 text-xs font-semibold text-slate-500">
            Choose a tool
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filteredTools.length > 0 ? (
              filteredTools.map((tool, index) => (
                <button
                  key={tool.id}
                  onClick={() => onSelect(tool)}
                  className="w-full cursor-pointer rounded-xl p-2 text-left outline-none transition-colors hover:bg-slate-100 focus:bg-slate-100 flex items-start gap-3"
                >
                  <div className="mt-0.5 rounded-lg border border-slate-200 bg-white p-2">
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
                No tool found for “{query}”
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
