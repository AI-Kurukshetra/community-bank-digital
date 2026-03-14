import { formatGBP } from "@/utils/currency";
import { maskAccountNumber } from "@/utils/maskAccount";
import type { Account, UserRole } from "@/types";

export const LOGIN_LOCKOUT_STORAGE_KEY = "communitybank_login_lockout";
export const LOGIN_FAILURE_STORAGE_KEY = "communitybank_login_failures";
export const LOGIN_LOCKOUT_SECONDS = 30;

export function getHomePathForRole(role?: UserRole | null) {
  if (role === "staff" || role === "admin") {
    return "/admin/dashboard";
  }

  return "/dashboard";
}

export function getFirstName(fullName?: string | null) {
  if (!fullName) {
    return "Customer";
  }

  const [firstName] = fullName.trim().split(/\s+/);

  return firstName || "Customer";
}

export function isCustomerRole(role?: UserRole | null) {
  return role === "customer";
}

export function isStaffRole(role?: UserRole | null) {
  return role === "staff";
}

export function isAdminRole(role?: UserRole | null) {
  return role === "admin";
}

export function isPrivilegedRole(role?: UserRole | null) {
  return role === "staff" || role === "admin";
}

export function formatMaskedAccountSummary(
  account?: Pick<Account, "account_number" | "balance_pence" | "type"> | null
) {
  if (!account) {
    return "No account linked yet";
  }

  return `${account.type.toUpperCase()} ${maskAccountNumber(
    account.account_number
  )} | ${formatGBP(account.balance_pence)}`;
}
