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

export function applyConfiguredAdminRoles(
  email: unknown,
  emailVerified: boolean,
  currentRoles: string[],
) {
  const normalizedEmail = normalizeEmail(email);
  const isConfiguredAdmin = emailVerified
    && normalizedEmail.length > 0
    && getConfiguredAdminEmails().has(normalizedEmail);

  if (!isConfiguredAdmin) {
    return [...new Set(currentRoles)];
  }

  return [...new Set([...currentRoles, ...PRIVILEGED_ROLES])];
}
