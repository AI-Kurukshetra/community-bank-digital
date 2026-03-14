import { NextResponse } from "next/server";
import { z } from "zod";

import {
  jsonError,
  logServerError,
  requireRouteSession
} from "@/lib/route-helpers";

const alertConfigSchema = z.object({
  days_before: z.number().int().nullable().optional(),
  is_active: z.boolean(),
  threshold_pence: z.number().int().nullable().optional(),
  type: z.string().trim().min(1)
});

const bodySchema = z.array(alertConfigSchema);
const LOCKED_ALERT_TYPES = new Set(["new_device_login", "fraud_flagged"]);

export async function PATCH(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return jsonError("Invalid alert preferences.", 400);
  }

  const sessionContext = await requireRouteSession();

  if ("response" in sessionContext) {
    return sessionContext.response;
  }

  const { admin, user } = sessionContext;
  const rows = parsed.data
    .filter((config) => !LOCKED_ALERT_TYPES.has(config.type))
    .map((config) => ({
      days_before: config.days_before ?? null,
      is_active: config.is_active,
      threshold_pence: config.threshold_pence ?? null,
      type: config.type,
      user_id: user.id
    }));

  try {
    if (rows.length > 0) {
      const { error } = await admin
        .from("alert_configs")
        .upsert(rows, { onConflict: "user_id,type" });

      if (error) {
        throw error;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logServerError("alerts.patch", error);

    return jsonError("Unable to save alert preferences.", 500);
  }
}
