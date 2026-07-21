import React from "react";
import { motion } from "motion/react";
import { useLocation, useNavigate } from "react-router-dom";
import { BookOpen, Bot, FileText, GraduationCap, Layers, LineChart, Menu, NotebookPen, ShieldAlert, type LucideIcon } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { cn } from "../../lib/utils";
import type { ViewKey } from "../../types";

type MenuItem = { id: ViewKey; label: string; mobileLabel: string; icon: LucideIcon };
const primaryItems: MenuItem[] = [
  { id: "paper-structure", label: "Paper structure", mobileLabel: "Paper", icon: Layers },
  { id: "notes", label: "Notes", mobileLabel: "Notes", icon: NotebookPen },
  { id: "paper-marks", label: "Marks", mobileLabel: "Marks", icon: LineChart },
  { id: "past-papers", label: "Past papers", mobileLabel: "Papers", icon: FileText },
  { id: "admission-predictor", label: "Z-score", mobileLabel: "Z-score", icon: GraduationCap },
  { id: "clora-x", label: "Assistant", mobileLabel: "Assistant", icon: Bot },
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSidebarOpen, setSidebarOpen, profile } = useApp();
  const [composerFocused, setComposerFocused] = React.useState(false);

  React.useEffect(() => {
    const listener = (event: Event) => setComposerFocused(Boolean((event as CustomEvent)?.detail?.focused));
    window.addEventListener('clora:composer-focus', listener as EventListener);
    return () => window.removeEventListener('clora:composer-focus', listener as EventListener);
  }, []);

  const roles = new Set([profile?.role, ...(profile?.roles || [])].filter(Boolean));
  const isAdminUser = roles.has("admin");
  const isSyllabusEditor = ["admin", "content_editor", "teacher", "ops"].some((role) => roles.has(role));
  const menuItems = [...primaryItems];
  if (isSyllabusEditor) menuItems.push({ id: "syllabus", label: "Syllabus", mobileLabel: "Syllabus", icon: BookOpen } as MenuItem);
  if (isAdminUser) {
    menuItems.push({ id: "pdf-sources", label: "PDF Intelligence", mobileLabel: "PDF", icon: FileText } as MenuItem);
    menuItems.push({ id: "admin-dashboard", label: "Admin Dashboard", mobileLabel: "Admin", icon: ShieldAlert } as MenuItem);
  }

  const isActiveItem = (id: ViewKey) => location.pathname.includes(id) || (location.pathname === "/" && id === "paper-structure");
  const hideMobileNav = composerFocused && (location.pathname === '/clora-x' || location.pathname === '/ai-chat');

  return (
    <>
      <aside className={cn(
        "fixed left-0 top-0 z-40 hidden h-[100dvh] flex-col border-r border-slate-200 bg-white pt-4 shadow-none transition-all duration-300 lg:flex",
        isSidebarOpen ? "w-72" : "w-[72px]",
      )}>
        <div className={cn("mb-6 flex items-center px-3", isSidebarOpen ? "justify-between px-6" : "justify-center")}>
          {isSidebarOpen && <span className="text-lg font-extrabold tracking-tight text-slate-900">Tec A/L</span>}
          <button type="button" onClick={() => setSidebarOpen(!isSidebarOpen)} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900" aria-label={isSidebarOpen ? "Collapse navigation" : "Expand navigation"}>
            <Menu className="h-5 w-5" />
          </button>
        </div>
        <nav className="scrollbar-none flex flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-2">
          {menuItems.map((item) => {
            const active = isActiveItem(item.id);
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" onClick={() => navigate(`/${item.id}`)} className={cn(
                "group relative flex w-full items-center rounded-xl font-semibold outline-none transition-all duration-200",
                isSidebarOpen ? "justify-start gap-3.5 px-4 py-3.5 text-left" : "mx-auto w-12 justify-center px-0 py-3.5 text-center",
                active ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
              )} aria-current={active ? "page" : undefined} aria-label={item.label}>
                <Icon className={cn("h-5 w-5 shrink-0 transition-transform duration-200", active ? "scale-110 text-indigo-600" : "group-hover:scale-110")} />
                {isSidebarOpen && <span className="truncate text-[14px] font-bold tracking-tight">{item.label}</span>}
                {!isSidebarOpen && <span className="pointer-events-none absolute left-full top-1/2 z-[99] ml-4 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white opacity-0 shadow-xl transition-all group-hover:block group-hover:opacity-100">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      <motion.nav
        initial={false}
        animate={{ y: hideMobileNav ? '110%' : 0, opacity: hideMobileNav ? 0 : 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={cn("fixed inset-x-0 bottom-0 z-40 grid h-[calc(60px+env(safe-area-inset-bottom))] grid-cols-6 border-t border-slate-200 bg-white/95 px-1 pb-[max(.4rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur lg:hidden", hideMobileNav && "pointer-events-none")}
        aria-label="Mobile navigation"
      >
        {primaryItems.map((item) => {
          const active = isActiveItem(item.id);
          const Icon = item.icon;
          return (
            <button key={`mobile-${item.id}`} type="button" onClick={() => navigate(`/${item.id}`)} className={cn("relative mx-0.5 flex min-h-10 min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-xl px-0.5 text-[10px] font-semibold leading-none text-slate-500 transition active:bg-slate-100", active && "text-blue-700")} aria-current={active ? "page" : undefined} aria-label={item.label}>
              {active && <motion.span layoutId="mobile-bottom-nav-active" className="absolute inset-0 rounded-xl bg-blue-50" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <Icon className={cn("relative z-10 h-5 w-5 shrink-0", active && "text-blue-600")} />
              <span className="relative z-10 block w-full whitespace-nowrap text-center">{item.mobileLabel}</span>
            </button>
          );
        })}
      </motion.nav>
    </>
  );
}
