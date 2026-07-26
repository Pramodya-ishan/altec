import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
  ChevronRight,
  Clock3,
  History,
  LogOut,
  MoreHorizontal,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useApp } from "../../context/AppContext";
import { calculateCurrentGradeFromData, cn } from "../../lib/utils";

const viewTitles: Record<string, { title: string; eyebrow: string }> = {
  "paper-structure": { title: "Paper structure", eyebrow: "Study plan" },
  notes: { title: "Error log", eyebrow: "Revision memory" },
  "paper-marks": { title: "Marks", eyebrow: "Performance" },
  "past-papers": { title: "Past papers", eyebrow: "Exam library" },
  "admission-predictor": { title: "Z-score", eyebrow: "Admission planner" },
  "clora-x": { title: "Study desk", eyebrow: "Ask · solve · revise" },
  profile: { title: "Profile", eyebrow: "Account" },
  syllabus: { title: "Syllabus", eyebrow: "Content workspace" },
  "admin-dashboard": { title: "Administration", eyebrow: "Operations" },
};

function SubjectControl({
  currentSubject,
  setCurrentSubject,
}: {
  currentSubject: string;
  setCurrentSubject: (subject: "sft" | "et" | "ict") => void;
}) {
  return (
    <div className="subject-control" aria-label="Current subject">
      {(["sft", "et", "ict"] as const).map((subject) => (
        <button
          key={subject}
          type="button"
          onClick={() => setCurrentSubject(subject)}
          className={cn("subject-control__item", currentSubject === subject && "is-active")}
          aria-pressed={currentSubject === subject}
        >
          {subject.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function formatNotificationTime(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (elapsedMinutes < 1) return "Now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m`;
  if (elapsedMinutes < 1440) return `${Math.floor(elapsedMinutes / 60)}h`;
  return new Date(timestamp).toLocaleDateString();
}

function getExamCountdown() {
  const target = new Date(import.meta.env.VITE_AL_EXAM_START_DATE || "2026-08-10T00:00:00+05:30").getTime();
  const distance = target - Date.now();
  if (distance <= 0) return { active: true, days: 0, hours: 0 };
  return {
    active: false,
    days: Math.floor(distance / 86_400_000),
    hours: Math.floor((distance % 86_400_000) / 3_600_000),
  };
}

export function TopNav() {
  const navigate = useNavigate();
  const {
    currentSubject,
    setCurrentSubject,
    data,
    currentView,
    pushNotifications,
    profile,
    markPushNotificationAsRead,
    markAllPushNotificationsAsRead,
    user,
    logout,
  } = useApp();
  const [countdown, setCountdown] = useState(getExamCountdown);
  const [openPanel, setOpenPanel] = useState<"notifications" | "profile" | "chat" | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setCountdown(getExamCountdown()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => setOpenPanel(null), [currentView]);

  const unreadCount = useMemo(
    () => pushNotifications.filter((notification) => !notification.read).length,
    [pushNotifications],
  );
  const { grade } = calculateCurrentGradeFromData(data, currentSubject);
  const page = viewTitles[currentView] || { title: "Tec A/L", eyebrow: "Learning workspace" };
  const isChat = currentView === "clora-x";
  const showSubjects = !["admission-predictor", "focus-todo", "clora-x", "profile"].includes(currentView);
  const avatar = profile?.picture || user?.picture;
  const displayName = profile?.username || user?.name || "Student";
  const initials = displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <header className="topbar">
      <div className="topbar__row">
        <div className="min-w-0">
          <p className="topbar__eyebrow">{page.eyebrow}</p>
          <h1 className="topbar__title">{page.title}</h1>
        </div>

        <div className="topbar__actions">
          {!isChat && (
            <div className="exam-chip" title="Time until the configured A/L exam date">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              <span>{countdown.active ? "Exam period" : `${countdown.days}d ${countdown.hours}h`}</span>
              <span className="hidden xl:inline">to A/L</span>
            </div>
          )}

          {showSubjects && (
            <div className="hidden items-center gap-2 sm:flex">
              <SubjectControl currentSubject={currentSubject} setCurrentSubject={setCurrentSubject} />
              <span className="grade-chip">Grade {grade}</span>
            </div>
          )}

          {isChat ? (
            <div className="relative flex items-center gap-2" aria-label="Chat actions">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("clora:new-chat"))}
                className="icon-button icon-button--primary"
                aria-label="New chat"
                title="New chat"
              >
                <Plus className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setOpenPanel(openPanel === "chat" ? null : "chat")}
                className="icon-button"
                aria-label="More chat actions"
                aria-expanded={openPanel === "chat"}
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
              {openPanel === "chat" && (
                <>
                  <button className="popover-scrim" type="button" onClick={() => setOpenPanel(null)} aria-label="Close chat actions" />
                  <div className="menu-popover">
                    <button type="button" onClick={() => { window.dispatchEvent(new CustomEvent("clora:history")); setOpenPanel(null); }}>
                      <History className="h-4 w-4" /> Conversation history
                    </button>
                    <button className="is-danger" type="button" onClick={() => { window.dispatchEvent(new CustomEvent("clora:clear-chat")); setOpenPanel(null); }}>
                      <Trash2 className="h-4 w-4" /> Clear conversation
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenPanel(openPanel === "notifications" ? null : "notifications")}
                  className="icon-button"
                  aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
                  aria-expanded={openPanel === "notifications"}
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? "99+" : unreadCount}</span>}
                </button>
                {openPanel === "notifications" && (
                  <>
                    <button className="popover-scrim" type="button" onClick={() => setOpenPanel(null)} aria-label="Close notifications" />
                    <section className="panel-popover" aria-label="Notification inbox">
                      <div className="panel-popover__header">
                        <div>
                          <h2>Notifications</h2>
                          <p>{unreadCount ? `${unreadCount} unread` : "You are up to date"}</p>
                        </div>
                        {unreadCount > 0 && (
                          <button type="button" onClick={() => void markAllPushNotificationsAsRead()} className="text-button">
                            <Check className="h-4 w-4" /> Read all
                          </button>
                        )}
                      </div>
                      <div className="panel-popover__body">
                        {pushNotifications.length === 0 ? (
                          <div className="empty-compact"><Bell className="h-6 w-6" /><p>No notifications yet</p></div>
                        ) : pushNotifications.map((notification) => (
                          <button
                            type="button"
                            key={notification.id}
                            onClick={() => { if (!notification.read) void markPushNotificationAsRead(notification.id); }}
                            className={cn("notification-row", !notification.read && "is-unread")}
                          >
                            <span className="notification-row__dot" />
                            <span className="min-w-0 flex-1">
                              <span className="notification-row__title">{notification.title}</span>
                              <span className="notification-row__message">{notification.message}</span>
                            </span>
                            <time>{formatNotificationTime(notification.timestamp)}</time>
                          </button>
                        ))}
                      </div>
                    </section>
                  </>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenPanel(openPanel === "profile" ? null : "profile")}
                  className="avatar-button"
                  aria-label="Account menu"
                  aria-expanded={openPanel === "profile"}
                >
                  <span>{initials || "ST"}</span>
                  {avatar && !avatarFailed && <img src={avatar} alt="" referrerPolicy="no-referrer" onError={() => setAvatarFailed(true)} />}
                </button>
                {openPanel === "profile" && (
                  <>
                    <button className="popover-scrim" type="button" onClick={() => setOpenPanel(null)} aria-label="Close account menu" />
                    <div className="profile-popover">
                      <button type="button" className="profile-popover__identity" onClick={() => { navigate("/profile"); setOpenPanel(null); }}>
                        <span className="avatar-fallback">{initials || "ST"}</span>
                        <span className="min-w-0 flex-1">
                          <strong>{displayName}</strong>
                          <small>{user?.email || "Student account"}</small>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => { navigate("/profile"); setOpenPanel(null); }}>
                        <User className="h-4 w-4" /> Profile
                      </button>
                      <button type="button" className="is-danger" onClick={() => { void logout(); setOpenPanel(null); }}>
                        <LogOut className="h-4 w-4" /> Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showSubjects && (
        <div className="topbar__mobile-subject">
          <SubjectControl currentSubject={currentSubject} setCurrentSubject={setCurrentSubject} />
          <span className="grade-chip">Grade {grade}</span>
        </div>
      )}
    </header>
  );
}
