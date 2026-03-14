import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getRequestIp,
  jsonError,
  logServerError,
  requireRouteSession
} from "@/lib/route-helpers";
import { writeAuditLog } from "@/utils/audit";

const bodySchema = z
  .object({
    full_name: z.string().trim().min(2).optional(),
    phone: z.union([z.string().trim().max(30), z.literal(""), z.null()]).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required."
  });

export async function PATCH(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return jsonError("Invalid profile update.", 400);
  }

  const sessionContext = await requireRouteSession();

  if ("response" in sessionContext) {
    return sessionContext.response;
  }

  const { admin, user } = sessionContext;
  const updates: {
    full_name?: string;
    phone?: string | null;
  } = {};
  const ipAddress = getRequestIp(request);

  if (parsed.data.full_name !== undefined) {
    updates.full_name = parsed.data.full_name;
  }

  if (parsed.data.phone !== undefined) {
    updates.phone =
      typeof parsed.data.phone === "string"
        ? parsed.data.phone.trim() || null
        : null;
  }

  try {
    const { error } = await admin
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (error) {
      throw error;
    }

    await writeAuditLog(admin, {
      action: "profile_updated",
      actor_id: user.id,
      entity_id: user.id,
      entity_type: "profiles",
      ip_address: ipAddress
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logServerError("profile.patch", error);

    return jsonError("Unable to update your profile.", 500);
  }
}
