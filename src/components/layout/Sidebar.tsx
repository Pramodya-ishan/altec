import { BookOpen, Check, FileText, GraduationCap, Layers3, LineChart, Menu, MessageCircle, ShieldCheck, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { cn } from '../../lib/utils';
import type { ViewKey } from '../../types';

const CORE_ITEMS = [
  { id: 'paper-structure', label: 'Learning plan', icon: Layers3 },
  { id: 'paper-marks', label: 'Exam results', icon: LineChart },
  { id: 'past-papers', label: 'Past papers', icon: FileText },
  { id: 'admission-predictor', label: 'Score predictor', icon: GraduationCap },
  { id: 'clora-x', label: 'Study assistant', icon: MessageCircle },
] satisfies Array<{ id: ViewKey; label: string; icon: typeof Layers3 }>;

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSidebarOpen, setSidebarOpen, profile } = useApp();
  const isAdmin = profile?.role === 'admin' || profile?.roles?.includes('admin');
  const isEditor = isAdmin || ['content_editor', 'teacher'].includes(profile?.role || '') || profile?.roles?.some((role) => ['content_editor', 'teacher'].includes(role));
  const items = [
    ...CORE_ITEMS,
    ...(isEditor ? [{ id: 'syllabus' as ViewKey, label: 'Syllabus library', icon: BookOpen }] : []),
    ...(isAdmin ? [
      { id: 'pdf-sources' as ViewKey, label: 'PDF sources', icon: FileText },
      { id: 'admin-dashboard' as ViewKey, label: 'Administration', icon: ShieldCheck },
    ] : []),
  ];

  const openRoute = (id: ViewKey) => {
    navigate(`/${id}`);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        onClick={() => setSidebarOpen(false)}
        className={cn(
          'fixed inset-0 z-[80] bg-slate-950/20 transition-opacity lg:hidden',
          isSidebarOpen ? 'visible opacity-100' : 'invisible opacity-0',
        )}
      />
      <aside className={cn(
        'fixed inset-y-0 left-0 z-[90] flex w-72 flex-col border-r border-slate-200 bg-white transition-[width,transform] duration-200 lg:z-40',
        isSidebarOpen ? 'translate-x-0 lg:w-64' : '-translate-x-full lg:w-[72px] lg:translate-x-0',
      )}>
        <div className={cn('flex h-16 items-center border-b border-slate-100 px-3', isSidebarOpen ? 'justify-between' : 'justify-center')}>
          {isSidebarOpen && (
            <button type="button" onClick={() => openRoute('paper-structure')} className="min-w-0 text-left">
              <span className="block truncate text-sm font-semibold tracking-tight text-slate-950">A/L Workspace</span>
              <span className="block text-[11px] text-slate-400">Technology stream</span>
            </button>
          )}
          <button type="button" onClick={() => setSidebarOpen(!isSidebarOpen)} className="ui-icon-button" aria-label={isSidebarOpen ? 'Collapse navigation' : 'Expand navigation'}>
            {isSidebarOpen ? <X className="h-4 w-4 lg:hidden" /> : <Menu className="h-5 w-5" />}
            {isSidebarOpen && <Menu className="hidden h-5 w-5 lg:block" />}
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
          {items.map(({ id, label, icon: Icon }) => {
            const active = location.pathname === `/${id}` || (location.pathname === '/' && id === 'paper-structure');
            return (
              <button
                key={id}
                type="button"
                onClick={() => openRoute(id)}
                aria-current={active ? 'page' : undefined}
                title={!isSidebarOpen ? label : undefined}
                className={cn(
                  'group relative flex h-11 w-full items-center rounded-xl text-sm font-medium transition-colors',
                  isSidebarOpen ? 'gap-3 px-3' : 'justify-center px-0',
                  active ? 'bg-slate-950 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950',
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {isSidebarOpen && <span className="truncate">{label}</span>}
                {!isSidebarOpen && <span className="ui-sidebar-tooltip">{label}</span>}
              </button>
            );
          })}
        </nav>

        <div className={cn('border-t border-slate-100 p-3 text-xs text-slate-400', !isSidebarOpen && 'text-center')}>
          {isSidebarOpen ? 'Synced learning workspace' : <Check className="mx-auto h-4 w-4" />}
        </div>
      </aside>
    </>
  );
}
