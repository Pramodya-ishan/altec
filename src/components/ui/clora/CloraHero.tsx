import React from 'react';
import { motion } from 'motion/react';

interface CloraHeroProps {
  onSelectPrompt?: (prompt: string) => void;
  prompts?: { title: string; prompt: string; icon: React.ReactNode; color?: string }[];
}

export function CloraHero({ onSelectPrompt, prompts }: CloraHeroProps) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-6 text-center max-w-4xl mx-auto mt-[-10vh]">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-8"
      >
        <div className="absolute inset-0 clora-hero-glow blur-3xl -z-10" />
        
        <p className="text-xl text-slate-500 font-medium max-w-lg mx-auto">
          Your personal AI for Sri Lankan Advanced Level exams. How can I help you today?
        </p>
      </motion.div>
    </div>
  );
}

