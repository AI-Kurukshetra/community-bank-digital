import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type StarterAccountTemplate = {
  balance_pence: number;
  is_active: boolean;
  sort_code: string;
  type: "current" | "savings" | "isa";
};

const STARTER_ACCOUNT_TEMPLATES: StarterAccountTemplate[] = [
  {
    balance_pence: 285_000,
    is_active: true,
    sort_code: "20-45-67",
    type: "current"
  },
  {
    balance_pence: 750_000,
    is_active: true,
    sort_code: "20-45-67",
    type: "savings"
  },
  {
    balance_pence: 425_000,
    is_active: true,
    sort_code: "20-45-67",
    type: "isa"
  }
];

function toStarterAccountKey(account: StarterAccountTemplate) {
  return [
    account.type,
    account.sort_code,
    account.balance_pence,
    account.is_active
  ].join(":");
}

export function hasOnlyStarterCustomerAccounts(
  accounts: StarterAccountTemplate[]
) {
  if (accounts.length !== STARTER_ACCOUNT_TEMPLATES.length) {
    return false;
  }

  const expectedAccounts = STARTER_ACCOUNT_TEMPLATES
    .map(toStarterAccountKey)
    .sort();
  const actualAccounts = accounts.map(toStarterAccountKey).sort();

  return actualAccounts.every(
    (accountKey, index) => accountKey === expectedAccounts[index]
  );
}

function isUniqueViolation(error: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? "";

  return error?.code === "23505" || message.includes("duplicate");
}

function toEightDigitNumber(seed: string) {
  const digest = createHash("sha256").update(seed).digest();
  let numericValue = 0;

  for (let index = 0; index < 8; index += 1) {
    numericValue = (numericValue * 256 + (digest[index] ?? 0)) % 90_000_000;
  }

  return String(10_000_000 + numericValue).padStart(8, "0");
}

async function countCustomerAccounts(admin: SupabaseClient, userId: string) {
  const { count, error } = await admin
    .from("accounts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function findAvailableAccountNumber(
  admin: SupabaseClient,
  userId: string,
  slot: number,
  attempt: number
) {
  for (let salt = 0; salt < 25; salt += 1) {
    const accountNumber = toEightDigitNumber(
      `${userId}:starter-account:${slot}:${attempt}:${salt}`
    );
    const { data, error } = await admin
      .from("accounts")
      .select("id")
      .eq("account_number", accountNumber)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return accountNumber;
    }
  }

  throw new Error("starter_account_number_unavailable");
}

export async function ensureStarterCustomerAccounts(
  admin: SupabaseClient,
  userId: string
) {
  const existingAccountCount = await countCustomerAccounts(admin, userId);

  if (existingAccountCount > 0) {
    return {
      created: false
    };
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const starterAccounts = await Promise.all(
      STARTER_ACCOUNT_TEMPLATES.map(async (template, index) => ({
        ...template,
        account_number: await findAvailableAccountNumber(
          admin,
          userId,
          index,
          attempt
        ),
        id: randomUUID(),
        user_id: userId
      }))
    );

    const { error } = await admin.from("accounts").insert(starterAccounts);

    if (!error) {
      return {
        created: true
      };
    }

    const retryCount = await countCustomerAccounts(admin, userId);

    if (retryCount > 0) {
      return {
        created: false
      };
    }

    if (!isUniqueViolation(error)) {
      throw error;
    }
  }

  throw new Error("starter_accounts_insert_failed");
}
