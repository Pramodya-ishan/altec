import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { cn, calculateCurrentGradeFromData } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { SYLLABUS } from '../../constants/syllabus';

function SubjectToggle({ layoutIdPrefix, currentSubject, setCurrentSubject }: { layoutIdPrefix: string, currentSubject: string, setCurrentSubject: (s: any) => void }) {
  return (
    <div id={`${layoutIdPrefix}-subject-toggle-wrapper`} className="flex bg-slate-100/80 p-1 rounded-full gap-1 shadow-inner border border-slate-200 w-full sm:w-auto relative items-center">
      {(['sft', 'et', 'ict'] as const).map(sub => (
        <button
          key={sub}
          id={`${layoutIdPrefix}-toggle-btn-${sub}`}
          onClick={() => setCurrentSubject(sub)}
          className={cn(
            "relative px-4 sm:px-6 py-1.5 rounded-full text-sm font-display font-bold uppercase transition-colors duration-200 cursor-pointer flex-1 sm:flex-none text-center z-10",
            currentSubject === sub
              ? "text-primary-700"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
          )}
        >
          {currentSubject === sub && (
             <motion.div
               layoutId={`${layoutIdPrefix}-active-subject`}
               className="absolute inset-0 bg-white shadow-sm border border-slate-200/60 rounded-full"
               transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
               style={{ zIndex: -1 }}
             />
          )}
          {sub}
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

  const [countdown, setCountdown] = useState('Calculating...');
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
    localStorage.setItem('search_highlight_topic', topic);
    navigate(`/${view}`);
    setSearchQuery("");
    setShowSearchResults(false);
  };

  const renderSearchBar = () => (
    <div className="relative w-full max-w-full md:max-w-md z-[60]">
      <div className="relative">
        <input
          type="text"
          placeholder="🔍 Search syllabus topics (e.g. Logic Gates, සෛල)..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowSearchResults(true);
          }}
          onFocus={() => setShowSearchResults(true)}
          className="w-full bg-slate-100 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs font-sans font-semibold pl-9 pr-8 py-2 rounded-full hover:bg-slate-200/40 focus:bg-white focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500 shadow-inner outline-none transition-all"
        />
        
        {searchQuery && (
          <button 
            onClick={() => {
              setSearchQuery("");
              setShowSearchResults(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <i className="fa-solid fa-circle-xmark text-xs sm:text-sm"></i>
          </button>
        )}
      </div>

      <AnimatePresence>
        {showSearchResults && searchQuery && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowSearchResults(false)} />
            <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 animate-in fade-in slide-in-from-top-1 duration-150">
              {filteredResults.length === 0 ? (
                <div className="p-3 text-center text-xs font-medium text-slate-400">
                  No matching syllabus topics found.
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
                      <button
                        onClick={() => handleTopicSelect(item.subject, item.topic, 'paper-structure')}
                        className="flex items-center gap-1 bg-primary-50 hover:bg-primary-600 text-primary-700 hover:text-white px-2.5 py-1 rounded-lg text-[9px] font-black transition-colors cursor-pointer border border-primary-100"
                        title="Jump to Syllabus, Notes and Files"
                      >
                        <i className="fa-solid fa-book"></i>
                        Notes
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );

  const [syncStatus, setSyncStatus] = useState<'Local' | 'Cloud' | 'Syncing'>('Local');

  useEffect(() => {
    import('../../lib/firebase').then(({ isFirebaseEnabled }) => {
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
    });
  }, []);

  useEffect(() => {
    const updateCountdown = () => {
      const targetDate = new Date("August 10, 2026 00:00:00").getTime();
      const now = new Date().getTime();
      const distance = targetDate - now;

      if (distance < 0) {
        setCountdown("Exams active!");
        return;
      }
      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      setCountdown(`${days}d ${hours}h to A/L`);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, []);

  const { grade: currentGrade } = calculateCurrentGradeFromData(data, currentSubject);
  const unreadCount = pushNotifications.filter(n => !n.read).length;

  return (
    <nav className="bg-white/95 backdrop-blur-md px-6 py-3 sticky top-0 z-50 flex flex-col gap-3">
      {/* Top Row: Menu & Countdown + Desktop Search + Right Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-10 h-10 rounded-xl flex items-center justify-center border border-slate-200 text-slate-700 bg-white shadow-sm hover:!bg-primary-50 hover:!text-primary-600 hover:!border-primary-600 transition-all active:scale-95 cursor-pointer"
            aria-label="Open Menu"
            title="Open Menu"
          >
            <i className="fa-solid fa-bars text-lg"></i>
          </button>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-primary-600 tracking-wider flex items-center gap-1.5">
              <i className="fa-regular fa-clock"></i>
              <span>{countdown}</span>
            </span>
          </div>
        </div>


        <div className="flex items-center gap-4">
          {/* Sync Indicator */}
          <div className={cn(
            "hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-all",
            syncStatus === 'Cloud' ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
            syncStatus === 'Syncing' ? "bg-amber-50 text-amber-600 border-amber-200" :
            "bg-slate-50 text-slate-500 border-slate-200"
          )} title="Storage Status">
            {syncStatus === 'Cloud' && <i className="fa-solid fa-cloud-check"></i>}
            {syncStatus === 'Syncing' && <i className="fa-solid fa-arrows-rotate animate-spin"></i>}
            {syncStatus === 'Local' && <i className="fa-solid fa-hard-drive"></i>}
            <span>{syncStatus}</span>
          </div>

          {currentView !== 'admission-predictor' && currentView !== 'focus-todo' && (
            <>
              <div className="hidden sm:block">
                <SubjectToggle layoutIdPrefix="desktop" currentSubject={currentSubject} setCurrentSubject={setCurrentSubject} />
              </div>
              <div className="flex items-center gap-2 bg-primary-50 text-primary-600 px-4 py-1.5 rounded-full font-bold text-sm border border-primary-600/20 shadow-sm mr-2">
                Grade <span>{currentGrade}</span>
              </div>
            </>
          )}

          {/* Quick Profile Icon Access with Dropdown Popup */}
          <div className="flex items-center gap-3">
            <button
               onClick={() => setAdvisorOpen(true)}
               className="hidden sm:flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs tracking-wider uppercase hover:bg-indigo-100 hover:border-indigo-300 transition-colors shadow-sm cursor-pointer"
               title="1st Edition"
            >
              <i className="fa-solid fa-robot"></i>
              <span>1st Edition</span>
            </button>
            <div className="relative">
              <button
                onClick={() => setShowProfilePopup(!showProfilePopup)}
                className={cn(
                "w-10 h-10 rounded-full overflow-hidden border-2 bg-slate-50 relative shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0",
                showProfilePopup || currentView === 'profile' ? "border-primary-600" : "border-slate-200 hover:border-slate-300"
              )}
              title="User Account Menu"
            >
              <img
                src={profile?.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(profile?.username || 'LocalStudent')}`}
                alt="Profile"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.src = `https://api.dicebear.com/7.x/bottts/svg?seed=LocalStudent`;
                }}
              />
            </button>

            {showProfilePopup && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfilePopup(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-3 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center gap-2 px-1 pb-2 border-b border-slate-100">
                    <img
                      src={profile?.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(profile?.username || 'LocalStudent')}`}
                      alt="Profile"
                      className="w-8 h-8 rounded-full bg-slate-100 object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src = `https://api.dicebear.com/7.x/bottts/svg?seed=LocalStudent`;
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Logged In As</p>
                      <p className="text-xs font-black text-slate-800 truncate mt-1">@{profile?.username || user?.name || 'Student'}</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      navigate('/profile');
                      setShowProfilePopup(false);
                    }}
                    className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    <i className="fa-solid fa-user text-slate-400"></i> View Profile
                  </button>

                  <button
                    onClick={() => {
                      logout();
                      setShowProfilePopup(false);
                    }}
                    className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg hover:bg-red-50 text-red-600 text-xs font-bold transition-all border border-transparent hover:border-red-100 cursor-pointer"
                  >
                    <i className="fa-solid fa-right-from-bracket text-xs"></i> Log Out
                  </button>
                </div>
              </>
            )}
            </div>
          </div>
        </div>
      </div>


      {/* Bottom Row: Mobile Subject Toggle */}
      {currentView !== 'admission-predictor' && currentView !== 'focus-todo' && (
        <div className="flex justify-center sm:hidden pb-1">
          <SubjectToggle layoutIdPrefix="mobile" currentSubject={currentSubject} setCurrentSubject={setCurrentSubject} />
        </div>
      )}
    </nav>
  );
}
