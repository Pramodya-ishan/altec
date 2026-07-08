import React, { useEffect, Suspense, lazy } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';

import { TopNav } from './components/layout/TopNav';
import { Sidebar } from './components/layout/Sidebar';


// Lazy loaded views
const PaperStructureView = lazy(() => import('./components/views/PaperStructureView').then(m => ({ default: m.PaperStructureView })));
const PaperMarksView = lazy(() => import('./components/views/PaperMarksView').then(m => ({ default: m.PaperMarksView })));
const ProfileView = lazy(() => import('./components/views/ProfileView').then(m => ({ default: m.ProfileView })));
const PastPapersView = lazy(() => import('./components/views/PastPapersView').then(m => ({ default: m.PastPapersView })));
const AdmissionPredictorView = lazy(() => import('./components/views/AdmissionPredictorView').then(m => ({ default: m.AdmissionPredictorView })));
const AdminDashboardView = lazy(() => import('./components/views/AdminDashboardView').then(m => ({ default: m.AdminDashboardView })));

const FocusTodoView = lazy(() => import('./components/views/FocusTodoView').then(m => ({ default: m.FocusTodoView })));
const CloraXView = lazy(() => import('./components/views/CloraXView').then(m => ({ default: m.CloraXView })));

import { AddPaperMarksModal } from './components/modals/AddPaperMarksModal';
import { NotesModal } from './components/modals/NotesModal';
import { SilencePlayerModal } from './components/modals/SilencePlayerModal';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from './lib/firebase';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from './lib/utils';

