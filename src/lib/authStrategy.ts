export type AuthEnvironment = {
  standalone: boolean;
  userAgent: string;
  viewportWidth: number;
  redirectConfigured: boolean;
};

export function isMobileAuthEnvironment(environment?: Partial<AuthEnvironment>) {
  if (environment) {
    const standalone = environment.standalone === true;
    const userAgent = String(environment.userAgent || "");
    const viewportWidth = Number(environment.viewportWidth || 0);
    return (
      standalone ||
      /Android|iPhone|iPad|iPod/i.test(userAgent) ||
      (Number.isFinite(viewportWidth) && viewportWidth > 0 && viewportWidth < 768)
    );
  }

  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    window.innerWidth < 768
  );
}

/**
 * Redirect auth is used only on mobile/PWA clients when a same-origin Firebase
 * auth helper has explicitly been configured. Redirect auth from a Vercel app
 * to the default firebaseapp.com helper can lose its pending state in browsers
 * that block third-party storage. Popup auth is therefore the safe default.
 */
export function shouldUseRedirectAuth(environment?: Partial<AuthEnvironment>) {
  const redirectConfigured = environment
    ? environment.redirectConfigured === true
    : String(import.meta.env.VITE_FIREBASE_REDIRECT_AUTH_ENABLED || "").toLowerCase() === "true" &&
      String(import.meta.env.VITE_FIREBASE_USE_CUSTOM_AUTH_DOMAIN || "").toLowerCase() === "true";

  return redirectConfigured && isMobileAuthEnvironment(environment);
}
