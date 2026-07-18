import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { apiFetch } from "../lib/api";
import { normalizeSinhalaDisplayText } from "../lib/assistantTextHygiene";
import { shouldUseRedirectAuth } from "../lib/authStrategy";
import { auth, authPersistenceReady, isFirebaseEnabled } from "../lib/firebase";
import { calculateCurrentGradeFromData } from "../lib/utils";
import type { AppData, SubjectKey, ThemeKey, ViewKey } from "../types";

type ModalsState = {
  playlist: { open: boolean; topic: string };
  addPaperMark: { open: boolean; editIndex: number };
  silencePlayer: { open: boolean; videoUrl: string; title: string };
};

export type NotificationItem = {
  id: string;
  message: string;
  type: "success" | "error" | "info";
};

export type PushNotification = {
  id: string;
  title: string;
  message: string;
  type: "message" | "friend_request" | "announcement";
  senderEmail?: string;
  senderName?: string;
  read: boolean;
  timestamp: string;
};

export type UserProfile = {
  email: string;
  username: string;
  picture: string;
  bio: string;
  updatedAt: string;
  nic?: string;
  mobileNumber?: string;
  bday?: string;
  gender?: string;
  isVerified?: boolean;
  role?: string;
  roles?: string[];
};

export type AppUser = {
  uid: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified?: boolean;
};

type AppContextType = {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  user: AppUser | null;
  currentSubject: SubjectKey;
  setCurrentSubject: (subject: SubjectKey) => void;
  currentView: ViewKey;
  setCurrentView: (view: ViewKey) => void;
  theme: ThemeKey;
  setTheme: (theme: ThemeKey) => void;
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  isAdvisorOpen: boolean;
  setAdvisorOpen: (open: boolean) => void;
  modals: ModalsState;
  setModals: React.Dispatch<React.SetStateAction<ModalsState>>;
  notifications: NotificationItem[];
  showNotification: (message: string, type?: NotificationItem["type"]) => void;
  removeNotification: (id: string) => void;
  toggleTopic: (topic: string) => void;
  updateTopicNotes: (topic: string, notes: string) => void;
  saveData: (newData: AppData) => void;
  clearLocalStorage: () => void;
  triggerStars: () => void;
  loginWithGoogle: () => Promise<void>;
  isAuthLoading: boolean;
  isUserDataLoading: boolean;
  hasHydratedUserData: boolean;
  logout: () => Promise<void>;
  profile: UserProfile | null;
  saveProfile: (profile: UserProfile) => Promise<void>;
  pushNotifications: PushNotification[];
  markPushNotificationAsRead: (id: string) => Promise<void>;
  adminTargetEmail: string | null;
  setAdminTargetEmail: (email: string | null) => Promise<void>;
};

const defaultData: AppData = {
  sft: { topics: {}, paperMarks: [], questionMarks: {} },
  et: { topics: {}, paperMarks: [], questionMarks: {} },
  ict: { topics: {}, paperMarks: [], questionMarks: {} },
};

function sanitizeAppData(value: AppData | null | undefined): AppData {
  const source = value && typeof value === "object" ? value : defaultData;
  return {
    ...defaultData,
    ...source,
    sft: { ...defaultData.sft, ...(source.sft || {}) },
    et: { ...defaultData.et, ...(source.et || {}) },
    ict: { ...defaultData.ict, ...(source.ict || {}) },
    zScoreHistory: Array.isArray(source.zScoreHistory)
      ? source.zScoreHistory
          .filter((entry) => Boolean(entry?.date) && Number.isFinite(Number(entry?.zScore)))
          .map((entry) => ({
            ...entry,
            calculationBasis: entry.calculationBasis || "legacy_exam_score_predictor",
            official: false as const,
          }))
      : [],
  };
}

const AppContext = createContext<AppContextType | undefined>(undefined);
let redirectResultPromise: ReturnType<typeof getRedirectResult> | null = null;

