import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  CircleAlert,
  FileText,
  GraduationCap,
  Layers3,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  ShieldCheck,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { useApp } from "../../context/AppContext";
import { cn } from "../../lib/utils";
import type { ViewKey } from "../../types";

type MenuItem = { id: ViewKey; label: string; mobileLabel: string; icon: LucideIcon };

const primaryItems: MenuItem[] = [
  { id: "paper-structure", label: "Paper structure", mobileLabel: "Plan", icon: Layers3 },
  { id: "notes", label: "Error log", mobileLabel: "Errors", icon: CircleAlert },
  { id: "paper-marks", label: "Marks", mobileLabel: "Marks", icon: BarChart3 },
  { id: "past-papers", label: "Past papers", mobileLabel: "Papers", icon: FileText },
  { id: "admission-predictor", label: "Z-score planner", mobileLabel: "Z-score", icon: GraduationCap },
  { id: "clora-x", label: "Study desk", mobileLabel: "Study", icon: MessageSquareText },
];

const mobilePrimary = [
  primaryItems[0],
  primaryItems[1],
  primaryItems[5],
  primaryItems[2],
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSidebarOpen, setSidebarOpen, profile } = useApp();
  const [composerFocused, setComposerFocused] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  useEffect(() => {
    const listener = (event: Event) => setComposerFocused(Boolean((event as CustomEvent)?.detail?.focused));
    window.addEventListener("clora:composer-focus", listener as EventListener);
    return () => window.removeEventListener("clora:composer-focus", listener as EventListener);
  }, []);

  useEffect(() => setMobileMoreOpen(false), [location.pathname]);

  const menuItems = useMemo(() => {
    const roles = new Set([profile?.role, ...(profile?.roles || [])].filter(Boolean));
    const items = [...primaryItems];
    if (["admin", "content_editor", "teacher", "ops"].some((role) => roles.has(role))) {
      items.push({ id: "syllabus", label: "Syllabus library", mobileLabel: "Syllabus", icon: BookOpen });
    }
    if (roles.has("admin")) {
      items.push({ id: "pdf-sources", label: "PDF intelligence", mobileLabel: "PDF", icon: FileText });
      items.push({ id: "admin-dashboard", label: "Administration", mobileLabel: "Admin", icon: ShieldCheck });
    }
    return items;
  }, [profile]);

  const isActive = (id: ViewKey) => location.pathname === `/${id}` || (location.pathname === "/" && id === "paper-structure");
  const navigateTo = (id: ViewKey) => {
    navigate(`/${id}`);
    setMobileMoreOpen(false);
  };
  const hideMobileNav = composerFocused && ["/clora-x", "/ai-chat"].includes(location.pathname);
  const moreItems = menuItems.filter((item) => !mobilePrimary.some((mobileItem) => mobileItem.id === item.id));

  return (
    <>
      <aside className={cn("desktop-sidebar", isSidebarOpen ? "is-expanded" : "is-collapsed")}>
        <div className="desktop-sidebar__brand">
          <button type="button" className="brand-mark" onClick={() => navigateTo("paper-structure")} aria-label="Tec A/L home">T</button>
          {isSidebarOpen && (
            <div className="min-w-0">
              <strong>Tec A/L</strong>
              <span>Learning workspace</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="sidebar-toggle"
            aria-label={isSidebarOpen ? "Collapse navigation" : "Expand navigation"}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        <nav className="desktop-sidebar__nav" aria-label="Main navigation">
          {isSidebarOpen && <p className="sidebar-section-label">Workspace</p>}
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTo(item.id)}
                className={cn("sidebar-link", active && "is-active", !isSidebarOpen && "is-icon-only")}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                title={!isSidebarOpen ? item.label : undefined}
              >
                <Icon className="h-5 w-5" />
                {isSidebarOpen && <span>{item.label}</span>}
                {isSidebarOpen && active && <ChevronRight className="ml-auto h-4 w-4" />}
              </button>
            );
          })}
        </nav>

        {isSidebarOpen && (
          <div className="desktop-sidebar__footer">
            <span className="status-dot" />
            <span>Workspace ready</span>
          </div>
        )}
      </aside>

      <nav
        className={cn("mobile-nav", hideMobileNav && "is-hidden")}
        aria-label="Mobile navigation"
      >
        {mobilePrimary.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.id);
          const isStudy = item.id === "clora-x";
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigateTo(item.id)}
              className={cn("mobile-nav__item", active && "is-active", isStudy && "is-study")}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
            >
              <Icon className="h-5 w-5" />
              <span>{item.mobileLabel}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMoreOpen(true)}
          className={cn("mobile-nav__item", moreItems.some((item) => isActive(item.id)) && "is-active")}
          aria-label="More navigation"
          aria-expanded={mobileMoreOpen}
        >
          <MoreHorizontal className="h-5 w-5" />
          <span>More</span>
        </button>
      </nav>

      {mobileMoreOpen && (
        <div className="mobile-sheet" role="dialog" aria-modal="true" aria-label="More navigation">
          <button type="button" className="mobile-sheet__scrim" onClick={() => setMobileMoreOpen(false)} aria-label="Close navigation" />
          <section className="mobile-sheet__panel">
            <div className="mobile-sheet__header">
              <div><p>Navigate</p><h2>More workspace</h2></div>
              <button type="button" className="icon-button" onClick={() => setMobileMoreOpen(false)} aria-label="Close navigation"><X className="h-5 w-5" /></button>
            </div>
            <div className="mobile-sheet__grid">
              {moreItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.id} type="button" onClick={() => navigateTo(item.id)} className={cn(isActive(item.id) && "is-active")}>
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                    <ChevronRight className="ml-auto h-4 w-4" />
                  </button>
                );
              })}
              <button type="button" onClick={() => navigateTo("profile")} className={cn(isActive("profile") && "is-active")}>
                <User className="h-5 w-5" /><span>Profile</span><ChevronRight className="ml-auto h-4 w-4" />
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
