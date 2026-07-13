import React, { useEffect, Suspense, lazy } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';

import { TopNav } from './components/layout/TopNav';
import { Sidebar } from './components/layout/Sidebar';

// Lazy loaded views
const PaperStructureView = lazy(() => import('./components/views/PaperStructureView.tsx'));
const PaperMarksView = lazy(() => import('./components/views/PaperMarksView.tsx'));
const ProfileView = lazy(() => import('./components/views/ProfileView.tsx'));
const PastPapersView = lazy(() => import('./components/views/PastPapersView.tsx'));
const AdmissionPredictorView = lazy(() => import('./components/views/AdmissionPredictorView.tsx'));
const AdminDashboardView = lazy(() => import('./components/views/AdminDashboardView.tsx'));
const SyllabusLibraryView = lazy(() => import('./components/views/SyllabusLibraryView.tsx'));
const CloraXView = lazy(() => import('./components/views/CloraXView.tsx'));
const PdfSourcesPage = lazy(() => import('./pages/PdfSourcesPage.tsx'));
const QuestionCachePage = lazy(() => import('./pages/QuestionCachePage.tsx'));
const A3WarRoom = lazy(() => import('./pages/A3WarRoom.tsx'));
const ExamIntelligence = lazy(() => import('./pages/ExamIntelligence.tsx'));
const PredictionPapers = lazy(() => import('./pages/PredictionPapers.tsx'));
const MistakeNotebook = lazy(() => import('./pages/MistakeNotebook.tsx'));
const PdfIntelAdmin = lazy(() => import('./pages/PdfIntelAdmin.tsx'));

import { AddPaperMarksModal } from './components/modals/AddPaperMarksModal';
import { NotesModal } from './components/modals/NotesModal';
import { SilencePlayerModal } from './components/modals/SilencePlayerModal';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from './lib/utils';
import { CheckCircle2, XCircle, Info, X, CloudOff, GraduationCap, Loader2 } from 'lucide-react';