function ToastNotification() {
  const { notifications, removeNotification } = useApp();

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[99999] pointer-events-none flex flex-col items-center justify-start h-40 w-full max-w-sm">
      <AnimatePresence>
        {notifications.map((notif, i) => {
          const isLatest = i === notifications.length - 1;
          const isPrevious = i < notifications.length - 1;

          if (isPrevious) return null;

          return (
            <motion.div
              key={notif.id}
              layout
              initial={{ opacity: 0, y: -40, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className={`absolute top-0 pointer-events-auto px-5 py-3.5 rounded-2xl shadow-xl font-bold text-white flex items-center gap-3 cursor-pointer min-w-[280px] max-w-[90vw] overflow-hidden ${
                notif.type === 'error' ? 'bg-red-600 border-2 border-red-500/50' : 
                notif.type === 'success' ? 'bg-emerald-600 border-2 border-emerald-500/50' : 
                'bg-slate-800 border-2 border-slate-700/50'
              }`}
              onClick={() => removeNotification(notif.id)}
            >
              <div className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center shrink-0">
                 {notif.type === 'success' && <i className="fa-solid fa-check text-sm text-emerald-100"></i>}
                 {notif.type === 'error' && <i className="fa-solid fa-xmark text-sm text-red-100"></i>}
                 {notif.type === 'info' && <i className="fa-solid fa-info text-sm text-slate-100"></i>}
              </div>
              <div className="text-[14px] font-semibold tracking-wide leading-tight flex-1">
                 {notif.message.replace(/\[RETRY:\d+\]/gi, '').replace(/(?:\(\s*|-?\s*)?retry in\s*(\d+(?:\.\d+)?)\s*(?:s|sec|seconds?)(?:\.\.\.|\.)?(?:\s*\))?/gi, '').trim() || "Network error. Please wait."}
              </div>
              <button 
                 className="w-6 h-6 rounded-full hover:bg-black/20 flex items-center justify-center transition-colors shrink-0 text-white"
                 onClick={(e) => { e.stopPropagation(); removeNotification(notif.id); }}
              >
                 <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function GlobalStars() {
  const { stars } = useApp();
  return (
    <div className="fixed inset-0 pointer-events-none z-[999999] overflow-hidden">
      <AnimatePresence>
        {stars.map((star) => (
          <motion.div
            key={star.id}
            initial={{ 
              opacity: 1, 
              scale: 0, 
              x: `${star.x}vw`, 
              y: `${star.y}vh`, 
              rotate: 0 
            }}
            animate={{ 
              opacity: [1, 1, 0], 
              scale: [0, star.size, 0],
              x: [`${star.x}vw`, `${star.x + star.driftX}vw`],
              y: [`${star.y}vh`, `${star.y + star.driftY}vh`],
              rotate: [0, star.rotateDeg]
            }}
            transition={{ duration: star.duration, ease: "easeOut" }}
            className="absolute text-yellow-500 drop-shadow-md"
          >
            <i className="fa-solid fa-star text-lg select-none pointer-events-none"></i>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function OnlineStatus() {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-0 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-2 rounded-b-xl shadow-lg z-[99999] flex items-center gap-2 font-bold text-sm"
        >
          <i className="fa-solid fa-cloud-bolt"></i> You are currently offline
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AuthOverlay() {
  const { 
    user, 
    loginWithGooglePopup,
    isAuthLoading
  } = useApp();

  const [actionLoading, setActionLoading] = React.useState(false);

  const handleGoogleLogin = async () => {
    setActionLoading(true);
    try {
      await loginWithGooglePopup();
    } finally {
      setActionLoading(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[999999] flex items-center justify-center p-4">
        <div className="bg-white rounded-[2rem] border border-slate-200/50 shadow-2xl p-10 max-w-sm w-full text-center flex flex-col items-center gap-6 ">
           <div className="relative flex items-center justify-center w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
              <div className="absolute inset-0 rounded-full border-4 border-primary-600 border-t-transparent animate-spin"></div>
              <i className="fa-solid fa-graduation-cap text-2xl text-primary-600 relative z-10"></i>
           </div>
           <div className="space-y-2">
              <h2 className="text-xl font-display font-bold text-slate-900">Loading Data...</h2>
              <p className="text-sm font-bold text-slate-500">Please wait while we sync your progress.</p>
           </div>
        </div>
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[999999] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-[2rem] border border-slate-200/50 shadow-2xl p-6 sm:p-8 max-w-md w-full text-center flex flex-col gap-6 my-8">
        
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-primary-100 text-primary-600 flex items-center justify-center text-3xl shadow-md border border-primary-200/50">
            <i className="fa-solid fa-graduation-cap"></i>
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-900 font-display">Clora X</h2>
            <p className="text-sm font-bold text-slate-500 max-w-xs leading-relaxed">
              Sign in with your Google account to access your personalized A/L dashboard.
            </p>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={actionLoading}
          className="w-full bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800 font-black py-4 px-6 rounded-2xl cursor-pointer active:scale-[0.98] transition-all text-sm tracking-wide flex items-center justify-center gap-3 shadow-sm"
        >
          {actionLoading ? (
            <i className="fa-solid fa-spinner animate-spin text-slate-400"></i>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-6 h-6">
                <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
              </svg>
              Sign in with Google
            </>
          )}
        </button>

      </div>
    </div>
  );
}

function AppContent() {
  const { currentSubject, theme, isSidebarOpen, setCurrentView } = useApp();
  const location = useLocation();

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  
  React.useEffect(() => {
     const path = location.pathname.split("/").pop() || "paper-structure";
     setCurrentView(path as any);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-primary-100 selection:text-primary-900 relative">
      <OnlineStatus />
      <ToastNotification />
      <AuthOverlay />
      <Sidebar />
      <div className={cn("flex flex-col min-h-screen transition-all duration-300", isSidebarOpen ? "lg:pl-72" : "lg:pl-16 pl-0")}>
        <TopNav />
        <main className={`relative w-full mx-auto flex-1 flex flex-col ${
          
          location.pathname === '/focus-todo' ? 'max-w-full px-0 py-0' :
          'max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-12'
        }`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: 'linear' }}
              className="relative w-full h-full flex-1 flex flex-col"
            >
              <Suspense fallback={<div className="flex-1 flex justify-center items-center py-24"><i className="fa-solid fa-spinner animate-spin text-4xl text-primary-600"></i></div>}>
                <Routes location={location} key={location.pathname}>
                  <Route path="/" element={<Navigate to="/admission-predictor" replace />} />
                  <Route path="/paper-structure" element={<PaperStructureView />} />
                  <Route path="/question-marks" element={<Navigate to="/paper-structure" replace />} />
                  <Route path="/paper-marks" element={<PaperMarksView />} />
                  <Route path="/lesson-marks" element={<Navigate to="/admission-predictor" replace />} />
                  <Route path="/admission-predictor" element={<AdmissionPredictorView />} />
                  <Route path="/ai-chat" element={<CloraXView />} />
                  <Route path="/profile" element={<ProfileView />} />
                  <Route path="/past-papers" element={<PastPapersView />} />
                  <Route path="/admin-dashboard" element={<AdminDashboardView />} />
                  
                  <Route path="/focus-todo" element={<Navigate to="/paper-structure" replace />} />
                </Routes>
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Modals */}
      <NotesModal />
      <AddPaperMarksModal />
      <SilencePlayerModal />
      
      {/* Global AI Advisor */}
      
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
