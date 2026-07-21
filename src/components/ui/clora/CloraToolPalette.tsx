import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  BookOpen,
  BrainCircuit,
  Clapperboard,
  FileSearch,
  Globe,
  Image as ImageIcon,
  Layers,
  Sparkles,
  UserRoundCog,
} from 'lucide-react';

export interface ToolOption {
  id: string;
  command: string;
  title: string;
  description: string;
  group: 'Create' | 'Study' | 'Search' | 'Personal';
  icon: React.ReactNode;
}

const defaultTools: ToolOption[] = [
  {
    id: 'guessing',
    command: '@guessing',
    title: 'Guessing questions',
    description: 'Create subject-wise and lesson-wise revision questions from indexed papers.',
    group: 'Create',
    icon: <BrainCircuit className="h-4 w-4 text-indigo-600" />,
  },
  {
    id: 'image',
    command: '@image',
    title: 'Create image',
    description: 'Generate a realistic educational visual or a clean black-line question diagram.',
    group: 'Create',
    icon: <ImageIcon className="h-4 w-4 text-violet-600" />,
  },
  {
    id: 'video',
    command: '@video',
    title: 'Explain with video',
    description: 'Build a Sinhala lesson-video script and visual storyboard from syllabus evidence.',
    group: 'Create',
    icon: <Clapperboard className="h-4 w-4 text-fuchsia-600" />,
  },
  {
    id: 'explain',
    command: '@explain',
    title: 'Explain clearly',
    description: 'Explain the selected question step by step in clear Sinhala.',
    group: 'Study',
    icon: <Sparkles className="h-4 w-4 text-amber-600" />,
  },
  {
    id: 'pdf',
    command: '@pdf',
    title: 'Ask PDF library',
    description: 'Search indexed lessons, past papers, model papers, and marking schemes.',
    group: 'Study',
    icon: <BookOpen className="h-4 w-4 text-slate-700" />,
  },
  {
    id: 'error',
    command: '@error',
    title: 'Add to Error Log',
    description: 'Save a mistake and connect it to its subject and Paper Structure lesson.',
    group: 'Study',
    icon: <AlertCircle className="h-4 w-4 text-rose-500" />,
  },
  {
    id: 'websearch',
    command: '@websearch',
    title: 'Web search',
    description: 'Search current public sources.',
    group: 'Search',
    icon: <Globe className="h-4 w-4 text-sky-600" />,
  },
  {
    id: 'deepsearch',
    command: '@deepsearch',
    title: 'Deep search',
    description: 'Check multiple indexed and public sources for a complex question.',
    group: 'Search',
    icon: <Layers className="h-4 w-4 text-cyan-700" />,
  },
  {
    id: 'file',
    command: '@file',
    title: 'Attach source',
    description: 'Upload PDF, image, audio, video, notes, or a project archive.',
    group: 'Search',
    icon: <FileSearch className="h-4 w-4 text-emerald-600" />,
  },
  {
    id: 'personalize',
    command: '@personalize',
    title: 'Personalized tutor',
    description: 'Use weak lessons, Error Log history, and preferred explanation depth.',
    group: 'Personal',
    icon: <UserRoundCog className="h-4 w-4 text-slate-700" />,
  },
];

interface CloraToolPaletteProps {
  isOpen: boolean;
  query: string;
  onSelect: (tool: ToolOption) => void;
  position: { top: number; left: number };
  onClose?: () => void;
}

export function CloraToolPalette({ isOpen, query, onSelect, position, onClose }: CloraToolPaletteProps) {
  const normalizedQuery = query.trim().toLowerCase();
  const filteredTools = defaultTools.filter((tool) =>
    !normalizedQuery
      || tool.title.toLowerCase().includes(normalizedQuery)
      || tool.description.toLowerCase().includes(normalizedQuery)
      || tool.command.toLowerCase().includes(normalizedQuery),
  );
  const groups = ['Create', 'Study', 'Search', 'Personal'] as const;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          transition={{ duration: 0.15 }}
          className="absolute z-50 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          style={{ bottom: `calc(100% - ${position.top - 16}px)`, left: position.left }}
          role="dialog"
          aria-label="AI tools"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-slate-950">AI tools</p>
              <p className="text-[11px] text-slate-500">Choose a focused workflow</p>
            </div>
            {onClose ? <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100">Close</button> : null}
          </div>
          <div className="max-h-[440px] overflow-y-auto p-2">
            {filteredTools.length > 0 ? groups.map((group) => {
              const tools = filteredTools.filter((tool) => tool.group === group);
              if (tools.length === 0) return null;
              return (
                <section key={group} className="mb-2 last:mb-0">
                  <p className="px-2 pb-1 pt-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{group}</p>
                  {tools.map((tool) => (
                    <button
                      type="button"
                      key={tool.id}
                      onClick={() => onSelect(tool)}
                      className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left outline-none transition hover:bg-slate-100 focus:bg-slate-100"
                    >
                      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white shadow-sm">{tool.icon}</span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-800">{tool.title}</span>
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{tool.command}</span>
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500">{tool.description}</span>
                      </span>
                    </button>
                  ))}
                </section>
              );
            }) : (
              <div className="p-5 text-center text-sm text-slate-500">No tool matches “{query}”.</div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
