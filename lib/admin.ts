import type { CardStatus, FraudStatus, UserRole } from "@/types";

export function getAdminRoleLabel(role: UserRole | null | undefined) {
  return role === "admin" ? "Admin" : "Staff";
}

export function getAdminRoleBadgeClass(role: UserRole | null | undefined) {
  return role === "admin"
    ? "bg-[#0A2540]/10 text-[#0A2540]"
    : "bg-sky-100 text-sky-700";
}

export function getProfileStatusBadgeClass(status: string) {
  return status === "active"
    ? "bg-emerald-100 text-emerald-700"
    : "bg-red-100 text-red-700";
}

export function getAccountActivityBadgeClass(isActive: boolean) {
  return isActive
    ? "bg-emerald-100 text-emerald-700"
    : "bg-slate-200 text-slate-600";
}

export function getFraudStatusBadgeClass(status: FraudStatus) {
  if (status === "flagged") {
    return "bg-amber-100 text-amber-700";
  }

  if (status === "confirmed") {
    return "bg-red-100 text-red-700";
  }

  return "bg-slate-200 text-slate-600";
}

export function getCardStatusBadgeClass(status: CardStatus) {
  if (status === "active") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "frozen") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-red-100 text-red-700";
}

export function getTicketPriorityBadgeClass(priority: string) {
  if (priority === "high") {
    return "bg-red-100 text-red-700";
  }

  if (priority === "low") {
    return "bg-slate-100 text-slate-600";
  }

  return "bg-amber-100 text-amber-700";
}

export function getTicketStatusBadgeClass(status: string) {
  if (status === "resolved") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "in_progress") {
    return "bg-sky-100 text-sky-700";
  }

  return "bg-amber-100 text-amber-700";
}

export function getCheckStatusBadgeClass(status: string) {
  if (status === "processed") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "rejected") {
    return "bg-red-100 text-red-700";
  }

  if (status === "processing") {
    return "bg-sky-100 text-sky-700";
  }

  return "bg-amber-100 text-amber-700";
}

export function formatAdminStatusLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
