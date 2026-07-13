import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { cn } from '../../lib/utils';
import { ViewKey } from '../../types';
import { 
  Layers, 
  LineChart, 
  FileText, 
  GraduationCap, 
  Bot, 
  BookOpen, 
  ShieldAlert,
  Menu,
  ChevronUp
} from 'lucide-react';

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSidebarOpen, setSidebarOpen, theme, setTheme, user, profile } = useApp();
  
  const menuItems: { id: ViewKey; label: string; icon: any }[] = [
    { id: 'paper-structure', label: 'Paper Structure', icon: Layers },
    { id: 'paper-marks', label: 'Past Paper Marks', icon: LineChart },
    { id: 'past-papers', label: 'Past Papers DB', icon: FileText },
    { id: 'admission-predictor', label: 'Z Core & Analytics', icon: GraduationCap },
    { id: 'clora-x', label: 'Clora X Assistant', icon: Bot }
  ];

  const isAdminUser = profile?.role === 'admin' || profile?.roles?.includes('admin');
  const isSyllabusEditor = isAdminUser || profile?.role === 'content_editor' || profile?.roles?.includes('content_editor') || profile?.role === 'teacher' || profile?.roles?.includes('teacher');

  if (isSyllabusEditor) {
    menuItems.push({ id: 'syllabus', label: 'Syllabus Library', icon: BookOpen } as any);
  }
  if (isAdminUser) {
    menuItems.push({ id: 'pdf-sources', label: 'PDF Intelligence', icon: FileText } as any);
    menuItems.push({ id: 'admin-dashboard', label: 'Admin Dashboard', icon: ShieldAlert } as any);
  }

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-slate-900/40 z-[98] backdrop-blur-sm transition-opacity duration-300 lg:hidden lg:pointer-events-none",
          isSidebarOpen ? "opacity-100 visible" : "opacity-0 invisible"
        )}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={cn(
          "fixed left-0 top-0 h-[100dvh] bg-white shadow-2xl lg:shadow-none lg:border-r lg:border-slate-200 z-[99] lg:z-40 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] pt-4",
          isSidebarOpen ? "w-72 translate-x-0" : "w-72 lg:w-[72px] -translate-x-full lg:translate-x-0"
        )}
      >
        <div className={cn("px-3 mb-6 flex items-center", isSidebarOpen ? "justify-between px-6" : "justify-center")}>
          {isSidebarOpen && <span className="font-extrabold text-lg tracking-tight text-slate-900">Menu</span>}
          <button
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Toggle Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-2 px-3 flex flex-col gap-1.5 scrollbar-none">
          {menuItems.map((item) => {
            const isActive = location.pathname.includes(item.id) || (location.pathname === '/' && item.id === 'paper-structure');
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  navigate(`/${item.id}`);
                  if (window.innerWidth < 1024) {
                    setSidebarOpen(false);
                  }
                }}
                className={cn(
                  "w-full flex items-center rounded-xl font-semibold transition-all duration-200 cursor-pointer relative group outline-none",
                  isSidebarOpen 
                    ? "gap-3.5 px-4 py-3.5 text-left justify-start" 
                    : "px-0 py-3.5 justify-center text-center mx-auto w-12",
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Icon className={cn("shrink-0 transition-transform duration-200", isActive ? "scale-110 text-indigo-600" : "group-hover:scale-110", isSidebarOpen ? "w-5 h-5" : "w-5 h-5")} />
                
                {isSidebarOpen ? (
                  <span className="truncate font-bold tracking-tight text-[14px]">{item.label}</span>
                ) : (
                  <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 px-3 py-2 bg-slate-900 text-white border border-slate-800 text-xs font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap shadow-xl z-[99]">
                    {item.label}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        </aside>
    </>
  );
}