function getRedirectResultOnce() {
  if (!auth) return Promise.resolve(null);
  redirectResultPromise ??= getRedirectResult(auth);
  return redirectResultPromise;
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setRawData] = useState<AppData>(defaultData);
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentSubject, setCurrentSubject] = useState<SubjectKey>("sft");
  const [currentView, setCurrentView] = useState<ViewKey>("paper-structure");
  const [theme, setTheme] = useState<ThemeKey>("slate");
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isAdvisorOpen, setAdvisorOpen] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isUserDataLoading, setIsUserDataLoading] = useState(false);
  const [hasHydratedUserData, setHasHydratedUserData] = useState(false);
  const [pushNotifications, setPushNotifications] = useState<PushNotification[]>([]);
  const [adminTargetEmail, setAdminTargetEmailState] = useState<string | null>(null);
  const [adminTargetUid, setAdminTargetUid] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [modals, setModals] = useState<ModalsState>({
    playlist: { open: false, topic: "" },
    addPaperMark: { open: false, editIndex: -1 },
    silencePlayer: { open: false, videoUrl: "", title: "" },
  });

  const loginInFlightRef = useRef(false);
  const sessionUidRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<AppData | null>(null);
  const notificationTimersRef = useRef(new Map<string, number>());
  const recentNotificationsRef = useRef(new Map<string, number>());

  const setData = useCallback<React.Dispatch<React.SetStateAction<AppData>>>((update) => {
    setRawData((previous) => sanitizeAppData(typeof update === "function" ? update(previous) : update));
  }, []);

  const removeNotification = useCallback((id: string) => {
    const timer = notificationTimersRef.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    notificationTimersRef.current.delete(id);
    setNotifications((items) => items.filter((item) => item.id !== id));
  }, []);

  const showNotification = useCallback(
    (message: string, type: NotificationItem["type"] = "success") => {
      const text = normalizeSinhalaDisplayText(message).trim();
      if (!text) return;
      const key = `${type}:${text}`;
      const now = Date.now();
      if (now - (recentNotificationsRef.current.get(key) || 0) < 1500) return;
      recentNotificationsRef.current.set(key, now);
      const id = crypto.randomUUID();
      setNotifications((items) => [...items, { id, message: text, type }].slice(-3));
      const timer = window.setTimeout(() => removeNotification(id), 4000);
      notificationTimersRef.current.set(id, timer);
    },
    [removeNotification],
  );

  const loadProfile = useCallback(async () => {
    const response = await apiFetch("/api/profile");
    if (!response.ok) throw new Error("Profile could not be loaded.");
    const payload = await readJson<{ profile?: UserProfile }>(response);
    if (payload?.profile) setProfile(payload.profile);
  }, []);

  const loadNotifications = useCallback(async () => {
    const response = await apiFetch("/api/notifications");
    if (!response.ok) return;
    const payload = await readJson<{ notifications?: PushNotification[] }>(response);
    setPushNotifications(Array.isArray(payload?.notifications) ? payload.notifications : []);
  }, []);

  const loadOwnData = useCallback(async () => {
    setIsUserDataLoading(true);
    try {
      const response = await apiFetch("/api/data");
      if (!response.ok) throw new Error("Progress data could not be loaded.");
      const payload = await readJson<{ data?: AppData | null }>(response);
      setData(sanitizeAppData(payload?.data));
    } catch (error) {
      setData(defaultData);
      showNotification(error instanceof Error ? error.message : "Progress data could not be loaded.", "error");
    } finally {
      setHasHydratedUserData(true);
      setIsUserDataLoading(false);
    }
  }, [setData, showNotification]);

  const bootstrapAuthenticatedUser = useCallback(
    async (firebaseUser: FirebaseUser) => {
      const nextUser: AppUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || "",
        name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Student",
        picture: firebaseUser.photoURL || undefined,
        emailVerified: firebaseUser.emailVerified,
      };
      setUser(nextUser);

      if (sessionUidRef.current !== firebaseUser.uid) {
        try {
          const idToken = await firebaseUser.getIdToken();
          const response = await apiFetch("/api/auth/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
          });
          if (response.ok) sessionUidRef.current = firebaseUser.uid;
        } catch {
          // Firebase remains the source of truth. A temporary server-session failure
          // must not sign out a valid Firebase user.
        }
      }

      const results = await Promise.allSettled([loadOwnData(), loadProfile(), loadNotifications()]);
      if (results[1].status === "rejected") {
        setProfile({
          email: nextUser.email,
          username: nextUser.name,
          picture: nextUser.picture || "",
          bio: "",
          updatedAt: new Date().toISOString(),
        });
      }

      try {
        const response = await apiFetch("/api/auth/context");
        const contextPayload = await readJson<{ roles?: string[] }>(response);
        if (response.ok && Array.isArray(contextPayload?.roles)) {
          setProfile((current) => current ? {
            ...current,
            role: contextPayload.roles?.[0],
            roles: contextPayload.roles,
          } : current);
        }
      } catch {
        // Role-dependent server routes still enforce authorization independently.
      }
    },
    [loadNotifications, loadOwnData, loadProfile],
  );

  useEffect(() => {
    let unsubscribe: () => void = () => {};
    let cancelled = false;

    void (async () => {
      if (!isFirebaseEnabled || !auth) {
        if (!cancelled) setIsAuthLoading(false);
        return;
      }
      await authPersistenceReady;
      try {
        await getRedirectResultOnce();
      } catch (error) {
        if (!cancelled) {
          showNotification(error instanceof Error ? error.message : "Google sign-in failed.", "error");
        }
      }
      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        void (async () => {
          if (cancelled) return;
          setIsAuthLoading(true);
          if (!firebaseUser) {
            sessionUidRef.current = null;
            setUser(null);
            setProfile(null);
            setPushNotifications([]);
            setData(defaultData);
            setHasHydratedUserData(false);
            setIsAuthLoading(false);
            return;
          }
          await bootstrapAuthenticatedUser(firebaseUser);
          if (!cancelled) setIsAuthLoading(false);
        })();
      });
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [bootstrapAuthenticatedUser, setData, showNotification]);

  const loginWithGoogle = useCallback(async () => {
    if (!auth || !isFirebaseEnabled || loginInFlightRef.current) return;
    loginInFlightRef.current = true;
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      if (shouldUseRedirectAuth()) {
        await signInWithRedirect(auth, provider);
        return;
      }
      await signInWithPopup(auth, provider);
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      const message = code.includes("popup-blocked")
        ? "Google sign-in popup was blocked. Allow popups and try again."
        : code.includes("unauthorized-domain")
          ? "This domain is not authorized in Firebase Authentication."
          : error instanceof Error ? error.message : "Google sign-in failed.";
      showNotification(message, "error");
    } finally {
      loginInFlightRef.current = false;
    }
  }, [showNotification]);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      if (auth) await signOut(auth);
      sessionUidRef.current = null;
      setAdminTargetEmailState(null);
      setAdminTargetUid(null);
      setData(defaultData);
    }
  }, [setData]);

  const persistData = useCallback(async (nextData: AppData) => {
    const targetUid = adminTargetUid;
    const response = targetUid
      ? await apiFetch("/api/admin/support/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetUid,
            operation: "edit",
            reason: "Administrator updated student progress from the support console.",
            data: nextData,
          }),
        })
      : await apiFetch("/api/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: nextData }),
        });
    if (!response.ok) throw new Error("Progress could not be synchronized.");
  }, [adminTargetUid]);

  const saveData = useCallback((nextData: AppData) => {
    const sanitized = sanitizeAppData(nextData);
    setData(sanitized);
    pendingSaveRef.current = sanitized;
    if (!user || isAuthLoading) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const pending = pendingSaveRef.current;
      if (!pending) return;
      void persistData(pending)
        .then(() => { pendingSaveRef.current = null; })
        .catch(() => showNotification("Progress is waiting to sync. It will retry when the connection returns.", "info"));
    }, 650);
  }, [isAuthLoading, persistData, setData, showNotification, user]);

  useEffect(() => {
    const retryPending = () => {
      const pending = pendingSaveRef.current;
      if (!pending || !user) return;
      void persistData(pending)
        .then(() => {
          pendingSaveRef.current = null;
          showNotification("Pending progress was synchronized.", "success");
        })
        .catch(() => undefined);
    };
    window.addEventListener("online", retryPending);
    return () => window.removeEventListener("online", retryPending);
  }, [persistData, showNotification, user]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    notificationTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    notificationTimersRef.current.clear();
    recentNotificationsRef.current.clear();
  }, []);

  const clearLocalStorage = useCallback(() => {
    // Kept as a compatibility name for existing widgets. No browser storage is
    // touched; this resets the authenticated user's cloud progress record.
    saveData(defaultData);
  }, [saveData]);

  const toggleTopic = useCallback((topic: string) => {
    const previousGrade = calculateCurrentGradeFromData(data, currentSubject);
    const nextData = structuredClone(data);
    const current = nextData[currentSubject].topics[topic];
    nextData[currentSubject].topics[topic] = current
      ? { ...current, checked: !current.checked }
      : { checked: true, videos: [] };
    nextData[currentSubject].lessonHistory ||= [];
    nextData[currentSubject].lessonHistory?.push({
      topic,
      done: nextData[currentSubject].topics[topic].checked,
      date: new Date().toISOString(),
    });
    const nextGrade = calculateCurrentGradeFromData(nextData, currentSubject);
    showNotification(
      nextGrade.level > previousGrade.level
        ? `Subject grade upgraded to ${nextGrade.grade}.`
        : `Status updated: ${topic}`,
      "success",
    );
    saveData(nextData);
  }, [currentSubject, data, saveData, showNotification]);

  const updateTopicNotes = useCallback((topic: string, notes: string) => {
    const nextData = structuredClone(data);
    const current = nextData[currentSubject].topics[topic];
    nextData[currentSubject].topics[topic] = current
      ? { ...current, notes }
      : { checked: false, videos: [], notes };
    saveData(nextData);
    showNotification(`Notes saved for ${topic}.`, "success");
  }, [currentSubject, data, saveData, showNotification]);

  const triggerStars = useCallback(() => {
    // Celebration is intentionally event-driven. The visual component owns its
    // animation so the provider does not retain decorative state globally.
    window.dispatchEvent(new CustomEvent("clora-celebrate"));
  }, []);

  const saveProfile = useCallback(async (nextProfile: UserProfile) => {
    const response = await apiFetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: nextProfile }),
    });
    if (!response.ok) throw new Error("Profile could not be saved.");
    setProfile((current) => ({ ...current, ...nextProfile }));
    showNotification("Profile saved.", "success");
  }, [showNotification]);

  const markPushNotificationAsRead = useCallback(async (id: string) => {
    setPushNotifications((items) => items.map((item) => item.id === id ? { ...item, read: true } : item));
    const response = await apiFetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: id }),
    });
    if (!response.ok) await loadNotifications();
  }, [loadNotifications]);

  const setAdminTargetEmail = useCallback(async (email: string | null) => {
    const normalized = email?.trim().toLowerCase() || null;
    if (!normalized) {
      setAdminTargetEmailState(null);
      setAdminTargetUid(null);
      await loadOwnData();
      showNotification("Exited admin support mode.", "info");
      return;
    }
    const resolveResponse = await apiFetch(`/api/admin/users/resolve?email=${encodeURIComponent(normalized)}`);
    const resolvePayload = await readJson<{ uid?: string }>(resolveResponse);
    if (!resolveResponse.ok || !resolvePayload?.uid) {
      showNotification("The requested user could not be found or you do not have access.", "error");
      return;
    }
    const supportResponse = await apiFetch("/api/admin/support/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetUid: resolvePayload.uid,
        operation: "view",
        reason: "Administrator opened student progress in the support console.",
      }),
    });
    const supportPayload = await readJson<{ data?: AppData }>(supportResponse);
    if (!supportResponse.ok) {
      showNotification("Student data could not be opened.", "error");
      return;
    }
    setAdminTargetEmailState(normalized);
    setAdminTargetUid(resolvePayload.uid);
    setData(sanitizeAppData(supportPayload?.data));
    showNotification(`Admin support mode: ${normalized}`, "info");
  }, [loadOwnData, setData, showNotification]);

  const value = useMemo<AppContextType>(() => ({
    data,
    setData,
    user,
    currentSubject,
    setCurrentSubject,
    currentView,
    setCurrentView,
    theme,
    setTheme,
    isSidebarOpen,
    setSidebarOpen,
    isAdvisorOpen,
    setAdvisorOpen,
    modals,
    setModals,
    notifications,
    showNotification,
    removeNotification,
    toggleTopic,
    updateTopicNotes,
    saveData,
    clearLocalStorage,
    triggerStars,
    loginWithGoogle,
    isAuthLoading,
    isUserDataLoading,
    hasHydratedUserData,
    logout,
    profile,
    saveProfile,
    pushNotifications,
    markPushNotificationAsRead,
    adminTargetEmail,
    setAdminTargetEmail,
  }), [
    adminTargetEmail,
    clearLocalStorage,
    currentSubject,
    currentView,
    data,
    hasHydratedUserData,
    isAdvisorOpen,
    isAuthLoading,
    isSidebarOpen,
    isUserDataLoading,
    loginWithGoogle,
    logout,
    markPushNotificationAsRead,
    modals,
    notifications,
    profile,
    pushNotifications,
    removeNotification,
    saveData,
    saveProfile,
    setAdminTargetEmail,
    setData,
    showNotification,
    theme,
    toggleTopic,
    triggerStars,
    updateTopicNotes,
    user,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within an AppProvider");
  return context;
}
