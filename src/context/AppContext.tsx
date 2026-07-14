import { calculateCurrentGradeFromData } from '../lib/utils';
import { apiFetch } from "../lib/api";
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { AppData, SubjectKey, ViewKey, ThemeKey, StarItem } from '../types';
import { isFirebaseEnabled, db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, setDoc, collection, onSnapshot, query, orderBy, deleteDoc } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithCredential, signInWithPopup, onAuthStateChanged, signInAnonymously, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, setPersistence, browserLocalPersistence } from 'firebase/auth';

const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client';

function loadGoogleIdentityServices(): Promise<void> {
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_IDENTITY_SCRIPT}"]`);
    const script = existing || document.createElement('script');
    const cleanup = () => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };
    const onLoad = () => {
      cleanup();
      (window as any).google?.accounts?.oauth2 ? resolve() : reject(new Error('Google Identity Services did not initialize.'));
    };
    const onError = () => {
      cleanup();
      reject(new Error('Could not load Google Identity Services.'));
    };
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    if (!existing) {
      script.src = GOOGLE_IDENTITY_SCRIPT;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
}

async function requestGoogleAccessToken(clientId: string): Promise<string> {
  await loadGoogleIdentityServices();
  return new Promise((resolve, reject) => {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      callback: (response: { access_token?: string; error?: string; error_description?: string }) => {
        if (response?.access_token) resolve(response.access_token);
        else reject(new Error(response?.error_description || response?.error || 'Google did not return an access token.'));
      },
      error_callback: (error: { type?: string }) => reject(new Error(error?.type || 'Google sign-in window failed.')),
    });
    client.requestAccessToken({ prompt: 'select_account' });
  });
}

type ModalsState = {
  playlist: { open: boolean; topic: string };
  addPaperMark: { open: boolean; editIndex: number };
  silencePlayer: { open: boolean; videoUrl: string; title: string };
};

export type NotificationItem = {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
};

