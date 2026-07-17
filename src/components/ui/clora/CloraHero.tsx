import React from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';

interface CloraHeroProps {
  onSelectPrompt?: (prompt: string) => void;
  prompts?: { title: string; prompt: string; icon: React.ReactNode; color?: string }[];
}

export function CloraHero({ onSelectPrompt, prompts = [] }: CloraHeroProps) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-5 py-10 sm:px-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        <h1 className="max-w-xl text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">What would you like to study?</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
          Study with A/L subjects, past papers, lesson resources, and your notes.
        </p>

        <div className="mt-7 grid gap-2 sm:grid-cols-2">
          {prompts.map((item, index) => (
            <motion.button
              key={item.title}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * index, duration: 0.3 }}
              onClick={() => onSelectPrompt?.(item.prompt)}
              className="group flex min-h-[84px] items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">{item.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-800">{item.title}</span>
                <span className="mt-1 block truncate text-xs text-slate-400">{item.prompt}</span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-slate-600" />
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
