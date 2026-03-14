import { SupabaseClient } from "@supabase/supabase-js";

interface AuditEntry {
  actor_id: string | null;
  action: string;
  entity_type?: string;
  entity_id?: string | null;
  ip_address?: string | null;
  metadata?: Record<string, unknown>;
}

export const writeAuditLog = async (
  supabase: SupabaseClient,
  entry: AuditEntry
): Promise<void> => {
  try {
    await supabase.from("audit_logs").insert(entry);
  } catch (err) {
    console.error("[audit] failed:", err);
    // Never throw - audit failure must never break the user flow
  }
};
