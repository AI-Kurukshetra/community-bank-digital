import { NextResponse } from "next/server";

import {
  getRequestIp,
  getSignedUrl,
  jsonError,
  logServerError,
  requireRouteSession
} from "@/lib/route-helpers";
import type { Account, Statement } from "@/types";
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
  const { data: statementData } = await admin
    .from("statements")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  const statement = (statementData ?? null) as Statement | null;

  if (!statement) {
    return jsonError("Not found.", 404);
  }

  const { data: accountData } = await admin
    .from("accounts")
    .select("*")
    .eq("id", statement.account_id)
    .maybeSingle();

  const account = (accountData ?? null) as Account | null;

  if (!account || account.user_id !== user.id) {
    return jsonError("Forbidden", 403);
  }

  if (!statement.storage_path) {
    return jsonError("Statement unavailable.", 404);
  }

  try {
    const url = await getSignedUrl("statements", statement.storage_path);

    await writeAuditLog(admin, {
      action: "statement_downloaded",
      actor_id: user.id,
      entity_id: statement.id,
      entity_type: "statements",
      ip_address: ipAddress
    });

    return NextResponse.json({ url });
  } catch (error) {
    logServerError("statements.download", error);

    return jsonError("Unable to prepare this download right now.", 500);
  }
}
