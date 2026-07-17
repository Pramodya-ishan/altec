import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Bot,
  FileText,
  GraduationCap,
  Layers,
  LineChart,
  Menu,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { cn } from "../../lib/utils";
import type { ViewKey } from "../../types";

type MenuItem = {
  id: ViewKey;
  label: string;
  mobileLabel: string;
  icon: LucideIcon;
};

const primaryItems: MenuItem[] = [
  { id: "paper-structure", label: "Paper structure", mobileLabel: "Paper", icon: Layers },
  { id: "paper-marks", label: "Marks", mobileLabel: "Marks", icon: LineChart },
  { id: "past-papers", label: "Past papers", mobileLabel: "Papers", icon: FileText },
  { id: "admission-predictor", label: "Z-score", mobileLabel: "Z-score", icon: GraduationCap },
  { id: "clora-x", label: "Assistant", mobileLabel: "Assistant", icon: Bot },
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSidebarOpen, setSidebarOpen, profile } = useApp();

  const roles = new Set([profile?.role, ...(profile?.roles || [])].filter(Boolean));
  const isAdminUser = roles.has("admin");
  const isSyllabusEditor = ["admin", "content_editor", "teacher", "ops"].some((role) => roles.has(role));
  const menuItems = [...primaryItems];

  if (isSyllabusEditor) {
    menuItems.push({ id: "syllabus", label: "Syllabus", mobileLabel: "Syllabus", icon: BookOpen } as MenuItem);
  }
  if (isAdminUser) {
    menuItems.push({ id: "pdf-sources", label: "PDF Intelligence", mobileLabel: "PDF", icon: FileText } as MenuItem);
    menuItems.push({ id: "admin-dashboard", label: "Admin Dashboard", mobileLabel: "Admin", icon: ShieldAlert } as MenuItem);
  }

  const isActiveItem = (id: ViewKey) => (
    location.pathname.includes(id) || (location.pathname === "/" && id === "paper-structure")
  );

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[98] bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden lg:pointer-events-none",
          isSidebarOpen ? "visible opacity-100" : "invisible opacity-0",
        )}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={cn(
          "fixed left-0 top-0 z-[99] flex h-[100dvh] w-72 flex-col bg-white pt-4 shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] lg:z-40 lg:border-r lg:border-slate-200 lg:shadow-none",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:w-[72px] lg:translate-x-0",
        )}
      >
        <div className={cn("mb-6 flex items-center px-3", isSidebarOpen ? "justify-between px-6" : "justify-center")}>
          {isSidebarOpen && <span className="text-lg font-extrabold tracking-tight text-slate-900">Tec A/L</span>}
          <button
            type="button"
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label={isSidebarOpen ? "Collapse navigation" : "Expand navigation"}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        <nav className="scrollbar-none flex flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-2">
          {menuItems.map((item) => {
            const isActive = isActiveItem(item.id);
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  navigate(`/${item.id}`);
                  if (window.innerWidth < 1024) setSidebarOpen(false);
                }}
                className={cn(
                  "group relative flex w-full items-center rounded-xl font-semibold outline-none transition-all duration-200",
                  isSidebarOpen ? "justify-start gap-3.5 px-4 py-3.5 text-left" : "mx-auto w-12 justify-center px-0 py-3.5 text-center",
                  isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                )}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
              >
                <Icon className={cn("h-5 w-5 shrink-0 transition-transform duration-200", isActive ? "scale-110 text-indigo-600" : "group-hover:scale-110")} />
                {isSidebarOpen && <span className="truncate text-[14px] font-bold tracking-tight">{item.label}</span>}
                {!isSidebarOpen && (
                  <span className="pointer-events-none absolute left-full top-1/2 z-[99] ml-4 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-white opacity-0 shadow-xl transition-all group-hover:visible group-hover:opacity-100 lg:block">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(60px+env(safe-area-inset-bottom))] grid-cols-5 border-t border-slate-200 bg-white/95 px-1 pb-[max(.4rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-3px_12px_rgba(15,23,42,0.05)] backdrop-blur lg:hidden"
        aria-label="Mobile navigation"
      >
        {primaryItems.map((item) => {
          const isActive = isActiveItem(item.id);
          const Icon = item.icon;
          return (
            <button
              key={`mobile-${item.id}`}
              type="button"
              onClick={() => navigate(`/${item.id}`)}
              className={cn(
                "mx-0.5 flex min-h-10 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-[10px] font-semibold leading-none transition",
                isActive ? "bg-blue-50 text-blue-700" : "text-slate-500 active:bg-slate-100",
              )}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
            >
              <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-blue-600")} />
              <span className="block w-full whitespace-nowrap text-center">{item.mobileLabel}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
