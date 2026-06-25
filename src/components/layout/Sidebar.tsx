import React, { useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { cn } from '../../lib/utils';
import { ViewKey, SubjectKey } from '../../types';
import { useGoogleLogin } from '@react-oauth/google';
import JSZip from 'jszip';

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSidebarOpen, setSidebarOpen, data, saveData, clearLocalStorage, showNotification, theme, setTheme, user, isAuthLoading, logout, profile, fetchUserInfo } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const loginWithGoogle = useGoogleLogin({
    scope: "openid email profile",
    onSuccess: async (tokenResponse) => {
      localStorage.setItem('google_access_token', tokenResponse.access_token);
      showNotification('Successfully logged in with Google!', 'success');
      await fetchUserInfo(tokenResponse.access_token);
    },
    onError: (error) => {
      console.error('Login Failed', error);
      showNotification('Google login failed.', 'error');
    }
  });

  const menuItems: { id: ViewKey; label: string; icon: string }[] = [
    { id: 'paper-structure', label: 'Paper Structure', icon: 'fa-solid fa-layer-group' },
    { id: 'paper-marks', label: 'Past Paper Marks', icon: 'fa-solid fa-chart-line' },
    { id: 'admission-predictor', label: 'Z Core & Analytics', icon: 'fa-solid fa-graduation-cap' }
  ];

  if (profile?.email === 'ishanstc123@gmail.com' || user?.email === 'ishanstc123@gmail.com') {
    menuItems.push({ id: 'admin-dashboard', label: 'Admin Dashboard', icon: 'fa-solid fa-shield-halved' });
  }

  const handleExport = async () => {
    try {
      const dataStr = JSON.stringify(data, null, 2);
      const zip = new JSZip();
      zip.file(`Tech_Blueprint_${new Date().toISOString().slice(0, 10)}.json`, dataStr);
      
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Tech_Blueprint_Firebase_FullData_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotification('Backup exported to ZIP successfully.', 'success');
    } catch (error) {
      console.error('Export Error:', error);
      showNotification('Failed to export data.', 'error');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (evt) {
      try {
        const imported = JSON.parse(evt.target?.result as string);
        if (imported.sft || imported.topics) {
          let newData = structuredClone(data);
          if (imported.topics && !imported.sft) {
            newData.sft.topics = imported.topics;
          } else {
            newData = imported;
          }
          (['sft', 'et', 'ict'] as SubjectKey[]).forEach(subj => {
            if (!newData[subj]) newData[subj] = { topics: {}, paperMarks: [], questionMarks: {} };
            if (!newData[subj].paperMarks) newData[subj].paperMarks = [];
            if (!newData[subj].questionMarks) newData[subj].questionMarks = {};
          });
          saveData(newData);
          showNotification('Data imported successfully!', 'success');
        } else {
          showNotification('Invalid backup format.', 'error');
        }
      } catch (err) {
        showNotification('Error reading file.', 'error');
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const handleClear = () => {
    if (confirmClear) {
      clearLocalStorage();
      showNotification('App Data has been successfully cleared.', 'success');
      setConfirmClear(false);
      setSidebarOpen(false);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 4000);
    }
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 bg-slate-900/40 z-[98] backdrop-blur-sm transition-opacity duration-300 lg:hidden lg:pointer-events-none",
          isSidebarOpen ? "opacity-100 visible" : "opacity-0 invisible"
        )}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={cn(
          "fixed left-0 top-0 h-screen bg-white shadow-2xl lg:shadow-none lg:border-r lg:border-slate-200/80 z-[99] lg:z-40 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] pt-4",
          isSidebarOpen ? "w-72 translate-x-0" : "w-72 lg:w-16 -translate-x-full lg:translate-x-0"
        )}
      >
        <div className={cn("px-3 mb-2 flex items-center", isSidebarOpen ? "justify-between px-6" : "justify-center")}>
          {isSidebarOpen && <span className="font-extrabold text-lg tracking-tight text-slate-800">Menu</span>}
          <button
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer group relative"
            aria-label="Toggle Menu"
          >
            <i className="fa-solid fa-bars text-xl"></i>
            {!isSidebarOpen && (
              <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-800 text-white border border-slate-700 text-xs font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap shadow-xl z-[100] pointer-events-none delay-75">
                Toggle Menu
              </div>
            )}
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1 relative z-0">
          {menuItems.map((item) => {
            const isActive = location.pathname.includes(item.id) || (location.pathname === '/' && item.id === 'paper-structure');
            return (
              <li key={item.id}>
                <button
                  onClick={() => {
                    navigate(`/${item.id}`);
                    if (window.innerWidth < 1024) {
                      setSidebarOpen(false);
                    }
                  }}
                  className={cn(
                    "w-full flex items-center rounded-xl font-semibold transition-all duration-300 cursor-pointer relative group",
                    isSidebarOpen 
                      ? "gap-3.5 px-4 py-3 text-left justify-start" 
                      : "px-0 py-3.5 justify-center text-center mx-auto w-12",
                    isActive
                      ? "bg-red-50 text-red-800 shadow-md ring-1 ring-red-100"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <i className={cn(item.icon, "text-center shrink-0 transition-transform duration-300 drop-shadow-sm", isActive ? "scale-110 drop-shadow-md" : "group-hover:scale-110", isSidebarOpen ? "w-5" : "text-xl")}></i>
                  {isSidebarOpen ? (
                    <span className="truncate animate-in fade-in duration-200 font-bold">{item.label}</span>
                  ) : (
                    <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-red-50 text-red-800 border border-red-100 text-xs font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap shadow-md z-[99]">
                      {item.label}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="p-4 border-t border-slate-100 bg-slate-50">
          {isSidebarOpen ? (
            <>
              <button 
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className="w-full flex items-center justify-between px-2 py-2 text-slate-500 font-bold text-sm tracking-wide uppercase hover:text-slate-800 transition-colors"
              >
                <span><i className="fa-solid fa-gear mr-2"></i> Settings</span>
                <i className={`fa-solid fa-chevron-up transition-transform duration-300 ${isSettingsOpen ? 'rotate-180' : ''}`}></i>
              </button>
              
              <div className={cn("overflow-hidden transition-all duration-300 ease-in-out", isSettingsOpen ? "max-h-[500px] mt-4 opacity-100" : "max-h-0 opacity-0")}>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">Theme</h4>
                <div className="flex gap-2 px-2 mb-6">
                  {(['blue', 'emerald', 'slate'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg border text-xs font-bold capitalize transition-all active:scale-95",
                        theme === t ? "border-primary-600 bg-primary-50 text-primary-700 shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">Data Management</h4>
                <div className="flex flex-col gap-2 px-2 text-sm text-slate-500 font-medium">
                  <p>Cloud synchronization is currently active.</p>
                </div>
              </div>
            </>
          ) : (
            <button 
              onClick={() => {
                setSidebarOpen(true);
                setIsSettingsOpen(true);
              }}
              className="w-full flex items-center justify-center py-2 text-slate-500 hover:text-slate-800 transition-colors text-lg cursor-pointer relative group"
            >
              <i className="fa-solid fa-gear"></i>
              <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-800 text-white border border-slate-700 text-xs font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap shadow-xl z-[100] pointer-events-none delay-75">
                Open Settings
              </div>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