function ToastNotification() {
  const { notifications, removeNotification } = useApp();

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[99999] pointer-events-none flex flex-col items-center justify-start w-full max-w-sm gap-2">
      <AnimatePresence>
        {notifications.map((notif, i) => {
          if (i < notifications.length - 1) return null; // Show only latest

          return (
            <motion.div
              key={notif.id}
              layout
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "pointer-events-auto px-4 py-3 rounded-xl shadow-lg font-medium text-white flex items-center gap-3 cursor-pointer min-w-[280px] max-w-[90vw] overflow-hidden border",
                notif.type === 'error' ? 'bg-red-600 border-red-500' : 
                notif.type === 'success' ? 'bg-emerald-600 border-emerald-500' : 
                'bg-slate-800 border-slate-700'
              )}
              onClick={() => removeNotification(notif.id)}
            >
              <div className="shrink-0 flex items-center justify-center text-white/90">
                 {notif.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
                 {notif.type === 'error' && <XCircle className="w-5 h-5" />}
                 {notif.type === 'info' && <Info className="w-5 h-5" />}
              </div>
              <div className="text-[14px] leading-tight flex-1">
                 {notif.message.replace(/\[RETRY:\d+\]/gi, '').replace(/(?:\(\s*|-?\s*)?retry in\s*(\d+(?:\.\d+)?)\s*(?:s|sec|seconds?)(?:\.\.\.|\.)?(?:\s*\))?/gi, '').trim() || "Network error. Please wait."}
              </div>
              <button 
                 className="shrink-0 text-white/70 hover:text-white transition-colors"
                 onClick={(e) => { e.stopPropagation(); removeNotification(notif.id); }}
              >
                 <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
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
          <CloudOff className="w-4 h-4" /> You are currently offline
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function NotFoundView() {
  return (
    <section className="flex min-h-[60vh] flex-1 items-center justify-center px-6 py-16 text-center">
      <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">404</p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          This address is not an application page. Check the URL or return to the dashboard.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Return home
        </a>
      </div>
    </section>
  );
}

function AuthOverlay() {
  const { user, loginWithGooglePopup, isAuthLoading } = useApp();
  const [actionLoading, setActionLoading] = React.useState(false);

  const handleGoogleLogin = async () => {
    setActionLoading(true);
    try {
      await loginWithGooglePopup();
    } finally {
      setActionLoading(false);
    }
  };

  if (isAuthLoading) return null;

  if (user) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[999999] flex items-center justify-center p-4">
      <div className="bg-white rounded-[1.5rem] shadow-2xl p-8 max-w-sm w-full text-center flex flex-col gap-6">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm border border-indigo-100">
            <GraduationCap className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Clora X</h2>
            <p className="text-sm font-medium text-slate-500">
              Sign in with your Google account to access your A/L dashboard.
            </p>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={actionLoading}
          className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold py-3.5 px-6 rounded-xl cursor-pointer active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-3 shadow-sm"
        >
          {actionLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
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
  const { theme, isSidebarOpen, setCurrentView } = useApp();
  const location = useLocation();

  const isChatRoute = location.pathname === "/clora-x" || location.pathname === "/ai-chat";

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  
  React.useEffect(() => {
     let path = location.pathname.split("/").pop() || "paper-structure";
     if (path === 'ai-chat') {
       path = 'clora-x';
     }
     setCurrentView(path as any);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 relative">
      <OnlineStatus />
      <ToastNotification />
      <AuthOverlay />
      <Sidebar />
      <div className={cn("flex flex-col transition-all duration-300", isChatRoute ? "h-[100dvh] overflow-hidden bg-slate-50" : "min-h-screen bg-slate-50", isSidebarOpen ? "lg:pl-72" : "lg:pl-[72px] pl-0")}>
        <TopNav />
        <main
          className={cn(
            "relative w-full flex-1 flex flex-col min-h-0",
            isChatRoute
              ? "max-w-none p-0 overflow-hidden"
              : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
          )}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative w-full h-full flex-1 flex flex-col min-h-0"
            >
              <Suspense fallback={<div className="flex-1 w-full h-full p-4 sm:p-6 lg:p-8 animate-pulse flex flex-col gap-6">
                  <div className="w-1/3 h-8 bg-slate-200 rounded-xl mb-4"></div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="h-32 bg-slate-200 rounded-2xl"></div>
                    <div className="h-32 bg-slate-200 rounded-2xl"></div>
                    <div className="h-32 bg-slate-200 rounded-2xl"></div>
                  </div>
                  <div className="w-full h-64 bg-slate-200 rounded-2xl"></div>
                </div>}>
                <Routes location={location} key={location.pathname}>
                  <Route path="/" element={<Navigate to="/admission-predictor" replace />} />
                  <Route path="/paper-structure" element={<PaperStructureView />} />
                  <Route path="/question-marks" element={<Navigate to="/paper-structure" replace />} />
                  <Route path="/paper-marks" element={<PaperMarksView />} />
                  <Route path="/lesson-marks" element={<Navigate to="/admission-predictor" replace />} />
                  <Route path="/admission-predictor" element={<AdmissionPredictorView />} />
                  <Route path="/clora-x" element={<CloraXView />} />
                  <Route path="/ai-chat" element={<Navigate to="/clora-x" replace />} />
                  <Route path="/profile" element={<ProfileView />} />
                  <Route path="/past-papers" element={<PastPapersView />} />
                  <Route path="/admin-dashboard" element={<AdminDashboardView />} />
                  <Route path="/syllabus" element={<SyllabusLibraryView />} />
                  <Route path="/pdf-sources" element={<PdfSourcesPage />} />
                  <Route path="/question-cache" element={<QuestionCachePage />} />
                  <Route path="/a3-war-room" element={<A3WarRoom />} />
                  <Route path="/exam-intel" element={<ExamIntelligence />} />
                  <Route path="/prediction-papers" element={<PredictionPapers />} />
                  <Route path="/mistake-notebook" element={<MistakeNotebook />} />
                  <Route path="/pdf-intel-admin" element={<PdfIntelAdmin />} />
                  
                  <Route path="/focus-todo" element={<Navigate to="/paper-structure" replace />} />
                  <Route path="*" element={<NotFoundView />} />
                </Routes>
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <NotesModal />
      <AddPaperMarksModal />
      <SilencePlayerModal />
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
