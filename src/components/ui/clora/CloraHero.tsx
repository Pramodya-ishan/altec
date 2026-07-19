import React from 'react';
import { motion } from 'motion/react';

interface CloraHeroProps {
  onSelectPrompt?: (prompt: string) => void;
  prompts?: { title: string; prompt: string; icon: React.ReactNode; color?: string }[];
}

export function CloraHero(_: CloraHeroProps) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-5 py-10 sm:px-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <h1 className="max-w-xl text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
          What would you like to learn?
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
          Ask a question in Sinhala or English.
        </p>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          AI Assistant · Made by Pramodya Ishan
        </p>
      </motion.div>
    </div>
  );
}
