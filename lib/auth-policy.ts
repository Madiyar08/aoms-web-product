/** Pure policy helpers shared by middleware and tests. */
export type AuthGateDecision = "allow" | "redirect_not_configured" | "redirect_unauthorized";

/** Fail closed: an unset ADMIN_PASSWORD must never expose server-rendered admin pages. */
export function decideAdminPageAccess(configuredPassword: string | undefined, suppliedToken: string | undefined, expectedToken: string | undefined): AuthGateDecision {
  if (!configuredPassword) return "redirect_not_configured";
  if (!suppliedToken || !expectedToken || suppliedToken !== expectedToken) return "redirect_unauthorized";
  return "allow";
}

/** Secure cookies on HTTPS while keeping localhost development usable. */
export function shouldUseSecureCookie(protocol: string): boolean {
  return protocol.toLowerCase() === "https:";
}