export type PushNotification = {
  id: string;
  title: string;
  message: string;
  type: 'message' | 'friend_request' | 'announcement';
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

type User = {
  email: string;
  name: string;
  picture?: string;
  token?: string;
  emailVerified?: boolean;
};

type AppContextType = {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  currentSubject: SubjectKey;
  setCurrentSubject: (sub: SubjectKey) => void;
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
  showNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeNotification: (id: number) => void;
  toggleTopic: (topic: string) => void;
  updateTopicNotes: (topic: string, notes: string) => void;
  saveData: (newData: AppData) => void;
  clearLocalStorage: () => void;
  stars: StarItem[];
  triggerStars: () => void;
  fetchUserInfo: (token: string) => Promise<void>;
  loginWithGooglePopup: () => Promise<void>;
  isAuthLoading: boolean;
  isUserDataLoading: boolean;
  hasHydratedUserData: boolean;
  logout: () => void;
  youtubeCookies: string;
  saveYoutubeCookies: (cookies: string) => Promise<void>;
  
  // Custom Profile & Notifications System
  profile: UserProfile | null;
  saveProfile: (p: UserProfile) => Promise<void>;
  pushNotifications: PushNotification[];
  triggerPushNotification: (title: string, message: string, type: 'message' | 'friend_request' | 'announcement', senderEmail?: string, senderName?: string) => Promise<void>;
  markPushNotificationAsRead: (id: string) => Promise<void>;
  markAllPushNotificationsAsRead: () => Promise<void>;
  deletePushNotification: (id: string) => Promise<void>;
  localFriends: string[];
  addFriend: (email: string) => void;

  // Auto Gmail Sending System
  autoEmailLogin: boolean;
  toggleAutoEmailLogin: () => void;
  sendGmailProgressEmail: (overrideEmail?: string, tokenOverride?: string) => Promise<boolean>;

  // Admin capabilities
  adminTargetEmail: string | null;
  setAdminTargetEmail: (email: string | null) => void;

  // Custom Email/Password auth functions
  loginWithEmailAndPassword: (email: string, password: string) => Promise<any>;
  registerWithEmailAndDetails: (params: any) => Promise<any>;
  verifyEmailCode: (email: string, code: string) => Promise<any>;
};

const defaultData: AppData = {
  sft: { topics: {}, paperMarks: [], questionMarks: {} },
  et: { topics: {}, paperMarks: [], questionMarks: {} },
  ict: { topics: {}, paperMarks: [], questionMarks: {} },
};

function sanitizeAppData(value: AppData): AppData {
  return {
    ...value,
    zScoreHistory: Array.isArray(value?.zScoreHistory)
      ? value.zScoreHistory
          .filter((entry) => Number.isFinite(Number(entry?.zScore)) && Boolean(entry?.date))
          .map((entry) => ({
            ...entry,
            calculationBasis: entry.calculationBasis || "legacy_exam_score_predictor",
            official: false as const,
          }))
      : [],
  };
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setRawData] = useState<AppData>(defaultData);
  const setData = React.useCallback<React.Dispatch<React.SetStateAction<AppData>>>((update) => {
    setRawData((previous) => {
      const next = typeof update === "function" ? update(previous) : update;
      return sanitizeAppData(next);
    });
  }, []);
  const [currentSubject, setCurrentSubject] = useState<SubjectKey>('sft');
  const [currentView, setCurrentView] = useState<ViewKey>('paper-structure');
  const [theme, setThemeState] = useState<ThemeKey>('slate');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isAdvisorOpen, setAdvisorOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isUserDataLoading, setIsUserDataLoading] = useState(false);
  const [hasHydratedUserData, setHasHydratedUserData] = useState(false);
  const [youtubeCookies, setYoutubeCookies] = useState<string>('');

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pushNotifications, setPushNotifications] = useState<PushNotification[]>([]);
  const [localFriends, setLocalFriends] = useState<string[]>(['dilshan@alblueprint.com', 'amara@alblueprint.com']);

  const [adminTargetEmail, setAdminTargetEmailState] = useState<string | null>(null);
  const hydratedAuthUidRef = useRef<string | null>(null);

  const fetchProfile = async (rawEmail: string) => {
    const email = rawEmail.toLowerCase();
    if (isFirebaseEnabled && db && auth?.currentUser) {
      try {
        const docRef = doc(db, 'users', email, 'profile', 'info');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const pData = snap.data() as UserProfile;
          setProfile(pData);
          try {
             await apiFetch('/api/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, profile: pData })
             });
          } catch(err) {}
          return;
        }
      } catch (e) {
        console.warn("Firestore fetch profile failed: ", e);
      }
    }
    try {
      const res = await apiFetch(`/api/profile?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setProfile(data.profile);
          return;
        }
      }
    } catch (e) {
      console.warn("Express fetch profile failed: ", e);
    }
    setProfile({
      email,
      username: email.split('@')[0],
      picture: user?.picture || '',
      bio: 'Student on A/L Tech Blueprint journey!',
      updatedAt: new Date().toISOString()
    });
  };

  const setAdminTargetEmail = async (email: string | null) => {
    setAdminTargetEmailState(email);
    if (email) {
      showNotification(`Entering admin mode for user: ${email}`, 'info');
      await fetchUserDataFromDB(email);
      await fetchProfile(email);
    } else {
      showNotification(`Exited admin mode`, 'info');
      if (user?.email) {
        await fetchUserDataFromDB(user.email);
        await fetchProfile(user.email);
      } else {
        clearLocalStorage();
      }
    }
  };

  const saveProfile = async (nextProfile: UserProfile) => {
    setProfile(nextProfile);
    let rawEmail = adminTargetEmail || user?.email || 'local_user';
    const email = rawEmail.toLowerCase();
    if (isFirebaseEnabled && db && auth?.currentUser) {
      try {
        const docRef = doc(db, 'users', email, 'profile', 'info');
        await setDoc(docRef, nextProfile, { merge: true });
      } catch (e) {
        console.error("Firestore save profile failed: ", e);
      }
    }
    try {
      await apiFetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, profile: nextProfile })
      });
    } catch (e) {
      console.error("Express save profile failed: ", e);
    }
  };

  const establishFirebaseSession = async (firebaseUser: any, accessToken = '') => {
    const email = String(firebaseUser?.email || '').trim().toLowerCase();
    if (!email || firebaseUser?.isAnonymous) return;

    const localUser: User = {
      email,
      name: firebaseUser.displayName || email.split('@')[0],
      picture: firebaseUser.photoURL || '',
      token: accessToken || localStorage.getItem('google_access_token') || '',
      emailVerified: firebaseUser.emailVerified === true,
    };
    let cachedProfile: Partial<UserProfile> = {};
    try {
      cachedProfile = JSON.parse(localStorage.getItem('email_user_profile') || '{}');
    } catch {
      localStorage.removeItem('email_user_profile');
    }
    const initialProfile: UserProfile = {
      ...cachedProfile,
      email,
      username: cachedProfile.username || localUser.name,
      picture: firebaseUser.photoURL || cachedProfile.picture || '',
      bio: cachedProfile.bio || '',
      updatedAt: cachedProfile.updatedAt || new Date().toISOString(),
      isVerified: firebaseUser.emailVerified === true,
    };

    setUser(localUser);
    setProfile(initialProfile);
    localStorage.setItem('email_user_session', JSON.stringify(localUser));
    localStorage.setItem('email_user_profile', JSON.stringify(initialProfile));

    const savedData = localStorage.getItem(`student_progress_data_${email}`);
    if (savedData) {
      try { setData(JSON.parse(savedData)); } catch { localStorage.removeItem(`student_progress_data_${email}`); }
    }

    // Authentication must not wait on profile or progress network requests.
    setIsAuthLoading(false);
    void fetchUserDataFromDB(email, { showLoading: !savedData });
    void fetchYoutubeCookies(email);

    try {
      const idToken = await firebaseUser.getIdToken();
      const response = await apiFetch('/api/auth/session', {
        method: 'POST',
        body: JSON.stringify({ idToken, profileData: initialProfile }),
      });
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.user) {
        const nextUser = { ...localUser, ...payload.user, token: localUser.token };
        const nextProfile = {
          ...initialProfile,
          ...(payload.profile || {}),
          picture: payload.profile?.picture || localUser.picture || '',
        };
        setUser(nextUser);
        setProfile(nextProfile);
        localStorage.setItem('email_user_session', JSON.stringify(nextUser));
        localStorage.setItem('email_user_profile', JSON.stringify(nextProfile));
      }
    } catch (error) {
      // Firebase bearer-token APIs remain usable even when optional profile
      // synchronization is temporarily unavailable.
      console.warn('Background session profile sync failed:', error);
    }
  };

  useEffect(() => {
    const email = user?.email;
    if (!email) {
      const localNotifs = localStorage.getItem('local_push_notifications');
      if (localNotifs) {
        try {
          setPushNotifications(JSON.parse(localNotifs));
        } catch (e) {
          console.warn("Cleared corrupted local push notifications cache:", e);
          localStorage.removeItem('local_push_notifications');
        }
      } else {
        const welcomeNotifs: PushNotification[] = [
          {
            id: 'welcome-1',
            title: 'Welcome to AL Blueprint!',
            message: 'Track your SFT, ET, and ICT syllabus progress using our intuitive dashboard and reach your past paper target marks! Need any study tips? Chat with our AI Study Assistant anytime.',
            type: 'announcement',
            senderName: 'AL Blueprint Admin',
            senderEmail: 'system@alblueprint.com',
            read: false,
            timestamp: new Date().toISOString()
          }
        ];
        setPushNotifications(welcomeNotifs);
        localStorage.setItem('local_push_notifications', JSON.stringify(welcomeNotifs));
      }
      setProfile({
        email: 'local_user',
        username: 'LocalStudent',
        picture: `https://api.dicebear.com/7.x/bottts/svg?seed=LocalStudent`,
        bio: 'Student on A/L Tech/SFT/ICT journey!',
        updatedAt: new Date().toISOString()
      });
      return;
    }

    const fetchExpressNotifications = async () => {
      try {
        const res = await apiFetch(`/api/notifications?email=${encodeURIComponent(email)}`);
        if (res.ok) {
          const resp = await res.json();
          if (resp.notifications) {
            setPushNotifications(resp.notifications);
          }
        }
      } catch (err) {
        console.error("Fetch express notifications failed:", err);
      }
    };

    let unsubscribe: () => void = () => {};
    let isCancelled = false;

    const timer = setTimeout(() => {
      if (isCancelled) return;
      fetchProfile(email);
      fetchExpressNotifications();

      if (isFirebaseEnabled && db && auth?.currentUser) {
        try {
          if (auth?.currentUser && auth.currentUser.email && auth.currentUser.email.toLowerCase() !== email.toLowerCase()) {
            console.warn("Skipping direct firestore notification read because auth.currentUser.email does not match requested email");
            return;
          }
          const notifCollectionRef = collection(db, 'users', email, 'notifications');
          const notifQuery = query(notifCollectionRef, orderBy('timestamp', 'desc'));
          unsubscribe = onSnapshot(notifQuery, (snapshot) => {
            const notifs: PushNotification[] = [];
            snapshot.forEach((subDoc) => {
              const d = subDoc.data();
              notifs.push({
                id: subDoc.id,
                title: d.title,
                message: d.message,
                type: d.type as any,
                senderEmail: d.senderEmail,
                senderName: d.senderName,
                read: d.read,
                timestamp: d.timestamp
              });
            });
            setPushNotifications(notifs);
          }, (error) => {
            try {
               handleFirestoreError(error, OperationType.LIST, `users/${email}/notifications`);
            } catch(err) {
               console.error("Firestore onSnapshot error:", error);
            }
          });
        } catch (err) {
          console.warn("Setting up Firestore onSnapshot failed, falling back to express polling:", err);
          const intervalId = setInterval(fetchExpressNotifications, 10000);
          unsubscribe = () => clearInterval(intervalId);
        }
      } else {
        const intervalId = setInterval(fetchExpressNotifications, 10000);
        unsubscribe = () => clearInterval(intervalId);
      }
    }, 1200);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  const triggerPushNotification = async (
    title: string, 
    message: string, 
    type: 'message' | 'friend_request' | 'announcement',
    senderEmail?: string,
    senderName?: string
  ) => {
    const email = user?.email || 'local_user';
    const newNotif: PushNotification = {
      id: Date.now().toString() + Math.random().toString().substring(2, 6),
      title,
      message,
      type,
      senderEmail: senderEmail || 'system@alblueprint.com',
      senderName: senderName || 'AL Blueprint Admin',
      read: false,
      timestamp: new Date().toISOString()
    };

    if (!user?.email) {
      const nextList = [newNotif, ...pushNotifications];
      setPushNotifications(nextList);
      localStorage.setItem('local_push_notifications', JSON.stringify(nextList));
      showNotification(`Push Alert: ${title}`, 'info');
      return;
    }

    if (isFirebaseEnabled && db && auth?.currentUser) {
      try {
        const docRef = doc(db, 'users', email, 'notifications', newNotif.id);
        await setDoc(docRef, newNotif);
      } catch (e) {
        console.error("Firestore push trigger failed: ", e);
      }
    }

    try {
      await apiFetch('/api/notifications/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, notification: newNotif })
      });
      showNotification(`Push Alert: ${title}`, 'info');
    } catch (e) {
      console.error("Express push trigger failed: ", e);
    }
  };

  const markPushNotificationAsRead = async (id: string) => {
    const updated = pushNotifications.map((n) => n.id === id ? { ...n, read: true } : n);
    setPushNotifications(updated);
    
    if (!user?.email) {
      localStorage.setItem('local_push_notifications', JSON.stringify(updated));
      return;
    }

    if (isFirebaseEnabled && db) {
      try {
        const docRef = doc(db, 'users', user.email, 'notifications', id);
        await setDoc(docRef, { read: true }, { merge: true });
      } catch (e) {
        console.error("Firestore read mark failed: ", e);
      }
    }

    try {
      await apiFetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, notificationId: id })
      });
    } catch (e) {}
  };

  const markAllPushNotificationsAsRead = async () => {
    const updated = pushNotifications.map((n) => ({ ...n, read: true }));
    setPushNotifications(updated);

    if (!user?.email) {
      localStorage.setItem('local_push_notifications', JSON.stringify(updated));
      return;
    }

    if (isFirebaseEnabled && db && auth?.currentUser) {
      try {
        pushNotifications.forEach(async (notif) => {
          if (!notif.read) {
            const docRef = doc(db, 'users', user.email, 'notifications', notif.id);
            await setDoc(docRef, { read: true }, { merge: true });
          }
        });
      } catch (e) {}
    }

    try {
      await apiFetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, readAll: true })
      });
    } catch (e) {}
  };

  const deletePushNotification = async (id: string) => {
    const updated = pushNotifications.filter((n) => n.id !== id);
    setPushNotifications(updated);

    if (!user?.email) {
      localStorage.setItem('local_push_notifications', JSON.stringify(updated));
      return;
    }

    if (isFirebaseEnabled && db && auth?.currentUser) {
      try {
        const docRef = doc(db, 'users', user.email, 'notifications', id);
        await deleteDoc(docRef);
      } catch (e) {}
    }

    try {
      await apiFetch('/api/notifications/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, notificationId: id })
      });
    } catch (e) {}
  };

  const addFriend = (emailAddress: string) => {
    if (!localFriends.includes(emailAddress)) {
      setLocalFriends([...localFriends, emailAddress]);
      showNotification("Added study buddy!", "success");
    }
  };

  const [autoEmailLogin, setAutoEmailLogin] = useState<boolean>(() => {
    const saved = localStorage.getItem('auto_email_login_enabled');
    return saved !== null ? saved === 'true' : false;
  });

  const toggleAutoEmailLogin = () => {
    setAutoEmailLogin((p) => {
      const next = !p;
      localStorage.setItem('auto_email_login_enabled', next ? 'true' : 'false');
      showNotification(next ? "Automated login reports enabled!" : "Automated login reports disabled.", "info");
      return next;
    });
  };

  const b64EncodeUnicode = (str: string) => {
    return btoa(
      encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
      })
    );
  };

  const sendGmailProgressEmail = async (overrideEmail?: string, tokenOverride?: string): Promise<boolean> => {
    const activeUser = user;
    const token = tokenOverride || activeUser?.token;
    if (!activeUser || !token) {
      showNotification("Please login with Google to enable Gmail sending.", "error");
      return false;
    }

    const recipient = overrideEmail || activeUser.email;

    try {
            
      const sftGradeInfo = calculateCurrentGradeFromData(data, 'sft');
      const etGradeInfo = calculateCurrentGradeFromData(data, 'et');
      const ictGradeInfo = calculateCurrentGradeFromData(data, 'ict');

      const subjectsHtml = `
        <div style="margin: 20px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; font-family: sans-serif;">
          <h3 style="margin-top: 0; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">📚 Your Study Progress Snapshot</h3>
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 1px solid #cbd5e1; color: #64748b; font-size: 13px;">
                <th style="padding: 8px 0; width: 60%;">Subject</th>
                <th style="padding: 8px 0; text-align: center; width: 20%;">Current Grade</th>
                <th style="padding: 8px 0; text-align: right; width: 20%;">Roster Completion</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; font-weight: bold; color: #334155;">Science for Technology (SFT)</td>
                <td style="padding: 10px 0; text-align: center;"><span style="background: #eff6ff; color: #2563eb; padding: 4px 10px; border-radius: 6px; font-weight: 800; border: 1px solid #dbeafe;">${sftGradeInfo.grade}</span></td>
                <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #475569;">Level ${sftGradeInfo.level >= 0 ? sftGradeInfo.level : '-'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; font-weight: bold; color: #334155;">Engineering Technology (ET)</td>
                <td style="padding: 10px 0; text-align: center;"><span style="background: #f0fdf4; color: #16a34a; padding: 4px 10px; border-radius: 6px; font-weight: 800; border: 1px solid #dcfce7;">${etGradeInfo.grade}</span></td>
                <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #475569;">Level ${etGradeInfo.level >= 0 ? etGradeInfo.level : '-'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #334155;">Information & Communication Tech (ICT)</td>
                <td style="padding: 10px 0; text-align: center;"><span style="background: #fdf2f8; color: #db2777; padding: 4px 10px; border-radius: 6px; font-weight: 800; border: 1px solid #fce7f3;">${ictGradeInfo.grade}</span></td>
                <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #475569;">Level ${ictGradeInfo.level >= 0 ? ictGradeInfo.level : '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;

      const welcomeHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>A/L Tech Blueprint Summary</title>
        </head>
        <body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 10px;">
          <div style="max-width: 600px; margin: 0 auto; padding: 24px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; margin-top: 24px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);">
            <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px;">
              <h2 style="color: #2563eb; font-size: 20px; font-weight: 800; margin: 0;">🚀 A/L Tech Blueprint Progress Report</h2>
              <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Automated account login status report</p>
            </div>
            <div style="font-size: 14px; margin-bottom: 24px;">
              <p>Hi <strong>${activeUser.name}</strong>,</p>
              <p>Welcome back! You have successfully signed in using Google Authentication.</p>
              
              ${subjectsHtml}

              <p>Ready to update your targets or consult the AI Study Assistant? Go back to the learning playground directly:</p>
              <div style="text-align: center; margin: 20px 0;">
                <a href="${window.location.origin}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff !important; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 13px;">Open Study Playground</a>
              </div>
            </div>
            <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #94a3b8; text-align: center;">
              <p>This automated message was sent securely on your behalf. To configure or turn off automated login emails, please visit your account dashboard.</p>
              <p>&copy; ${new Date().getFullYear()} A/L Tech Blueprint.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Base64URL encoding matching RFC 4648
      const emailContent = [
        `To: ${recipient}`,
        `Subject: 🚀 A/L Tech Blueprint Auto-Sync Progress Report`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=utf-8`,
        `Content-Transfer-Encoding: 7bit`,
        ``,
        welcomeHtml
      ].join('\r\n');

      const encodedMessage = b64EncodeUnicode(emailContent)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await apiFetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          raw: encodedMessage
        })
      });

      if (response.ok) {
        showNotification("Success! Status report email sent via Gmail API.", "success");
        await triggerPushNotification(
          "Email Progress Report Sent",
          `Automatically dispatched study progress report to ${recipient} successfully. Check your login inbox!`,
          "announcement"
        );
        return true;
      } else {
        const errorData = await response.json().catch(() => null);
        console.error("Gmail send failed:", errorData);
        
        let customErrorMsg = "";
        if (errorData) {
          if (typeof errorData.error === 'object' && errorData.error !== null) {
            customErrorMsg = errorData.error.message || JSON.stringify(errorData.error);
          } else if (typeof errorData.error === 'string') {
            try {
              const innerJs = JSON.parse(errorData.error);
              customErrorMsg = innerJs.error?.message || innerJs.message || errorData.error;
            } catch {
              customErrorMsg = errorData.error;
            }
          }
        }

        if (response.status === 401 || response.status === 403) {
          const detail = customErrorMsg ? ` (Details: ${customErrorMsg})` : "";
          showNotification(`Your Google authentication has expired or lacks Gmail permissions. Please sign out and sign in with Google again to renew.${detail}`, "error");
        } else {
          const detail = customErrorMsg ? ` (Details: ${customErrorMsg})` : " Ensure Google credentials are fresh and verified.";
          showNotification(`Gmail automated send skipped.${detail}`, "info");
        }
        return false;
      }

    } catch (e: any) {
      console.error("Error sending progress email:", e);
      const errMsg = e?.message || String(e);
      if (errMsg.includes("Failed to fetch")) {
        showNotification("Error sending progress email: Failed to fetch Gmail services from sandbox constraint.", "error");
      }
      return false;
    }
  };

  useEffect(() => {
    let active = true;
    let unsubscribeAutoAuth = () => {};
    const authDeadline = window.setTimeout(() => {
      if (active) setIsAuthLoading(false);
    }, 3500);

    const restoreLegacySession = () => {
      const savedUserSession = localStorage.getItem('email_user_session');
      if (!savedUserSession) return false;
      try {
        const parsedUser = JSON.parse(savedUserSession);
        if (!parsedUser?.email) return false;
        setUser(parsedUser);
        const savedProfile = localStorage.getItem('email_user_profile');
        if (savedProfile) setProfile(JSON.parse(savedProfile));
        const savedData = localStorage.getItem(`student_progress_data_${parsedUser.email.toLowerCase()}`);
        if (savedData) setData(JSON.parse(savedData));
        setIsAuthLoading(false);
        void fetchUserDataFromDB(parsedUser.email, { showLoading: !savedData });
        return true;
      } catch {
        localStorage.removeItem('email_user_session');
        localStorage.removeItem('email_user_profile');
        return false;
      }
    };

    if (isFirebaseEnabled && auth) {
      void setPersistence(auth, browserLocalPersistence).catch((error) => {
        console.warn('Could not enable persistent Firebase authentication:', error);
      });
      unsubscribeAutoAuth = onAuthStateChanged(auth, (firebaseUser) => {
        window.clearTimeout(authDeadline);
        if (!active) return;
        if (firebaseUser && !firebaseUser.isAnonymous) {
          if (hydratedAuthUidRef.current !== firebaseUser.uid) {
            hydratedAuthUidRef.current = firebaseUser.uid;
            void establishFirebaseSession(firebaseUser);
          } else {
            setIsAuthLoading(false);
          }
          return;
        }
        if (firebaseUser?.isAnonymous && restoreLegacySession()) return;
        hydratedAuthUidRef.current = null;
        setUser(null);
        setIsAuthLoading(false);
      });
    } else if (!restoreLegacySession()) {
      setIsAuthLoading(false);
    }

    const localCookies = localStorage.getItem('youtube_bypass_cookies');
    if (localCookies) setYoutubeCookies(localCookies);

    return () => {
      active = false;
      window.clearTimeout(authDeadline);
      unsubscribeAutoAuth();
    };
  }, [isFirebaseEnabled]);

  
  const loginWithGooglePopup = async () => {
    setIsAuthLoading(true);
    try {
      if (isFirebaseEnabled && auth) {
        await setPersistence(auth, browserLocalPersistence);
        const clientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
        let result;
        let accessToken = '';
        if (clientId) {
          accessToken = await requestGoogleAccessToken(clientId);
          const credential = GoogleAuthProvider.credential(null, accessToken);
          result = await signInWithCredential(auth, credential);
        } else if (import.meta.env.DEV) {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account' });
          result = await signInWithPopup(auth, provider);
          accessToken = GoogleAuthProvider.credentialFromResult(result)?.accessToken || '';
        } else {
          const configurationError = new Error('VITE_GOOGLE_CLIENT_ID is not configured for production Google sign-in.');
          (configurationError as any).code = 'auth/missing-google-client-id';
          throw configurationError;
        }
        if (accessToken) {
          localStorage.setItem('google_access_token', accessToken);
        }

        hydratedAuthUidRef.current = result.user.uid;
        await establishFirebaseSession(result.user, accessToken);
        showNotification("Signed in successfully.", "success");
      } else {
         showNotification("Firebase is required for Google login", "error");
      }
    } catch (error: any) {
      console.error("Google Popup Login Error:", error);
      const message = error?.code === 'auth/missing-google-client-id'
        ? "Google sign-in is not configured. Add VITE_GOOGLE_CLIENT_ID in Vercel and redeploy."
        : error?.code === 'auth/popup-closed-by-user' || /popup_closed|cancelled/i.test(String(error?.message || ''))
          ? "Sign-in was closed before it finished."
          : "Google sign-in failed. Verify the OAuth JavaScript origin for this site.";
      showNotification(message, "error");
    }
    setIsAuthLoading(false);
  };

  const fetchUserInfo = async (token: string) => {
    setIsAuthLoading(true);
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        
        if (isFirebaseEnabled && auth) {
          try {
            const credential = GoogleAuthProvider.credential(null, token);
            await signInWithCredential(auth, credential);
            console.log("Firebase Auth signed in via standard token!");
          } catch (e) {
            console.warn("Standard Google-Firebase Auth credential exchange restricted in sandbox. Falling back to anonymous Auth session to enable Firestore storage:", e);
            try {
              await signInAnonymously(auth);
              console.log("Firebase Auth signed in anonymously as fallback!");
            } catch (anonErr: any) {
              if (anonErr.code === 'auth/admin-restricted-operation') {
                console.warn("Firebase anonymous authentication is disabled in the Firebase Console. Progress will be saved offline only.");
              } else {
                console.error("Firebase fallback anonymous login failed:", anonErr);
              }
            }
          }
        }

        setUser({
          email: data.email,
          name: data.name,
          picture: data.picture,
          token,
          emailVerified: data.email_verified === true || data.email_verified === 'true' || true
        });

        const savedData = localStorage.getItem(`student_progress_data_${data.email.toLowerCase()}`);
        if (savedData) {
           try { setData(JSON.parse(savedData)); } catch(e) {}
        }

        await fetchUserDataFromDB(data.email);
        await fetchYoutubeCookies(data.email);
      } else {
        localStorage.removeItem('google_access_token');
      }
    } catch (err) {
      console.error("fetchUserInfo Error (safe to ignore in offline sandbox):", err);
    }
    setIsAuthLoading(false);
  };

  const logout = async () => {
    if (auth) { try { await signOut(auth); } catch(e){} }
    setIsAuthLoading(true);
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('email_user_session');
    localStorage.removeItem('email_user_profile');
    hydratedAuthUidRef.current = null;
    setUser(null);
    setData(defaultData);
    setYoutubeCookies('');
    setIsAuthLoading(false);
  };

  const fetchUserDataFromDB = async (
    rawEmail: string,
    options: { showLoading?: boolean } = {},
  ) => {
      const email = rawEmail.toLowerCase();
      const showLoading = options.showLoading !== false;
      if (showLoading) setIsUserDataLoading(true);
      try {
         // The authenticated UID document is canonical. Reading the legacy
         // email document first could restore stale progress and make newly
         // uploaded lesson videos disappear on the next refresh.
         const res = await apiFetch(`/api/data?email=${encodeURIComponent(email)}`);
         if (res.ok) {
             const result = await res.json();
             if (result.data) {
                 setData(result.data);
                 localStorage.setItem(`student_progress_data_${email}`, JSON.stringify(result.data));
                 return;
             }
         }

         // Direct Firestore is an offline/server-failure fallback. Prefer UID,
         // then read the old email path for accounts created by earlier builds.
         if (isFirebaseEnabled && db && auth?.currentUser) {
            try {
               if (auth.currentUser.email && auth.currentUser.email.toLowerCase() !== email) {
                 throw new Error("AUTH_EMAIL_MISMATCH");
               }
               const references = [
                 doc(db, 'users', auth.currentUser.uid, 'progress', 'data'),
                 doc(db, 'users', email, 'progress', 'data'),
               ];
               for (const reference of references) {
                 const snapshot = await getDoc(reference);
                 const fallbackData = snapshot.exists() ? snapshot.data()?.data : null;
                 if (fallbackData) {
                   setData(fallbackData);
                   localStorage.setItem(`student_progress_data_${email}`, JSON.stringify(fallbackData));
                   return;
                 }
               }
            } catch (fsErr) {
               console.warn("Direct Firestore progress fallback failed:", fsErr);
            }
         }

         // Fallback to local storage if both failed or returned no data
         const savedData = localStorage.getItem(`student_progress_data_${email}`);
         if (savedData) {
            try {
               setData(JSON.parse(savedData));
            } catch(e) {}
         }
      } catch (e) {
         console.error('Failed to load DB data', e);
         // Final safety fallback
         const savedData = localStorage.getItem(`student_progress_data_${email}`);
         if (savedData) {
            try {
               setData(JSON.parse(savedData));
            } catch(err) {}
         }
      } finally {
         setHasHydratedUserData(true);
         if (showLoading) setIsUserDataLoading(false);
      }
  };

  const fetchYoutubeCookies = async (rawEmail: string) => {
     const email = rawEmail.toLowerCase();
     if (isFirebaseEnabled && db && auth?.currentUser) {
        try {
           const docRef = doc(db, 'users', email, 'bypass', 'config');
           const snap = await getDoc(docRef);
           if (snap.exists() && snap.data()?.cookies) {
              const loadedCookies = snap.data().cookies;
              setYoutubeCookies(loadedCookies);
              localStorage.setItem('youtube_bypass_cookies', loadedCookies);
              
              try {
                await apiFetch('/api/cookies', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email, cookies: loadedCookies })
                });
              } catch(err) {}
              return;
           }
        } catch (e) {
           console.warn("Firestore bypass cookies fetch failed:", e);
        }
     }
     
     try {
        const res = await apiFetch(`/api/cookies?email=${encodeURIComponent(email)}`);
        if (res.ok) {
           const result = await res.json();
           if (result.cookies) {
              setYoutubeCookies(result.cookies);
              localStorage.setItem('youtube_bypass_cookies', result.cookies);
              return;
           }
        }
     } catch (err) {}
     
     const savedLocally = localStorage.getItem('youtube_bypass_cookies');
     if (savedLocally) {
        setYoutubeCookies(savedLocally);
     }
  };

  const saveYoutubeCookies = async (cookies: string) => {
     setYoutubeCookies(cookies);
     localStorage.setItem('youtube_bypass_cookies', cookies);
     if (!user?.email) return;
     const email = user.email.toLowerCase();
     
     if (isFirebaseEnabled && db && auth?.currentUser) {
        try {
           const docRef = doc(db, 'users', email, 'bypass', 'config');
           await setDoc(docRef, {
              email: email,
              cookies,
              updatedAt: new Date().toISOString()
           }, { merge: true });
        } catch (e) {
           console.error("Firestore bypass cookies save failed:", e);
        }
     }
     
     try {
        await apiFetch('/api/cookies', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ email: email, cookies })
        });
     } catch (err) {}
  };

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [modals, setModals] = useState<ModalsState>({
    playlist: { open: false, topic: '' },
    addPaperMark: { open: false, editIndex: -1 },
    silencePlayer: { open: false, videoUrl: '', title: '' },
  });

  const [stars, setStars] = useState<StarItem[]>([]);

  const triggerStars = () => {
    const newStars: StarItem[] = Array.from({ length: 25 }).map((_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 1.2 + 0.4,
      driftX: (Math.random() - 0.5) * 15,
      driftY: -(Math.random() * 15 + 10),
      duration: 1.2 + Math.random() * 1.0,
      rotateDeg: Math.random() * 360,
    }));
    setStars(newStars);
    setTimeout(() => setStars([]), 4000);
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now() + Math.random();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeNotification(id);
    }, 4000);
  };

  const removeNotification = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const setTheme = (newTheme: ThemeKey) => {
    setThemeState(newTheme);
    localStorage.setItem('sftAppTheme', newTheme);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('sftAppTheme') as ThemeKey;
    if (savedTheme) {
      setThemeState(savedTheme);
    }
  }, []);

  // Online / Offline synchronization logic
  useEffect(() => {
    const handleOnline = async () => {
      const email = user?.email;
      if (!email) return;

      const unsyncedKey = `al_blueprint_unsynced_data_${email}`;
      const unsyncedRaw = localStorage.getItem(unsyncedKey);
      if (unsyncedRaw) {
        try {
          const unsyncedData = JSON.parse(unsyncedRaw);
          showNotification("Connection restored! Synchronizing your offline changes...", "info");

          let fireSynced = false;
          let serverSynced = false;

          if (isFirebaseEnabled && db && auth?.currentUser) {
            try {
              const docRef = doc(db, 'users', email, 'progress', 'data');
              await setDoc(docRef, {
                 email: email,
                 data: unsyncedData,
                 updatedAt: new Date().toISOString()
              }, { merge: true });
              fireSynced = true;
            } catch (fsErr) {
              console.warn("Firestore sync failed during auto-sync:", fsErr);
            }
          }

          try {
            const res = await apiFetch('/api/data', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ email: email, data: unsyncedData })
            });
            if (res.ok) {
              serverSynced = true;
            }
          } catch (e) {
            console.warn("Express sync failed during auto-sync:", e);
          }

          if (fireSynced || serverSynced) {
            localStorage.removeItem(unsyncedKey);
            showNotification("Your offline changes have been fully synchronized with the cloud db!", "success");
            setData(unsyncedData);
          }
        } catch (e) {
          console.error("Failed to parse or sync local data", e);
        }
      }
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [user, isFirebaseEnabled]);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<AppData | null>(null);

  const saveData = React.useCallback(async (newData: AppData) => {
    setData(newData);
    let rawEmail = adminTargetEmail || user?.email;
    const currentUserEmail = rawEmail?.toLowerCase();
    if (currentUserEmail) {
      localStorage.setItem(`student_progress_data_${currentUserEmail}`, JSON.stringify(newData));
    }

    if (isAuthLoading) {
      pendingSaveRef.current = newData;
      return;
    }

    if (!currentUserEmail) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await apiFetch('/api/data', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ email: currentUserEmail, data: newData })
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message || payload?.error || `Progress sync failed (${response.status})`);
        }
        localStorage.removeItem(`al_blueprint_unsynced_data_${currentUserEmail}`);
      } catch (err) {
        localStorage.setItem(`al_blueprint_unsynced_data_${currentUserEmail}`, JSON.stringify(newData));
        console.warn("Progress was saved locally and queued for cloud synchronization.", err);
      }
    }, 1500);
  }, [adminTargetEmail, user?.email, isAuthLoading]);

  useEffect(() => {
    if (isAuthLoading || !pendingSaveRef.current) return;
    const pendingData = pendingSaveRef.current;
    pendingSaveRef.current = null;
    void saveData(pendingData);
  }, [isAuthLoading, saveData]);

  useEffect(() => () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
  }, []);

  const clearLocalStorage = async () => {
    setData(defaultData);
    if (!user?.email) return;

    if (isFirebaseEnabled && db && auth?.currentUser) {
       try {
          if (auth.currentUser.email && auth.currentUser.email.toLowerCase() !== user.email.toLowerCase()) {
              console.warn("Skipping direct firestore write because auth.currentUser.email does not match requested email");
              return;
          }
          const docRef = doc(db, 'users', user.email, 'progress', 'data');
          await setDoc(docRef, {
             email: user.email,
             data: defaultData,
             updatedAt: new Date().toISOString()
          }, { merge: true });
       } catch (err) {}
    }

    try {
      await apiFetch('/api/data', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ email: user.email, data: defaultData })
      });
    } catch (e) {}
  };

  const toggleTopic = (topic: string) => {
    const prevGrade = calculateCurrentGradeFromData(data, currentSubject);
    const nextData = structuredClone(data);
    if (!nextData[currentSubject].topics[topic]) {
      nextData[currentSubject].topics[topic] = { checked: true, videos: [] };
    } else {
      nextData[currentSubject].topics[topic].checked = !nextData[currentSubject].topics[topic].checked;
    }
    
    const isDone = nextData[currentSubject].topics[topic].checked;
    if (!nextData[currentSubject].lessonHistory) {
      nextData[currentSubject].lessonHistory = [];
    }
    nextData[currentSubject].lessonHistory.push({
      topic,
      done: isDone,
      date: new Date().toISOString()
    });
    
    const nextGrade = calculateCurrentGradeFromData(nextData, currentSubject);
    if (nextGrade.level > prevGrade.level) {
      triggerStars();
      showNotification(`Subject Grade Upgraded to ${nextGrade.grade}!`, 'success');
    } else {
      showNotification(`Status updated: ${topic}`, 'success');
    }
    
    saveData(nextData);
  };

  const updateTopicNotes = (topic: string, notes: string) => {
    const nextData = structuredClone(data);
    if (!nextData[currentSubject].topics[topic]) {
      nextData[currentSubject].topics[topic] = { checked: false, videos: [], notes };
    } else {
      nextData[currentSubject].topics[topic].notes = notes;
    }
    saveData(nextData);
    showNotification(`Notes saved for ${topic}`, 'success');
  };

  const loginWithEmailAndPassword = async (email: string, password: string) => {
    setIsAuthLoading(true);
    try {
      if (isFirebaseEnabled && auth) {
        const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
        const idToken = await credential.user.getIdToken();
        
        const res = await apiFetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken })
        });
        const resData = await res.json();
        
        if (res.ok) {
          setUser(resData.user);
          setProfile(resData.profile);
          localStorage.setItem('email_user_session', JSON.stringify(resData.user));
          localStorage.setItem('email_user_profile', JSON.stringify(resData.profile));

          const savedData = localStorage.getItem(`student_progress_data_${resData.user.email.toLowerCase()}`);
          if (savedData) {
             try { setData(JSON.parse(savedData)); } catch(e) {}
          }

          await fetchUserDataFromDB(resData.user.email);
          await fetchYoutubeCookies(resData.user.email);
          showNotification("සතුටුදායකයි! සාර්ථකව සම්බන්ධ වුණා. (Successfully logged in!)", "success");
          setIsAuthLoading(false);
          return { success: true };
        } else {
          showNotification(resData.error || "Login failed", "error");
          setIsAuthLoading(false);
          return { error: resData.error || "Login failed" };
        }
      } else {
        // Fallback to pseudo-login if Firebase is disabled
        const res = await apiFetch('/api/auth/email-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const resData = await res.json();
        if (res.ok) {
          if (resData.requiresVerification) {
            setIsAuthLoading(false);
            return { requiresVerification: true, email: resData.email, debugCode: resData.debugCode };
          }
          setUser(resData.user);
          setProfile(resData.profile);
          localStorage.setItem('email_user_session', JSON.stringify(resData.user));
          localStorage.setItem('email_user_profile', JSON.stringify(resData.profile));

          const savedData = localStorage.getItem(`student_progress_data_${resData.user.email.toLowerCase()}`);
          if (savedData) {
             try { setData(JSON.parse(savedData)); } catch(e) {}
          }

          try { if (isFirebaseEnabled && auth && !auth.currentUser) await signInAnonymously(auth); } catch(e) {}
          await fetchUserDataFromDB(resData.user.email);
          await fetchYoutubeCookies(resData.user.email);
          showNotification("සතුටුදායකයි! සාර්ථකව සම්බන්ධ වුණා. (Successfully logged in!)", "success");
          setIsAuthLoading(false);
          return { success: true };
        } else {
          showNotification(resData.error || "Login failed", "error");
          setIsAuthLoading(false);
          return { error: resData.error || "Login failed" };
        }
      }
    } catch (e: any) {
      showNotification("Firebase login failed or network error. " + (e.message || ""), "error");
      setIsAuthLoading(false);
      return { error: e.message || "Network error" };
    }
  };

  const registerWithEmailAndDetails = async (params: any) => {
    setIsAuthLoading(true);
    try {
      if (isFirebaseEnabled && auth) {
        const credential = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
        const idToken = await credential.user.getIdToken();

        const res = await apiFetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, profileData: params })
        });
        const resData = await res.json();

        if (res.ok) {
          setUser(resData.user);
          setProfile(resData.profile);
          localStorage.setItem('email_user_session', JSON.stringify(resData.user));
          localStorage.setItem('email_user_profile', JSON.stringify(resData.profile));

          const savedData = localStorage.getItem(`student_progress_data_${resData.user.email.toLowerCase()}`);
          if (savedData) {
             try { setData(JSON.parse(savedData)); } catch(e) {}
          }

          await fetchUserDataFromDB(resData.user.email);
          await fetchYoutubeCookies(resData.user.email);
          showNotification(resData.message || "ලියාපදිංචිය සාර්ථකයි! (Registration successful!)", "success");
          setIsAuthLoading(false);
          return { success: true };
        } else {
          showNotification(resData.error || "Registration failed", "error");
          setIsAuthLoading(false);
          return { error: resData.error || "Registration failed" };
        }
      } else {
        const res = await apiFetch('/api/auth/register-start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        });
        const resData = await res.json();
        if (res.ok) {
          setUser(resData.user);
          setProfile(resData.profile);
          localStorage.setItem('email_user_session', JSON.stringify(resData.user));
          localStorage.setItem('email_user_profile', JSON.stringify(resData.profile));

          const savedData = localStorage.getItem(`student_progress_data_${resData.user.email.toLowerCase()}`);
          if (savedData) {
             try { setData(JSON.parse(savedData)); } catch(e) {}
          }

          try { if (isFirebaseEnabled && auth && !auth.currentUser) await signInAnonymously(auth); } catch(e) {}
          await fetchUserDataFromDB(resData.user.email);
          await fetchYoutubeCookies(resData.user.email);
          showNotification(resData.message || "ලියාපදිංචිය සාර්ථකයි! (Registration successful!)", "success");
          setIsAuthLoading(false);
          return { success: true };
        } else {
          showNotification(resData.error || "Registration failed", "error");
          setIsAuthLoading(false);
          return { error: resData.error || "Registration failed" };
        }
      }
    } catch (e: any) {
      showNotification("Firebase registration failed or network error. " + (e.message || ""), "error");
      setIsAuthLoading(false);
      return { error: e.message || "Network error" };
    }
  };

  const verifyEmailCode = async (email: string, code: string) => {
    setIsAuthLoading(true);
    try {
      const res = await apiFetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      const resData = await res.json();
      if (res.ok) {
        setUser(resData.user);
        setProfile(resData.profile);
        
        const savedData = localStorage.getItem(`student_progress_data_${resData.user.email.toLowerCase()}`);
        if (savedData) {
           try { setData(JSON.parse(savedData)); } catch(e) {}
        }

        try { if (isFirebaseEnabled && auth && !auth.currentUser) await signInAnonymously(auth); } catch(e) {}
        await fetchUserDataFromDB(resData.user.email);
        await fetchYoutubeCookies(resData.user.email);
        showNotification("සත්‍යාපනය සාර්ථකයි! ලොග් වීම සම්පූර්ණයි. (Email verified & logged in!)", "success");
        setIsAuthLoading(false);
        return { success: true };
      } else {
        showNotification(resData.error || "Verification failed", "error");
        setIsAuthLoading(false);
        return { error: resData.error || "Verification failed" };
      }
    } catch (e: any) {
      showNotification("ජාලගත වීමේ සේවා දෝෂයකි. (Could not connect to verification server)", "error");
      setIsAuthLoading(false);
      return { error: e.message || "Network error" };
    }
  };

  const contextValue = React.useMemo(() => ({
    data,
    setData,
    user,
    setUser,
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
    stars,
    triggerStars,
    fetchUserInfo,
    loginWithGooglePopup,
    isAuthLoading,
    isUserDataLoading,
    hasHydratedUserData,
    logout,
    youtubeCookies,
    saveYoutubeCookies,
    profile,
    saveProfile,
    pushNotifications,
    triggerPushNotification,
    markPushNotificationAsRead,
    markAllPushNotificationsAsRead,
    deletePushNotification,
    localFriends,
    addFriend,
    autoEmailLogin,
    toggleAutoEmailLogin,
    sendGmailProgressEmail,
    adminTargetEmail,
    setAdminTargetEmail,
    loginWithEmailAndPassword,
    registerWithEmailAndDetails,
    verifyEmailCode
  }), [
    data, user, currentSubject, currentView, theme, isSidebarOpen, isAdvisorOpen, modals, notifications, stars, isAuthLoading, isUserDataLoading, hasHydratedUserData, youtubeCookies, profile, pushNotifications, localFriends, autoEmailLogin, adminTargetEmail
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
}
