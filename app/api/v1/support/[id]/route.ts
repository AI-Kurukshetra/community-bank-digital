import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getRequestIp,
  jsonError,
  logServerError,
  requireRole,
  requireRouteSession
} from "@/lib/route-helpers";
import { writeAuditLog } from "@/utils/audit";

const bodySchema = z
  .object({
    action: z.enum(["assign_to_me", "update_status"]),
    status: z.enum(["in_progress", "resolved"]).optional()
  })
  .refine(
    (value) => value.action !== "update_status" || value.status !== undefined,
    { message: "Status is required." }
  );

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return jsonError("Invalid request.", 400);
  }

  const sessionContext = await requireRouteSession();

  if ("response" in sessionContext) {
    return sessionContext.response;
  }

  const { admin, user } = sessionContext;
  const roleContext = await requireRole(user.id, ["staff", "admin"]);

  if ("response" in roleContext) {
    return roleContext.response;
  }

  const ipAddress = getRequestIp(request);
  const { data: ticketData } = await admin
    .from("support_tickets")
    .select("id")
    .eq("id", params.id)
    .maybeSingle();

  if (!ticketData) {
    return jsonError("Not found.", 404);
  }

  try {
    if (parsed.data.action === "assign_to_me") {
      const { error } = await admin
        .from("support_tickets")
        .update({
          assigned_to: user.id,
          status: "in_progress"
        })
        .eq("id", params.id);

      if (error) {
        throw error;
      }
    } else {
      const { error } = await admin
        .from("support_tickets")
        .update({ status: parsed.data.status })
        .eq("id", params.id);

      if (error) {
        throw error;
      }

      if (parsed.data.status === "resolved") {
        await writeAuditLog(admin, {
          action: "ticket_resolved",
          actor_id: user.id,
          entity_id: params.id,
          entity_type: "support_tickets",
          ip_address: ipAddress
        });
      }
    }

    revalidatePath("/admin/support");
    revalidatePath(`/admin/support/${params.id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    logServerError("support.patch", error);

    return jsonError("Action failed. Please try again.", 500);
  }
}
