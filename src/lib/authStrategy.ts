export type AuthEnvironment = {
  standalone: boolean;
  userAgent: string;
  viewportWidth: number;
};

/**
 * Google authentication always uses a top-level redirect.
 *
 * Firebase popup auth polls popupWindow.closed. Cross-origin browser isolation
 * can legitimately block that access and flood production consoles with COOP
 * warnings. Redirect auth avoids popup polling on every device and is also more
 * reliable in PWAs, iOS, and mobile browsers.
 */
export function shouldUseRedirectAuth(_environment?: Partial<AuthEnvironment>) {
  return true;
}
