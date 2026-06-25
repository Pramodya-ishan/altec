import React, { useEffect, Suspense, lazy } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { useGoogleLogin } from '@react-oauth/google';
import { TopNav } from './components/layout/TopNav';
import { Sidebar } from './components/layout/Sidebar';
import { CloraAdvisorDrawer } from './components/layout/CloraAdvisorDrawer';

// Lazy loaded views
const PaperStructureView = lazy(() => import('./components/views/PaperStructureView').then(m => ({ default: m.PaperStructureView })));
const PaperMarksView = lazy(() => import('./components/views/PaperMarksView').then(m => ({ default: m.PaperMarksView })));
const ProfileView = lazy(() => import('./components/views/ProfileView').then(m => ({ default: m.ProfileView })));
const AdmissionPredictorView = lazy(() => import('./components/views/AdmissionPredictorView').then(m => ({ default: m.AdmissionPredictorView })));
const AdminDashboardView = lazy(() => import('./components/views/AdminDashboardView').then(m => ({ default: m.AdminDashboardView })));
const PastPapersView = lazy(() => import('./components/views/PastPapersView').then(m => ({ default: m.PastPapersView })));
const FocusTodoView = lazy(() => import('./components/views/FocusTodoView').then(m => ({ default: m.FocusTodoView })));

import { AddPaperMarksModal } from './components/modals/AddPaperMarksModal';
import { PlaylistModal } from './components/modals/PlaylistModal';
import { SilencePlayerModal } from './components/modals/SilencePlayerModal';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from './lib/utils';
import { Analytics } from '@vercel/analytics/react';

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
    fetchUserInfo, 
    showNotification, 
    isAuthLoading
  } = useApp();

  const [activeTab, setActiveTab] = React.useState<'login' | 'verify'>('login');
  const [email, setEmail] = React.useState('');
  
  const [actionLoading, setActionLoading] = React.useState(false);
  const [formError, setFormError] = React.useState('');

  React.useEffect(() => {
    // Check if coming back from email link
    const checkEmailLink = async () => {
      try {
        const { isSignInWithEmailLink, signInWithEmailLink } = await import('firebase/auth');
        const { auth } = await import('./lib/firebase');
        if (auth && isSignInWithEmailLink(auth, window.location.href)) {
          let savedEmail = window.localStorage.getItem('emailForSignIn');
          if (!savedEmail) {
            savedEmail = window.prompt('Please provide your email for confirmation');
          }
          if (savedEmail) {
            setActionLoading(true);
            setActiveTab('verify');
            const result = await signInWithEmailLink(auth, savedEmail, window.location.href);
            window.localStorage.removeItem('emailForSignIn');
            showNotification('Successfully signed in with email link!', 'success');
            await fetchUserInfo(result.user.uid); // or whatever
          }
        }
      } catch (e: any) {
        setFormError(e.message || "Failed to process email link");
      } finally {
        setActionLoading(false);
      }
    };
    checkEmailLink();
  }, [fetchUserInfo, showNotification]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setFormError("Email is required.");
      return;
    }
    setFormError('');
    setActionLoading(true);

    try {
      const { sendSignInLinkToEmail } = await import('firebase/auth');
      const { auth } = await import('./lib/firebase');
      
      const actionCodeSettings = {
        url: window.location.origin,
        handleCodeInApp: true,
      };
      
      await sendSignInLinkToEmail(auth, email.trim(), actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', email.trim());
      setActiveTab('verify');
      showNotification('Login link sent to your email!', 'success');
    } catch (e: any) {
      setFormError(e.message || "Failed to send email link.");
    } finally {
      setActionLoading(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[999999] flex items-center justify-center p-4">
        <div className="bg-white rounded-[2rem] border border-slate-200/50 shadow-2xl p-10 max-w-sm w-full text-center flex flex-col items-center gap-6 animate-in zoom-in-95 duration-200">
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
      <div className="bg-white rounded-[2rem] border border-slate-200/50 shadow-2xl p-6 sm:p-8 max-w-md w-full text-left flex flex-col gap-6 animate-in zoom-in-95 duration-200 my-8">
        
        <div className="text-center flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-primary-100 text-primary-600 flex items-center justify-center text-2xl shadow-md border border-primary-200/50">
            <i className="fa-solid fa-graduation-cap"></i>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500 max-w-xs leading-relaxed">
              {activeTab === 'login' ? 'Please enter your email to receive a secure login link. No password required.' :
               'Check your email inbox to complete sign in.'}
            </p>
          </div>
        </div>

        {formError && (
          <div className="bg-red-50 text-red-700 text-xs font-bold p-3.5 rounded-2xl border border-red-200 flex items-center gap-2">
            <i className="fa-solid fa-circle-exclamation text-red-500"></i>
            {formError}
          </div>
        )}

        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full text-xs font-bold p-3 border border-slate-200 rounded-xl bg-slate-50/50 focus:border-primary-600 focus:bg-white outline-none transition-all placeholder:text-slate-400"
              />
            </div>
            
            <button
              type="submit"
              disabled={actionLoading}
              className="w-full bg-slate-900 text-white font-black py-3 px-5 rounded-2xl cursor-pointer hover:bg-slate-800 active:scale-[0.98] transition-all text-xs tracking-wider flex items-center justify-center gap-2"
            >
              {actionLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : 'SEND LOGIN LINK'}
            </button>
          </form>
        )}

        {activeTab === 'verify' && (
          <div className="space-y-5">
            <div className="bg-emerald-50 text-emerald-800 text-xs font-bold p-4 rounded-2xl border border-emerald-200/80 space-y-2">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-envelope-circle-check text-emerald-600"></i>
                <span>Magic link sent!</span>
              </div>
              <p className="font-semibold text-[11px] text-emerald-700/90 pl-5 leading-normal">
                Check <strong>{window.localStorage.getItem('emailForSignIn') || email}</strong> for the magic link. Click the link in the email to instantly securely sign in.
              </p>
            </div>
            
            <button
               onClick={() => setActiveTab('login')}
               className="w-full text-xs font-bold text-slate-500 border border-slate-200 py-2.5 rounded-xl hover:bg-slate-50"
            >
               Use a different email
            </button>
          </div>
        )}

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
          location.pathname === '/past-papers' ? 'max-w-full px-0 py-0' : 
          location.pathname === '/focus-todo' ? 'max-w-full px-0 py-0' :
          'max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-12'
        }`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15, scale: 0.99 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
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
                  <Route path="/ai-chat" element={<Navigate to="/admission-predictor" replace />} />
                  <Route path="/profile" element={<ProfileView />} />
                  <Route path="/admin-dashboard" element={<AdminDashboardView />} />
                  <Route path="/past-papers" element={<Navigate to="/paper-marks" replace />} />
                  <Route path="/focus-todo" element={<Navigate to="/paper-structure" replace />} />
                </Routes>
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Modals */}
      <PlaylistModal />
      <AddPaperMarksModal />
      <SilencePlayerModal />
      
      {/* Global AI Advisor */}
      <CloraAdvisorDrawer />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
      <Analytics />
    </AppProvider>
  );
}
