import { Menu, Search, Bell, X, LogOut, User, ChevronRight, XCircle, Book, Clock, Cloud, RefreshCw, HardDrive, Plus, History, Trash2 } from "lucide-react";
import { setPendingTopicHighlight } from "../../lib/navigationIntent";
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { cn, calculateCurrentGradeFromData } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { SYLLABUS } from '../../constants/syllabus';

import { isFirebaseEnabled } from '../../lib/firebase';

function SubjectToggle({ layoutIdPrefix, currentSubject, setCurrentSubject }: { layoutIdPrefix: string, currentSubject: string, setCurrentSubject: (s: any) => void }) {
  return (
    <div id={`${layoutIdPrefix}-subject-toggle-wrapper`} className="flex bg-slate-100/80 p-1 rounded-full gap-1 shadow-inner border border-slate-200 w-full sm:w-auto relative items-center">
      {(['sft', 'et', 'ict'] as const).map(sub => (
        <button type="button"
          key={sub}
          id={`${layoutIdPrefix}-toggle-btn-${sub}`}
          onClick={() => setCurrentSubject(sub)}
          className={cn(
            "relative px-4 sm:px-6 py-1.5 rounded-full text-sm font-display font-bold uppercase transition-colors duration-300 cursor-pointer flex-1 sm:flex-none text-center z-10",
            currentSubject === sub
              ? "text-primary-700"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
          )}
        >
          {currentSubject === sub && (
            <motion.div
              layoutId={`${layoutIdPrefix}-active-subject`}
              className="absolute inset-0 bg-white shadow-sm border border-slate-200/60 rounded-full -z-10"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className="relative z-10">{sub}</span>
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
    isSidebarOpen,
    setAdvisorOpen,
    data,
    currentView,
    pushNotifications,
    profile,
    markPushNotificationAsRead,
    user,
    logout
  } = useApp();

  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, active: false });
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showProfilePopup, setShowProfilePopup] = useState(false);

  // Syllabus Search State and Reference Data
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  const allSyllabusTopics = useMemo(() => {
    const list: { subject: 'sft' | 'et' | 'ict'; topic: string; sectionName: string }[] = [];
    
    (['sft', 'et', 'ict'] as const).forEach(subj => {
      const sDef = SYLLABUS[subj];
      if (!sDef) return;
      
      const seen = new Set<string>();
      
      sDef.mcqItems?.forEach(item => {
        if (item.title && !seen.has(item.title)) {
          seen.add(item.title);
          list.push({ subject: subj, topic: item.title, sectionName: "MCQ & Checklist" });
        }
      });
      
      sDef.partAItems?.forEach(item => {
        item.topics?.forEach(t => {
          if (t && !seen.has(t)) {
            seen.add(t);
            list.push({ subject: subj, topic: t, sectionName: "Structured Essay Part A" });
          }
        });
      });
      
      sDef.bcdGroups?.forEach(group => {
        group.items?.forEach(item => {
          item.topics?.forEach(t => {
            if (t && !seen.has(t)) {
              seen.add(t);
              list.push({ subject: subj, topic: t, sectionName: group.title || "Essay Part B/C/D" });
            }
          });
        });
      });
    });
    
    return list;
  }, []);

  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    return allSyllabusTopics.filter(item => 
      item.topic.toLowerCase().includes(query) || 
      item.subject.toLowerCase().includes(query) ||
      item.sectionName.toLowerCase().includes(query)
    ).slice(0, 5);
  }, [searchQuery, allSyllabusTopics]);

  const handleTopicSelect = (subject: 'sft' | 'et' | 'ict', topic: string, view: 'paper-structure') => {
    setCurrentSubject(subject);
    setPendingTopicHighlight(topic);
    navigate(`/${view}`);
    setSearchQuery("");
    setShowSearchResults(false);
  };

  const renderSearchBar = () => (
    <div className="relative w-full max-w-full md:max-w-md z-[60]">
      <div className="relative">
        <input
          type="text"
          placeholder="Search syllabus topics (for example, Logic Gates)"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowSearchResults(true);
          }}
          onFocus={() => setShowSearchResults(true)}
          className="w-full bg-slate-100 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs font-sans font-semibold pl-9 pr-8 py-2 rounded-full hover:bg-slate-200/40 focus:bg-white focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500 shadow-inner outline-none transition-all"
        />
        
        {searchQuery && (
          <button type="button" 
            onClick={() => {
              setSearchQuery("");
              setShowSearchResults(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {showSearchResults && searchQuery && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowSearchResults(false)} />
            <motion.div 
              initial={{ opacity: 0, y: -5 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -5 }} 
              transition={{ duration: 0.15 }}
              className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 origin-top">
              {filteredResults.length === 0 ? (
                <div className="p-3 text-center text-xs font-medium text-slate-400">
                  No matching lesson found.
                </div>
              ) : (
                filteredResults.map((item, idx) => (
                  <div 
                    key={idx} 
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 hover:bg-slate-50 gap-2 transition-colors duration-150"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded-full tracking-wider bg-primary-100 text-primary-700">
                          {item.subject.toUpperCase()}
                        </span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                          {item.sectionName}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 leading-tight mt-1 capitalize truncate" title={item.topic}>
                        {item.topic}
                      </h4>
                    </div>
                    
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button"
                        onClick={() => handleTopicSelect(item.subject, item.topic, 'paper-structure')}
                        className="flex items-center gap-1 bg-primary-50 hover:bg-primary-600 text-primary-700 hover:text-white px-2.5 py-1 rounded-lg text-[9px] font-black transition-colors cursor-pointer border border-primary-100"
                        title="Jump to Syllabus, Notes and Files"
                      >
                        <Book className="w-4 h-4" />
                        Notes
                      </button>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );

  const [syncStatus, setSyncStatus] = useState<'Local' | 'Cloud' | 'Syncing'>('Local');

  useEffect(() => {
    const updateOnlineStatus = () => {
      if (!navigator.onLine) {
        setSyncStatus('Local');
      } else if (isFirebaseEnabled) {
        setSyncStatus('Syncing');
        setTimeout(() => setSyncStatus('Cloud'), 1500); // Simulate sync finish
      } else {
        setSyncStatus('Local');
      }
    };
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    updateOnlineStatus();

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    const updateCountdown = () => {
      const targetDate = new Date(import.meta.env.VITE_AL_EXAM_START_DATE || "2026-08-10T00:00:00+05:30").getTime();
      const now = new Date().getTime();
      const distance = targetDate - now;

      if (distance < 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0, active: true });
        return;
      }
      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);
      setCountdown({ days, hours, minutes, seconds, active: false });
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, []);

  const { grade: currentGrade } = calculateCurrentGradeFromData(data, currentSubject);
  const unreadCount = pushNotifications.filter(n => !n.read).length;

  return (
    <nav className="sticky top-0 z-50 flex min-w-0 flex-col gap-3 bg-white/95 px-4 py-3 backdrop-blur-md sm:px-6">
      {/* Top Row: Menu & Countdown + Desktop Search + Right Controls */}
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-primary-600 tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {countdown.active ? (
                <span>Exams active!</span>
              ) : (
                <>
                  <span className="sm:hidden tabular-nums">{countdown.days}d {countdown.hours}h {countdown.minutes}m {countdown.seconds}s</span>
                  <span className="hidden sm:inline tabular-nums">{countdown.days}d {countdown.hours}h {countdown.minutes}m {countdown.seconds}s to A/L</span>
                </>
              )}
            </span>
          </div>
        </div>


        <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-4">


          {currentView !== 'admission-predictor' && currentView !== 'focus-todo' && currentView !== 'clora-x' && (
            <>
              <div className="hidden sm:block">
                <SubjectToggle layoutIdPrefix="desktop" currentSubject={currentSubject} setCurrentSubject={setCurrentSubject} />
              </div>
              <div className="flex items-center gap-2 bg-primary-50 text-primary-600 px-4 py-1.5 rounded-full font-bold text-sm border border-primary-600/20 shadow-sm mr-2">
                Grade <span>{currentGrade}</span>
              </div>
            </>
          )}

          {currentView === 'clora-x' ? (
            <div className="flex items-center gap-1.5" aria-label="Chat actions">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('clora:new-chat'))}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                aria-label="New chat"
                title="New chat"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New chat</span>
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('clora:clear-chat'))}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                aria-label="Clear chat"
                title="Clear chat"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Clear</span>
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('clora:history'))}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                aria-label="Chat history"
                title="Chat history"
              >
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">History</span>
              </button>
            </div>
          ) : (
          <div className="flex items-center gap-3">
            
            <div className="relative">
              <button type="button"
                onClick={() => setShowProfilePopup(!showProfilePopup)}
                className={cn(
                "w-10 h-10 rounded-full overflow-hidden border-2 bg-slate-50 relative shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0",
                showProfilePopup || currentView === 'profile' ? "border-primary-600" : "border-slate-200 hover:border-slate-300"
              )}
              title="User Account Menu"
            >
              <img
                src={profile?.picture || user?.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(profile?.username || user?.email || 'LocalStudent')}`}
                alt="Profile"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.src = `https://api.dicebear.com/7.x/bottts/svg?seed=LocalStudent`;
                }}
              />
            </button>

                        <AnimatePresence>
            {showProfilePopup && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfilePopup(false)} />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  className="absolute right-0 mt-3 w-64 bg-white border border-slate-200 rounded-[1.25rem] shadow-2xl shadow-slate-200/50 z-50 p-1.5 flex flex-col origin-top-right">
                  
                  <div className="flex items-center gap-3 px-3 py-3 mb-1 border-b border-slate-100/80 bg-slate-50/50 rounded-t-xl">
                    <img
                      src={profile?.picture || user?.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(profile?.username || user?.email || 'LocalStudent')}`}
                      alt="Profile"
                      className="w-10 h-10 rounded-full bg-slate-200 object-cover shadow-sm ring-2 ring-white"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src = `https://api.dicebear.com/7.x/bottts/svg?seed=LocalStudent`;
                      }}
                    />
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-none">Logged In As</p>
                      <p className="text-sm font-black text-slate-800 truncate mt-1 leading-tight">@{profile?.username || user?.name || 'Student'}</p>
                    </div>
                  </div>
                  
                  <button type="button"
                    onClick={() => {
                      navigate('/profile');
                      setShowProfilePopup(false);
                    }}
                    className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 text-slate-700 text-sm font-bold transition-all cursor-pointer group active:scale-[0.98]"
                  >
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors">
                      <User className="w-4 h-4" />
                    </div>
                    <span className="flex-1 group-hover:text-primary-700 transition-colors">My Profile</span>
                    <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                  </button>
                  
                  <div className="h-px w-full bg-slate-100 my-1"></div>
                  
                  <button type="button"
                    onClick={() => {
                      logout();
                      setShowProfilePopup(false);
                    }}
                    className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl hover:bg-rose-50 text-rose-600 text-sm font-bold transition-all cursor-pointer group active:scale-[0.98]"
                  >
                    <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-400 group-hover:bg-rose-100 group-hover:text-rose-600 transition-colors">
                      <LogOut className="w-4 h-4" />
                    </div>
                    <span className="group-hover:text-rose-700 transition-colors">Sign Out</span>
                  </button>
                </motion.div>
              </>
            )}
            </AnimatePresence>
            </div>
          </div>
          )}
        </div>
      </div>


      {/* Bottom Row: Mobile Subject Toggle */}
      {currentView !== 'admission-predictor' && currentView !== 'focus-todo' && currentView !== 'clora-x' && (
        <div className="flex justify-center sm:hidden pb-1">
          <SubjectToggle layoutIdPrefix="mobile" currentSubject={currentSubject} setCurrentSubject={setCurrentSubject} />
        </div>
      )}
    </nav>
  );
}
