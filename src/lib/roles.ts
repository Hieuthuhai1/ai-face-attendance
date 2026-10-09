import type { Role } from "@/types/db";

/** Helper thuần cho kiểm tra role phía client/server component (UX),
 *  quyết định thật luôn ở requireRole() + RLS phía server. */
export function hasRole(actual: Role | undefined, allowed: Role[]): boolean {
  if (!actual) return false;
  return allowed.includes(actual);
}

export const HR_ROLES: Role[] = ["hr_admin", "system_admin"];
export const REVIEW_ROLES: Role[] = ["manager", "hr_admin", "system_admin"];
