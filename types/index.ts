export type UserRole = "customer" | "staff" | "admin";
export type AccountType = "current" | "savings" | "isa";
export type CardStatus = "active" | "frozen" | "cancelled";
export type TransactionDirection = "debit" | "credit";
export type BillFrequency = "one_off" | "weekly" | "monthly";
export type FraudStatus = "flagged" | "confirmed" | "dismissed";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  status: string;
  created_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  type: AccountType;
  account_number: string;
  sort_code: string;
  balance_pence: number;
  is_active: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  amount_pence: number;
  direction: TransactionDirection;
  description: string | null;
  merchant: string | null;
  category: string;
  reference: string | null;
  created_at: string;
}

export interface Card {
  id: string;
  account_id: string;
  user_id: string;
  masked_number: string;
  card_type: string;
  status: CardStatus;
  daily_limit_pence: number;
  expires_at: string | null;
  created_at: string;
}

export interface Beneficiary {
  id: string;
  user_id: string;
  name: string;
  account_number: string;
  sort_code: string;
  bank_name: string | null;
  created_at: string;
}

export interface BillPayment {
  id: string;
  user_id: string;
  payee_name: string;
  reference: string | null;
  amount_pence: number;
  frequency: BillFrequency;
  next_payment_date: string | null;
  is_active: boolean;
  created_at: string;
}

export interface FraudEvent {
  id: string;
  user_id: string;
  transaction_id: string | null;
  trigger_reason: string | null;
  status: FraudStatus;
  reviewed_by: string | null;
  created_at: string;
}

export type LoanStatus = "active" | "paid_off" | "defaulted";
export type LoanType = "personal" | "mortgage" | "auto" | "business";
export type TicketStatus = "open" | "in_progress" | "resolved";
export type DocumentType = "tax" | "loan" | "letter" | "other";
export type CheckStatus = "pending" | "processing" | "processed" | "rejected";

export interface Loan {
  id: string;
  user_id: string;
  account_id: string | null;
  loan_type: LoanType;
  principal_pence: number;
  balance_pence: number;
  rate_bps: number;
  monthly_payment_pence: number;
  next_payment_date: string | null;
  start_date: string | null;
  end_date: string | null;
  status: LoanStatus;
  created_at: string;
}

export interface Statement {
  id: string;
  account_id: string;
  period_start: string;
  period_end: string;
  storage_path: string | null;
  created_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  type: DocumentType;
  filename: string;
  storage_path: string;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  assigned_to: string | null;
  subject: string;
  body: string;
  status: TicketStatus;
  priority: string;
  created_at: string;
  updated_at: string;
}

export interface AlertConfig {
  id: string;
  user_id: string;
  type: string;
  is_active: boolean;
  threshold_pence: number | null;
  days_before: number | null;
  created_at: string;
}

export interface CheckImage {
  id: string;
  user_id: string;
  account_id: string;
  storage_path: string;
  amount_pence: number | null;
  status: CheckStatus;
  rejection_reason: string | null;
  created_at: string;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  postcode: string;
  lat: number;
  lng: number;
  phone: string | null;
  opening_hours: Record<string, string> | null;
  created_at: string;
}

export interface ATM {
  id: string;
  operator: string;
  address: string;
  postcode: string;
  lat: number;
  lng: number;
  is_available: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
