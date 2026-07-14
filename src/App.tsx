import React, { useEffect, Suspense, lazy } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';

import { TopNav } from './components/layout/TopNav';
import { Sidebar } from './components/layout/Sidebar';

// Core routes stay in the main bundle so tab switching never replaces the
// existing workspace with a network-dependent full-page loader.
import PaperStructureView from './components/views/PaperStructureView.tsx';
import PaperMarksView from './components/views/PaperMarksView.tsx';
import ProfileView from './components/views/ProfileView.tsx';
import PastPapersView from './components/views/PastPapersView.tsx';
import AdmissionPredictorView from './components/views/AdmissionPredictorView.tsx';
import CloraXView from './components/views/CloraXView.tsx';

// Administrative and rarely used tools remain route-split.
const AdminDashboardView = lazy(() => import('./components/views/AdminDashboardView.tsx'));
const SyllabusLibraryView = lazy(() => import('./components/views/SyllabusLibraryView.tsx'));
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
import { CheckCircle2, XCircle, Info, X, CloudOff, Loader2 } from 'lucide-react';
import { PageSkeleton } from './components/ui/PageSkeleton';

function ToastNotification() {
  const { notifications, removeNotification } = useApp();

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[99999] pointer-events-none flex flex-col items-center justify-start w-full max-w-sm gap-2" aria-live="polite">
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
                "pointer-events-auto min-w-[280px] max-w-[90vw] cursor-pointer overflow-hidden rounded-xl border bg-white px-4 py-3 font-medium text-slate-800 shadow-[0_16px_40px_rgba(15,23,42,0.14)] flex items-center gap-3",
                notif.type === 'error' ? 'border-rose-200' :
                notif.type === 'success' ? 'border-emerald-200' :
                'border-slate-200'
              )}
              onClick={() => removeNotification(notif.id)}
            >
              <div className={cn("shrink-0 flex items-center justify-center", notif.type === 'error' ? 'text-rose-600' : notif.type === 'success' ? 'text-emerald-600' : 'text-slate-500')}>
                 {notif.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
                 {notif.type === 'error' && <XCircle className="w-5 h-5" />}
                 {notif.type === 'info' && <Info className="w-5 h-5" />}
              </div>
              <div className="text-[14px] leading-tight flex-1">
                 {notif.message.replace(/\[RETRY:\d+\]/gi, '').replace(/(?:\(\s*|-?\s*)?retry in\s*(\d+(?:\.\d+)?)\s*(?:s|sec|seconds?)(?:\.\.\.|\.)?(?:\s*\))?/gi, '').trim() || "Network error. Please wait."}
              </div>
              <button 
                 className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                 onClick={(e) => { e.stopPropagation(); removeNotification(notif.id); }}
                 aria-label="Dismiss notification"
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

  if (isAuthLoading) {
    return (
      <div className="fixed inset-0 z-[999999] bg-white" role="status" aria-live="polite" aria-label="Checking sign-in">
        <div className="mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-5 py-5 sm:px-8">
          <div className="flex h-12 items-center justify-between border-b border-slate-100">
            <div className="h-3 w-32 animate-pulse rounded bg-slate-200/80" />
            <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-200/70" />
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Preparing your workspace</p>
                <p className="text-xs text-slate-500">Restoring your secure session</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="fixed inset-0 z-[999999] grid min-h-[100dvh] place-items-center overflow-y-auto bg-white p-5">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.07),transparent_38%)]" />
      <main className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-xl bg-slate-950 text-sm font-bold text-white">AL</div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Technology stream</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-slate-950">Your learning workspace</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">Lessons, past papers, results and study tools in one focused place.</p>
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.09)] sm:p-7">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-950">Continue to your dashboard</h2>
            <p className="mt-1 text-sm text-slate-500">Sign in with the Google account connected to your learning data.</p>
          </div>
          <button onClick={handleGoogleLogin} disabled={actionLoading} className="ui-button ui-button-secondary h-12 w-full">
            {actionLoading ? <Loader2 className="h-5 w-5 animate-spin text-slate-500" /> : <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
              </svg>
              Continue with Google
            </>}
          </button>
          <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">Your account is used only to securely restore your saved learning progress.</p>
        </section>
      </main>
    </div>
  );
}

function AppContent() {
  const { theme, isSidebarOpen, setCurrentView, user, isUserDataLoading, hasHydratedUserData } = useApp();
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
  }, [location.pathname, setCurrentView]);

  React.useEffect(() => {
    const metadata: Record<string, { title: string; description: string }> = {
      '/paper-structure': {
        title: 'A/L Technology Syllabus & Exam Score Predictor | Clora X',
        description: 'Track Sri Lankan G.C.E. A/L SFT, ET and ICT syllabus progress and plan exam preparation lesson by lesson.',
      },
      '/past-papers': {
        title: 'Sri Lanka A/L SFT, ET & ICT Past Papers | Clora X',
        description: 'Open and organize A/L Technology SFT, ET and ICT past papers, model papers and marking-scheme resources.',
      },
      '/admission-predictor': {
        title: 'A/L Technology Exam Score Predictor | Clora X',
        description: 'Review SFT, ET and ICT practice scores and planning estimates from your completed work.',
      },
      '/clora-x': {
        title: 'Clora X A/L Technology Learning Assistant',
        description: 'Ask syllabus-grounded questions about SFT, ET, ICT lessons, past papers and your saved learning resources.',
      },
    };
    const current = metadata[location.pathname] || {
      title: 'Clora X | Sri Lanka A/L Technology SFT, ET & ICT',
      description: 'Sinhala-first G.C.E. A/L Technology learning workspace for SFT, ET and ICT.',
    };
    const canonicalUrl = `${window.location.origin}${location.pathname}`;
    document.title = current.title;
    document.getElementById('app-description')?.setAttribute('content', current.description);
    document.getElementById('app-canonical')?.setAttribute('href', canonicalUrl);
    document.getElementById('app-og-title')?.setAttribute('content', current.title);
    document.getElementById('app-og-description')?.setAttribute('content', current.description);
    document.getElementById('app-og-url')?.setAttribute('content', canonicalUrl);
  }, [location.pathname]);

  return (
    <div className="relative min-h-screen bg-[var(--app-bg)] font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-950">
      <OnlineStatus />
      <ToastNotification />
      <AuthOverlay />
      <Sidebar />
      <div className={cn("flex flex-col transition-[padding] duration-200", isChatRoute ? "h-[100dvh] overflow-hidden bg-white" : "min-h-screen bg-[var(--app-bg)]", isSidebarOpen ? "lg:pl-64" : "pl-0 lg:pl-[72px]")}>
        <TopNav />
        <main
          className={cn(
            "relative w-full flex-1 flex flex-col min-h-0",
            isChatRoute
              ? "max-w-none p-0 overflow-hidden"
              : "mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8"
          )}
        >
          <div className="relative flex h-full min-h-0 w-full flex-1 flex-col">
              <Suspense fallback={<PageSkeleton pathname={location.pathname} />}>
                {user && isUserDataLoading && !hasHydratedUserData ? (
                  <PageSkeleton pathname={location.pathname} />
                ) : (
                <Routes location={location}>
                  <Route path="/" element={<Navigate to="/paper-structure" replace />} />
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
                )}
              </Suspense>
          </div>
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
