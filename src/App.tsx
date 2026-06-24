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
    fetchUserInfo, 
    showNotification, 
    isAuthLoading,
    loginWithEmailAndPassword,
    registerWithEmailAndDetails,
    verifyEmailCode
  } = useApp();

  const [activeTab, setActiveTab] = React.useState<'login' | 'register' | 'forgot' | 'verify'>('login');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [verificationCode, setVerificationCode] = React.useState('');
  const [verificationEmail, setVerificationEmail] = React.useState('');
  const [debugCode, setDebugCode] = React.useState('');
  
  const [actionLoading, setActionLoading] = React.useState(false);
  const [formError, setFormError] = React.useState('');

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !newPassword.trim()) {
      setFormError("Email and new password are required.");
      return;
    }
    setFormError('');
    setActionLoading(true);

    try {
      const response = await fetch('/api/auth/force-reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: newPassword.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to reset password");
      
      showNotification('Password updated successfully! You can now log in.', 'success');
      setActiveTab('login');
      setPassword('');
      setNewPassword('');
    } catch (e: any) {
      setFormError(e.message || "Failed to update password.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setFormError("Email and password are required.");
      return;
    }
    setFormError('');
    setActionLoading(true);

    try {
      const res = await loginWithEmailAndPassword(email.trim(), password.trim());
      if (res.error) {
        setFormError(res.error);
      } else if (res.requiresVerification) {
        setVerificationEmail(res.email || email.trim());
        setDebugCode(res.debugCode || '');
        setActiveTab('verify');
      }
    } catch (e: any) {
      setFormError(e.message || "Failed to log in.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setFormError("Email and password are required.");
      return;
    }
    setFormError('');
    setActionLoading(true);

    try {
      const res = await registerWithEmailAndDetails({
         email: email.trim(),
         password: password.trim(),
         username: email.split('@')[0]
      });
      if (res.error) {
        setFormError(res.error);
      }
    } catch (e: any) {
      setFormError(e.message || "Failed to create account.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) {
      setFormError("Verification code is required.");
      return;
    }
    setFormError('');
    setActionLoading(true);

    try {
      const res = await verifyEmailCode(verificationEmail || email.trim(), verificationCode.trim());
      if (res.error) {
        setFormError(res.error);
      }
    } catch (e: any) {
      setFormError(e.message || "Failed to verify email.");
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
              {activeTab === 'login' ? 'Please log in to your account.' :
               activeTab === 'forgot' ? 'Reset your password to continue.' :
               activeTab === 'verify' ? `We sent a verification code to ${verificationEmail || email}.` :
               'Create a new account.'}
            </p>
          </div>
        </div>

        {activeTab !== 'verify' && (
          <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-1 border border-slate-200/30">
            <button
               onClick={() => { setActiveTab('login'); setFormError(''); }}
               className={`flex-1 text-center py-2 px-3 text-xs font-black rounded-xl transition-all ${activeTab === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
               SIGN IN
            </button>
            <button
               onClick={() => { setActiveTab('register'); setFormError(''); }}
               className={`flex-1 text-center py-2 px-3 text-xs font-black rounded-xl transition-all ${activeTab === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
               SIGN UP
            </button>
          </div>
        )}

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
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Password</label>
                <button 
                  type="button" 
                  onClick={() => { setActiveTab('forgot'); setFormError(''); }}
                  className="text-[10px] uppercase font-black text-primary-600 hover:text-primary-700 tracking-wider"
                >
                  Forgot Password?
                </button>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-xs font-bold p-3 border border-slate-200 rounded-xl bg-slate-50/50 focus:border-primary-600 focus:bg-white outline-none transition-all placeholder:text-slate-400"
              />
            </div>
            
            <button
              type="submit"
              disabled={actionLoading}
              className="w-full bg-slate-900 text-white font-black py-3 px-5 rounded-2xl cursor-pointer hover:bg-slate-800 active:scale-[0.98] transition-all text-xs tracking-wider flex items-center justify-center gap-2"
            >
              {actionLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : 'SIGN IN'}
            </button>
          </form>
        )}

        {activeTab === 'forgot' && (
          <form onSubmit={handleForgotSubmit} className="space-y-4">
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
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-xs font-bold p-3 border border-slate-200 rounded-xl bg-slate-50/50 focus:border-primary-600 focus:bg-white outline-none transition-all placeholder:text-slate-400"
              />
            </div>
            
            <button
              type="submit"
              disabled={actionLoading}
              className="w-full bg-slate-900 text-white font-black py-3 px-5 rounded-2xl cursor-pointer hover:bg-slate-800 active:scale-[0.98] transition-all text-xs tracking-wider flex items-center justify-center gap-2"
            >
              {actionLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : 'UPDATE PASSWORD & LOGIN'}
            </button>

            <button
               type="button"
               onClick={() => { setActiveTab('login'); setFormError(''); }}
               className="w-full text-xs font-bold text-slate-500 border border-slate-200 py-2.5 rounded-xl hover:bg-slate-50"
            >
               Back to Login
            </button>
          </form>
        )}

        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
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
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Set Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-xs font-bold p-3 border border-slate-200 rounded-xl bg-slate-50/50 focus:border-primary-600 focus:bg-white outline-none transition-all placeholder:text-slate-400"
              />
            </div>
            
            <button
              type="submit"
              disabled={actionLoading}
              className="w-full bg-slate-900 text-white font-black py-3 px-5 rounded-2xl cursor-pointer hover:bg-slate-800 active:scale-[0.98] transition-all text-xs tracking-wider flex items-center justify-center gap-2"
            >
              {actionLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : 'CREATE ACCOUNT'}
            </button>
          </form>
        )}

        {activeTab === 'verify' && (
          <form onSubmit={handleVerifySubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Verification Code</label>
              <input
                type="text"
                required
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter 6-digit code"
                className="w-full text-xs font-bold p-3 border border-slate-200 rounded-xl bg-slate-50/50 focus:border-primary-600 focus:bg-white outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            {debugCode && (
              <div className="bg-emerald-50 text-emerald-800 text-xs font-bold p-3 rounded-xl border border-emerald-200">
                💡 Local testing code: <code className="bg-white px-2 py-0.5 rounded border border-emerald-300 font-mono text-xs">{debugCode}</code>
              </div>
            )}
            
            <button
              type="submit"
              disabled={actionLoading}
              className="w-full bg-slate-900 text-white font-black py-3 px-5 rounded-2xl cursor-pointer hover:bg-slate-800 active:scale-[0.98] transition-all text-xs tracking-wider flex items-center justify-center gap-2"
            >
              {actionLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : 'VERIFY CODE'}
            </button>

            <button
               type="button"
               onClick={() => { setActiveTab('login'); setFormError(''); }}
               className="w-full text-xs font-bold text-slate-500 border border-slate-200 py-2.5 rounded-xl hover:bg-slate-50"
            >
               Back to Sign In
            </button>
          </form>
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
    </AppProvider>
  );
}
