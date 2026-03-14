import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import {
  getRequestIp,
  jsonError,
  logServerError,
  requireRouteSession
} from "@/lib/route-helpers";
import type { Account } from "@/types";
import { writeAuditLog } from "@/utils/audit";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_AMOUNT_PENCE = 500_000;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

function getExtension(type: string) {
  return type === "image/png" ? "png" : "jpg";
}

export async function POST(request: Request) {
  const sessionContext = await requireRouteSession();

  if ("response" in sessionContext) {
    return sessionContext.response;
  }

  const { admin, user } = sessionContext;
  const formData = await request.formData();
  const file = formData.get("image");
  const accountId = `${formData.get("account_id") ?? ""}`;
  const amountPence = Number(formData.get("amount_pence"));
  const ipAddress = getRequestIp(request);

  if (!(file instanceof File)) {
    return jsonError("Cheque image is required.", 400);
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return jsonError("Only JPEG and PNG images are accepted.", 400);
  }

  if (file.size > MAX_FILE_SIZE) {
    return jsonError("File size must be under 10MB.", 400);
  }

  if (!Number.isInteger(amountPence) || amountPence <= 0 || amountPence > MAX_AMOUNT_PENCE) {
    return jsonError("Enter an amount up to GBP 5,000.", 400);
  }

  const { data: accountData } = await admin
    .from("accounts")
    .select("*")
    .eq("id", accountId)
    .maybeSingle();

  const account = (accountData ?? null) as Account | null;

  if (!account || account.user_id !== user.id) {
    return jsonError("Forbidden", 403);
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const { count } = await admin
    .from("check_images")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", startOfDay.toISOString())
    .lt("created_at", endOfDay.toISOString());

  if ((count ?? 0) >= 5) {
    return jsonError("Daily cheque deposit limit reached.", 400);
  }

  const storagePath = `cheques/${user.id}/${randomUUID()}.${getExtension(file.type)}`;

  try {
    const { error: uploadError } = await admin.storage
      .from("cheques")
      .upload(storagePath, await file.arrayBuffer(), {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: checkImage, error: insertError } = await admin
      .from("check_images")
      .insert({
        account_id: account.id,
        amount_pence: amountPence,
        status: "pending",
        storage_path: storagePath,
        user_id: user.id
      })
      .select("id")
      .single();

    if (insertError || !checkImage) {
      throw insertError ?? new Error("check_image_insert_failed");
    }

    await writeAuditLog(admin, {
      action: "cheque_submitted",
      actor_id: user.id,
      entity_id: checkImage.id as string,
      entity_type: "check_images",
      ip_address: ipAddress,
      metadata: {
        account_id: account.id,
        amount_pence: amountPence
      }
    });

    return NextResponse.json({
      reference: (checkImage.id as string).slice(-8)
    });
  } catch (error) {
    await admin.storage.from("cheques").remove([storagePath]).catch(() => null);
    logServerError("cheque.post", error);

    return jsonError("Unable to submit this cheque right now.", 500);
  }
}
