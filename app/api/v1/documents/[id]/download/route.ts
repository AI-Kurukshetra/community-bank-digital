import { NextResponse } from "next/server";

import {
  getRequestIp,
  getSignedUrl,
  jsonError,
  logServerError,
  requireRouteSession
} from "@/lib/route-helpers";
import type { Document } from "@/types";
import { writeAuditLog } from "@/utils/audit";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const sessionContext = await requireRouteSession();

  if ("response" in sessionContext) {
    return sessionContext.response;
  }

  const { admin, user } = sessionContext;
  const ipAddress = getRequestIp(request);
  const { data: documentData } = await admin
    .from("documents")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  const document = (documentData ?? null) as Document | null;

  if (!document) {
    return jsonError("Not found.", 404);
  }

  if (document.user_id !== user.id) {
    return jsonError("Forbidden", 403);
  }

  try {
    const url = await getSignedUrl("documents", document.storage_path);

    await writeAuditLog(admin, {
      action: "document_downloaded",
      actor_id: user.id,
      entity_id: document.id,
      entity_type: "documents",
      ip_address: ipAddress
    });

    return NextResponse.json({ url });
  } catch (error) {
    logServerError("documents.download", error);

    return jsonError("Unable to prepare this download right now.", 500);
  }
}
