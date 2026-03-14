import type {
  AccountType,
  CardStatus,
  TransactionDirection
} from "@/types";

export function getAccountTypeLabel(type: AccountType): string {
  switch (type) {
    case "current":
      return "Current Account";
    case "savings":
      return "Savings Account";
    case "isa":
      return "ISA";
    default:
      return "Account";
  }
}

export function getTransactionPrefix(direction: TransactionDirection): string {
  return direction === "credit" ? "+" : "\u2212";
}

export function getTransactionTone(direction: TransactionDirection): string {
  return direction === "credit" ? "text-emerald-600" : "text-red-600";
}

export function getCardStatusMeta(status: CardStatus): {
  dotClassName: string;
  label: string;
} {
  switch (status) {
    case "active":
      return {
        dotClassName: "bg-emerald-400",
        label: "Active"
      };
    case "frozen":
      return {
        dotClassName: "bg-amber-400",
        label: "Frozen"
      };
    case "cancelled":
      return {
        dotClassName: "bg-red-400",
        label: "Cancelled"
      };
    default:
      return {
        dotClassName: "bg-slate-400",
        label: "Unknown"
      };
  }
}

export function formatCardExpiry(expiresAt: string | null): string {
  if (!expiresAt) {
    return "--/--";
  }

  const date = new Date(expiresAt);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const year = `${date.getFullYear()}`.slice(-2);

  return `${month}/${year}`;
}
