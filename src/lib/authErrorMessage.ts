export function getGoogleAuthErrorMessage(error: any): string {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();

  if (code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request")) {
    return "The Google sign-in window was closed. Please try again.";
  }
  if (code.includes("popup-blocked")) {
    return "Your browser blocked the sign-in popup. Allow popups and try again.";
  }
  if (code.includes("unauthorized-domain")) {
    return "This website domain is not authorized in Firebase Authentication.";
  }
  if (code.includes("network-request-failed")) {
    return "Could not reach Google sign-in. Check your internet connection and try again.";
  }
  if (code.includes("too-many-requests")) {
    return "Too many sign-in attempts. Please wait a few minutes and try again.";
  }
  if (code.includes("operation-not-supported") || code.includes("web-storage-unsupported")) {
    return "This browser mode does not support Google sign-in. Try again in a normal browser window.";
  }
  if (message.includes("redirect_uri_mismatch") || message.includes("redirect uri mismatch")) {
    return "The Google OAuth redirect address does not match the project configuration. Check the Firebase auth-domain settings.";
  }
  return "Google sign-in could not be completed. Please try again.";
}
