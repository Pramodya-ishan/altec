import { useEffect, useState } from 'react';
import { Check, ChevronDown, Clock3, LogOut, Menu, Plus, User } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { calculateCurrentGradeFromData, cn } from '../../lib/utils';
import { resolveProfilePicture } from '../../lib/profilePicture';

const SUBJECTS = [
  { id: 'sft', label: 'SFT' },
  { id: 'et', label: 'ET' },
  { id: 'ict', label: 'ICT' },
] as const;

function SubjectTabs({ currentSubject, onChange }: { currentSubject: string; onChange: (subject: 'sft' | 'et' | 'ict') => void }) {
  return (
    <div className="grid grid-cols-3 rounded-xl border border-slate-200 bg-slate-50 p-1" aria-label="Select subject">
      {SUBJECTS.map((subject) => (
        <button
          key={subject.id}
          type="button"
          onClick={() => onChange(subject.id)}
          aria-pressed={currentSubject === subject.id}
          className={cn(
            'relative min-w-16 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
            currentSubject === subject.id
              ? 'bg-white text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-slate-200'
              : 'text-slate-500 hover:text-slate-800',
          )}
        >
          {subject.label}
        </button>
      ))}
    </div>
  );
}

export function TopNav() {
  const navigate = useNavigate();
  const {
    currentSubject,
    setCurrentSubject,
    setSidebarOpen,
    data,
    currentView,
    profile,
    user,
    logout,
  } = useApp();
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, active: false });
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    const updateCountdown = () => {
      const distance = new Date('2026-08-10T00:00:00+05:30').getTime() - Date.now();
      if (distance <= 0) {
        setCountdown({ days: 0, hours: 0, active: true });
        return;
      }
      setCountdown({
        days: Math.floor(distance / 86_400_000),
        hours: Math.floor((distance % 86_400_000) / 3_600_000),
        active: false,
      });
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const { grade } = calculateCurrentGradeFromData(data, currentSubject);
  const isAssistant = currentView === 'clora-x';
  const showSubjectControls = !['admission-predictor', 'focus-todo', 'clora-x'].includes(currentView);
  const avatar = resolveProfilePicture(profile?.picture, user?.picture, profile?.username || user?.email);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/90 bg-white/95 backdrop-blur-xl">
      <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="ui-icon-button lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex min-w-0 items-center gap-2 text-slate-600">
          <Clock3 className="h-4 w-4 shrink-0" />
          <span className="truncate text-xs font-medium sm:text-sm">
            {countdown.active ? 'Exam period' : `${countdown.days}d ${countdown.hours}h to A/L`}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {showSubjectControls && (
            <div className="hidden sm:block">
              <SubjectTabs currentSubject={currentSubject} onChange={setCurrentSubject} />
            </div>
          )}

          {showSubjectControls && (
            <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs md:flex">
              <span className="text-slate-500">Grade</span>
              <span className="font-semibold text-slate-950">{grade}</span>
            </div>
          )}

          {isAssistant ? (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('clora:new-chat'))}
              className="ui-button ui-button-secondary h-10 px-3.5"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New chat</span>
            </button>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen((open) => !open)}
                className="flex h-10 items-center gap-2 rounded-xl border border-transparent p-1 pr-2 transition hover:border-slate-200 hover:bg-slate-50"
                aria-expanded={accountOpen}
                aria-haspopup="menu"
              >
                <img src={avatar} alt="" className="h-8 w-8 rounded-lg border border-slate-200 object-cover" referrerPolicy="no-referrer" />
                <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
              </button>

              <AnimatePresence>
                {accountOpen && (
                  <>
                    <button className="fixed inset-0 z-40 cursor-default" onClick={() => setAccountOpen(false)} aria-label="Close account menu" />
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.98 }}
                      transition={{ duration: 0.14 }}
                      role="menu"
                      className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.14)]"
                    >
                      <div className="border-b border-slate-100 px-3 py-3">
                        <p className="truncate text-sm font-semibold text-slate-950">{profile?.username || user?.name || 'Student'}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{user?.email}</p>
                      </div>
                      <button type="button" role="menuitem" onClick={() => { navigate('/profile'); setAccountOpen(false); }} className="ui-menu-item mt-1">
                        <User className="h-4 w-4" /> Profile
                      </button>
                      <button type="button" role="menuitem" onClick={() => { void logout(); setAccountOpen(false); }} className="ui-menu-item text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                        <LogOut className="h-4 w-4" /> Sign out
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {showSubjectControls && (
        <div className="border-t border-slate-100 px-4 py-2 sm:hidden">
          <SubjectTabs currentSubject={currentSubject} onChange={setCurrentSubject} />
        </div>
      )}
    </header>
  );
}
