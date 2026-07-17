export type AuthEnvironment = {
  standalone: boolean;
  userAgent: string;
  viewportWidth: number;
};

export function shouldUseRedirectAuth(environment?: Partial<AuthEnvironment>) {
  const resolved: AuthEnvironment = {
    standalone: environment?.standalone ?? (typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches === true),
    userAgent: environment?.userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : ""),
    viewportWidth: environment?.viewportWidth ?? (typeof window !== "undefined" ? window.innerWidth : 1024),
  };
  return resolved.standalone
    || /Android|iPhone|iPad|iPod/i.test(resolved.userAgent)
    || resolved.viewportWidth < 768;
}
