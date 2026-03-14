import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { writeAuditLog } from "@/utils/audit";

const bodySchema = z.object({
  email: z.string().email().optional()
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || null;

  await writeAuditLog(getSupabaseAdminClient(), {
    action: "login_failed",
    actor_id: null,
    entity_id: null,
    entity_type: "auth_session",
    ip_address: ipAddress,
    metadata: {
      email: parsed.data.email ?? null,
      reason: "invalid_credentials"
    }
  });

  return new NextResponse(null, { status: 204 });
}
