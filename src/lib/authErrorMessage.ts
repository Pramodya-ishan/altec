export function getGoogleAuthErrorMessage(error: any): string {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();

  if (code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request")) {
    return "Google sign-in window එක වසා දමා ඇත. නැවත උත්සාහ කරන්න.";
  }
  if (code.includes("popup-blocked")) {
    return "Browser එක sign-in popup එක block කළා. Popup allow කර නැවත උත්සාහ කරන්න.";
  }
  if (code.includes("unauthorized-domain")) {
    return "මෙම website domain එක Firebase Authentication තුළ authorize කර නැහැ.";
  }
  if (code.includes("network-request-failed")) {
    return "Google sign-in service එකට සම්බන්ධ විය නොහැක. Internet connection එක පරීක්ෂා කරන්න.";
  }
  if (code.includes("too-many-requests")) {
    return "Sign-in attempts වැඩියි. මිනිත්තු කිහිපයකින් නැවත උත්සාහ කරන්න.";
  }
  if (code.includes("operation-not-supported") || code.includes("web-storage-unsupported")) {
    return "මෙම browser mode එක Google sign-in සඳහා support නොකරයි. Normal browser window එකකින් උත්සාහ කරන්න.";
  }
  if (message.includes("redirect_uri_mismatch") || message.includes("redirect uri mismatch")) {
    return "Google OAuth redirect address එක project configuration එකට නොගැළපේ. Firebase auth domain configuration එක පරීක්ෂා කරන්න.";
  }
  return "Google sign-in සම්පූර්ණ කළ නොහැකි විය. නැවත උත්සාහ කරන්න.";
}
