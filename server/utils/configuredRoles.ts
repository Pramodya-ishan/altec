const PRIVILEGED_ROLES = ["admin", "content_editor", "ops", "reviewer"] as const;

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function getConfiguredAdminEmails() {
  return new Set(
    [process.env.ADMIN_EMAILS, process.env.SYLLABUS_OWNER_EMAIL]
      .filter(Boolean)
      .join(",")
      .split(",")
      .map(normalizeEmail)
      .filter(Boolean),
  );
}

export function getConfiguredAdminUids() {
  return new Set(
    String(process.env.ADMIN_UIDS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export function applyConfiguredAdminRoles(
  email: unknown,
  emailVerified: boolean,
  currentRoles: string[],
  uid?: unknown,
) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedUid = typeof uid === "string" ? uid.trim() : "";
  const configuredByUid = normalizedUid.length > 0 && getConfiguredAdminUids().has(normalizedUid);
  const configuredByEmail = emailVerified
    && normalizedEmail.length > 0
    && getConfiguredAdminEmails().has(normalizedEmail);
  const isConfiguredAdmin = configuredByUid || configuredByEmail;

  if (!isConfiguredAdmin) {
    return [...new Set(currentRoles)];
  }

  return [...new Set([...currentRoles, ...PRIVILEGED_ROLES])];
}
