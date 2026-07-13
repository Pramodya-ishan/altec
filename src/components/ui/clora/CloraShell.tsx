import React from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface CloraShellProps {
  sidebar?: React.ReactNode;
  main: React.ReactNode;
  drawer?: React.ReactNode;
  isDrawerOpen?: boolean;
}

export function CloraShell({ sidebar, main, drawer, isDrawerOpen = false }: CloraShellProps) {
  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-[#f7f7f8] font-sans text-slate-900">
      {sidebar && <aside className="hidden w-[260px] shrink-0 flex-col border-r border-slate-200 bg-white md:flex">{sidebar}</aside>}

      <main className="relative z-10 flex min-w-0 flex-1 flex-col bg-white">
        <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">{main}</div>
      </main>

      <AnimatePresence initial={false}>
        {drawer && isDrawerOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 360, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="z-20 hidden shrink-0 overflow-hidden border-l border-slate-200 bg-white lg:block"
          >
            <div className="flex h-full w-[360px] flex-col">{drawer}</div>
          </motion.aside>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {drawer && isDrawerOpen && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/35 backdrop-blur-sm lg:hidden"
          >
            <div className="flex h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl border-t border-slate-200 bg-white shadow-2xl">{drawer}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
