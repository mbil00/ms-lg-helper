function normalizePrincipal(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function getConfiguredAdminUpns() {
  return (process.env.ADMIN_UPNS ?? "")
    .split(",")
    .map((value) => normalizePrincipal(value))
    .filter(Boolean);
}

export function isAdminPrincipal(value?: string | null) {
  const principal = normalizePrincipal(value);
  if (!principal) {
    return false;
  }

  const allowedPrincipals = getConfiguredAdminUpns();
  return allowedPrincipals.includes(principal);
}

export function isAdminUser(user?: { upn?: string; email?: string | null } | null) {
  return isAdminPrincipal(user?.upn ?? user?.email);
}
