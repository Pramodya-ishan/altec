import React from 'react';
import { cn } from '../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface CloraShellProps {
  sidebar?: React.ReactNode;
  main: React.ReactNode;
  drawer?: React.ReactNode;
  isDrawerOpen?: boolean;
}

export function CloraShell({ sidebar, main, drawer, isDrawerOpen = false }: CloraShellProps) {
  return (
    <div className="flex w-full bg-slate-50 overflow-hidden font-sans text-slate-800" style={{ height: '100dvh' }}>
      {/* Sidebar - Desktop Only (Mobile would use bottom sheet or hamburger menu) */}
      {sidebar && (
        <aside className="hidden md:flex w-[260px] flex-shrink-0 flex-col bg-slate-900 border-r border-slate-200 z-20 text-white">
          {sidebar}
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col min-w-0 bg-white shadow-sm z-10 transition-all duration-300">
        <div className="absolute inset-0 clora-bg-gradient pointer-events-none opacity-60" />
        <div className="relative flex-1 flex flex-col h-full overflow-hidden">
          {main}
        </div>
      </main>

      {/* Right Drawer (Context, PDF, Reasoning) */}
      <AnimatePresence initial={false}>
        {drawer && isDrawerOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 360, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex-shrink-0 border-l border-slate-200 bg-white overflow-hidden z-20 hidden lg:block"
          >
            <div className="w-[360px] h-full flex flex-col">
              {drawer}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {drawer && isDrawerOpen && (
          <motion.div
             initial={{ opacity: 0, y: "100%" }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: "100%" }}
             transition={{ type: "spring", damping: 30, stiffness: 300 }}
             className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-black/60 backdrop-blur-sm"
          >
             <div className="bg-white w-full h-[85vh] rounded-t-3xl shadow-2xl flex flex-col overflow-hidden border-t border-slate-200">
                {drawer}
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
