import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const { stringifySupabaseSession } = require("@supabase/auth-helpers-shared");

const COOKIE_CHUNK_SIZE = 3180;

function loadEnvFile(filePath) {
  const contents = readFileSync(filePath, "utf8");
  const values = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

const env = {
  ...loadEnvFile(".env.local"),
  ...process.env
};

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const baseUrl = env.E2E_BASE_URL || "http://127.0.0.1:3100";

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase environment variables.");
}

const authCookieKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;

function logStep(message) {
  console.log(`\n[smoke] ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createCookieChunks(key, value) {
  if (value.length <= COOKIE_CHUNK_SIZE) {
    return [{ name: key, value }];
  }

  const chunks = [];

  for (let index = 0; index < value.length; index += COOKIE_CHUNK_SIZE) {
    chunks.push({
      name: `${key}.${chunks.length}`,
      value: value.slice(index, index + COOKIE_CHUNK_SIZE)
    });
  }

  return chunks;
}

function buildSessionCookie(session) {
  const serializedSession = stringifySupabaseSession(session);

  return createCookieChunks(authCookieKey, serializedSession)
    .map(
      ({ name, value }) => `${name}=${encodeURIComponent(value)}`
    )
    .join("; ");
}

async function request(pathname, { body, cookie, headers, method = "GET" } = {}) {
  const response = await fetch(new URL(pathname, baseUrl), {
    body:
      body === undefined || body instanceof FormData
        ? body
        : JSON.stringify(body),
    headers: {
      ...(body !== undefined && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers
    },
    method,
    redirect: "manual"
  });

  return response;
}

async function expectStatus(label, response, expectedStatus) {
  if (response.status !== expectedStatus) {
    const body = await response.text();

    throw new Error(
      `${label} returned ${response.status} instead of ${expectedStatus}.\n${body}`
    );
  }
}

async function expectRedirect(label, response, expectedPathname) {
  const actualLocation = response.headers.get("location");

  if (![301, 302, 303, 307, 308].includes(response.status) || !actualLocation) {
    const body = await response.text();

    throw new Error(
      `${label} did not redirect as expected.\nStatus: ${response.status}\n${body}`
    );
  }

  const actualPathname = new URL(actualLocation, baseUrl).pathname;

  if (actualPathname !== expectedPathname) {
    throw new Error(
      `${label} redirected to ${actualPathname} instead of ${expectedPathname}.`
    );
  }
}

async function expectBodyContains(label, response, expectedText) {
  const body = await response.text();

  if (!body.includes(expectedText)) {
    throw new Error(`${label} did not include expected text: ${expectedText}`);
  }
}

function createBrowserTestClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: true
    }
  });
}

function createAdminClient() {
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function inspectSchemaAvailability(adminClient, tables) {
  const results = {};

  for (const table of tables) {
    const { error } = await adminClient.from(table).select("*").limit(1);
    results[table] = !error;
  }

  return results;
}

function logSkip(message) {
  console.log(`[smoke] skipped: ${message}`);
}

async function findAuthUserByEmail(adminClient, email) {
  const normalizedEmail = email.toLowerCase();
  let page = 1;

  while (page <= 10) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 200
    });

    if (error) {
      throw error;
    }

    const match = (data?.users ?? []).find(
      (user) => user.email?.toLowerCase() === normalizedEmail
    );

    if (match) {
      return match;
    }

    if ((data?.users ?? []).length < 200) {
      break;
    }

    page += 1;
  }

  return null;
}

async function ensureAuthUser(adminClient, { email, fullName, password }) {
  const existingUser = await findAuthUserByEmail(adminClient, email);

  if (!existingUser) {
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      password,
      user_metadata: {
        full_name: fullName
      }
    });

    if (error || !data.user) {
      throw error ?? new Error(`Unable to create auth user ${email}`);
    }

    return data.user;
  }

  const { data, error } = await adminClient.auth.admin.updateUserById(
    existingUser.id,
    {
      email,
      email_confirm: true,
      password,
      user_metadata: {
        ...(existingUser.user_metadata ?? {}),
        full_name: fullName
      }
    }
  );

  if (error || !data.user) {
    throw error ?? new Error(`Unable to update auth user ${email}`);
  }

  return data.user;
}

async function ensureProfile(adminClient, profile) {
  const { error } = await adminClient.from("profiles").upsert(profile);

  if (error) {
    throw error;
  }
}

async function generateUniqueAccountNumber(adminClient) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = `${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
    const { data, error } = await adminClient
      .from("accounts")
      .select("id")
      .eq("account_number", candidate)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return candidate;
    }
  }

  throw new Error("Unable to generate a unique account number.");
}

async function ensureCustomerAccounts(adminClient, userId) {
  const { data: existingAccounts, error: accountsError } = await adminClient
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (accountsError) {
    throw accountsError;
  }

  const accounts = existingAccounts ?? [];
  const requiredAccounts = [
    {
      balance_pence: 250_000,
      sort_code: "10-00-11",
      type: "current"
    },
    {
      balance_pence: 175_000,
      sort_code: "10-00-22",
      type: "savings"
    }
  ];

  if (accounts.length >= requiredAccounts.length) {
    return;
  }

  const missingAccounts = [];

  for (const account of requiredAccounts.slice(accounts.length)) {
    missingAccounts.push({
      ...account,
      account_number: await generateUniqueAccountNumber(adminClient),
      user_id: userId
    });
  }

  const { data: insertedAccounts, error: insertAccountsError } = await adminClient
    .from("accounts")
    .insert(missingAccounts)
    .select("id, balance_pence, type");

  if (insertAccountsError) {
    throw insertAccountsError;
  }

  const openingTransactions = (insertedAccounts ?? []).map((account) => ({
    account_id: account.id,
    amount_pence: account.balance_pence,
    category: "income",
    description: `Opening ${account.type} balance`,
    direction: "credit",
    reference: "SMOKE-OPEN"
  }));

  if (openingTransactions.length > 0) {
    const { error: transactionsError } = await adminClient
      .from("transactions")
      .insert(openingTransactions);

    if (transactionsError) {
      throw transactionsError;
    }
  }
}

async function ensureFixture(adminClient, { email, fullName, password, role }) {
  const authUser = await ensureAuthUser(adminClient, {
    email,
    fullName,
    password
  });

  await ensureProfile(adminClient, {
    full_name: fullName,
    id: authUser.id,
    phone: null,
    role,
    status: "active"
  });

  if (role === "customer") {
    await ensureCustomerAccounts(adminClient, authUser.id);
  }

  return authUser;
}

async function signInWithPassword(client, email, password) {
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password
  });

  if (error || !data.session) {
    throw error ?? new Error(`Unable to sign in as ${email}`);
  }

  return data.session;
}

async function completePasswordLoginFlow({
  email,
  expectedHomePath,
  protectedPath,
  password
}) {
  const client = createBrowserTestClient();
  const session = await signInWithPassword(client, email, password);
  const authCookie = buildSessionCookie(session);

  return {
    client,
    authCookie,
    expectedHomePath,
    protectedPath
  };
}

async function loadProfile(adminClient, userId) {
  const { data, error } = await adminClient
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    throw error ?? new Error(`Profile not found for ${userId}`);
  }

  return data;
}

async function smokePublicRoutes() {
  logStep("Checking public routes");

  await expectStatus("GET /", await request("/"), 200);
  await expectStatus("GET /login", await request("/login"), 200);
  await expectBodyContains("GET /login", await request("/login"), "Sign in");
  await expectRedirect(
    "GET /dashboard without auth",
    await request("/dashboard"),
    "/login"
  );
}

async function smokeCustomerFlow(adminClient, schema) {
  logStep("Checking customer auth, pages, and APIs");

  const email = "smoke.customer@communitybank.local";
  const password = "Password123!";
  const authUser = await ensureFixture(adminClient, {
    email,
    fullName: "Smoke Customer",
    password,
    role: "customer"
  });

  const signedIn = await completePasswordLoginFlow({
    email,
    expectedHomePath: "/dashboard",
    password,
    protectedPath: "/dashboard"
  });
  const customerCookie = signedIn.authCookie;
  const profile = await loadProfile(adminClient, authUser.id);

  await expectStatus(
    "customer GET /dashboard after auth",
    await request(signedIn.protectedPath, { cookie: customerCookie }),
    200
  );
  await expectRedirect(
    "customer GET /setup-mfa after auth",
    await request("/setup-mfa", { cookie: customerCookie }),
    signedIn.expectedHomePath
  );
  await expectRedirect(
    "customer GET /verify-mfa after auth",
    await request("/verify-mfa", { cookie: customerCookie }),
    signedIn.expectedHomePath
  );

  await expectRedirect(
    "customer GET /login after auth",
    await request("/login", { cookie: customerCookie }),
    "/dashboard"
  );

  const customerPages = [
    ["/dashboard", "Transfer Money"],
    ["/accounts", null],
    ["/transfers", null],
    ["/payments/bill-pay", null],
    ["/profile", null]
  ];

  if (schema.loans) {
    customerPages.push(["/loans", null]);
  } else {
    logSkip("/loans page because public.loans is not deployed");
  }

  if (schema.statements) {
    customerPages.push(["/statements", null]);
  } else {
    logSkip("/statements page because public.statements is not deployed");
  }

  if (schema.documents) {
    customerPages.push(["/documents", null]);
  } else {
    logSkip("/documents page because public.documents is not deployed");
  }

  if (schema.alert_configs) {
    customerPages.push(["/alerts", null]);
  } else {
    logSkip("/alerts page because public.alert_configs is not deployed");
  }

  if (schema.check_images) {
    customerPages.push(["/cheque-deposit", null]);
  } else {
    logSkip("/cheque-deposit page because public.check_images is not deployed");
  }

  if (schema.support_tickets) {
    customerPages.push(["/support", null]);
  } else {
    logSkip("/support page because public.support_tickets is not deployed");
  }

  if (schema.branches && schema.atms) {
    customerPages.push(["/locate", null]);
  } else {
    logSkip("/locate page because public.branches/public.atms are not deployed");
  }

  for (const [path, expectedText] of customerPages) {
    const response = await request(path, { cookie: customerCookie });
    await expectStatus(`customer page ${path}`, response, 200);

    if (expectedText) {
      await expectBodyContains(`customer page ${path}`, response, expectedText);
    }
  }

  const profileUpdateResponse = await request("/api/v1/profile", {
    body: {
      full_name: profile.full_name,
      phone: profile.phone ?? ""
    },
    cookie: customerCookie,
    method: "PATCH"
  });
  await expectStatus("customer PATCH /api/v1/profile", profileUpdateResponse, 200);

  if (schema.alert_configs) {
    const alertsResponse = await request("/api/v1/alerts", {
      body: [
        {
          days_before: null,
          is_active: true,
          threshold_pence: 2500,
          type: "low_balance"
        },
        {
          days_before: 3,
          is_active: true,
          threshold_pence: 5000,
          type: "bill_due"
        }
      ],
      cookie: customerCookie,
      method: "PATCH"
    });
    await expectStatus("customer PATCH /api/v1/alerts", alertsResponse, 200);
  } else {
    logSkip("/api/v1/alerts because public.alert_configs is not deployed");
  }

  const { data: accounts, error: accountsError } = await adminClient
    .from("accounts")
    .select("id")
    .eq("user_id", authUser.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (accountsError) {
    throw accountsError;
  }

  if ((accounts ?? []).length >= 2) {
    const [fromAccount, toAccount] = accounts;

    const outboundTransfer = await request("/api/v1/transfers", {
      body: {
        amount_pence: 1,
        from_account_id: fromAccount.id,
        to_account_id: toAccount.id
      },
      cookie: customerCookie,
      method: "POST"
    });
    await expectStatus("customer POST /api/v1/transfers outbound", outboundTransfer, 200);

    const inboundTransfer = await request("/api/v1/transfers", {
      body: {
        amount_pence: 1,
        from_account_id: toAccount.id,
        to_account_id: fromAccount.id
      },
      cookie: customerCookie,
      method: "POST"
    });
    await expectStatus("customer POST /api/v1/transfers return", inboundTransfer, 200);
  } else {
    console.log("[smoke] customer transfer test skipped: fewer than two active accounts");
  }

  let supportTicketId = null;

  if (schema.support_tickets) {
    const supportResponse = await request("/api/v1/support", {
      body: {
        body: "My cheque deposit has been pending for several days and I need a status update before month end.",
        category: "Payments",
        related_account_id: accounts?.[0]?.id ?? null,
        subject: "Smoke support request"
      },
      cookie: customerCookie,
      method: "POST"
    });
    await expectStatus("customer POST /api/v1/support", supportResponse, 200);

    const supportJson = await supportResponse.json();
    supportTicketId = supportJson.ticket_id;
    assert(supportTicketId, "Expected support ticket id from /api/v1/support.");

    const { data: supportTicket, error: supportTicketError } = await adminClient
      .from("support_tickets")
      .select("id, subject, status")
      .eq("id", supportTicketId)
      .maybeSingle();

    if (supportTicketError || !supportTicket) {
      throw supportTicketError ?? new Error("Support ticket not found after creation.");
    }

    assert(
      supportTicket.subject === "Smoke support request",
      "Expected created support ticket subject."
    );
    assert(supportTicket.status === "open", "Expected new support ticket to be open.");
  } else {
    logSkip("/api/v1/support because public.support_tickets is not deployed");
  }

  return {
    accountIds: (accounts ?? []).map((account) => account.id),
    customerId: authUser.id,
    supportTicketId
  };
}

async function smokeAdminFlow(adminClient, schema, customerContext) {
  logStep("Checking admin auth, pages, and APIs");

  const email = "smoke.admin@communitybank.local";
  const password = "Password123!";
  const authUser = await ensureFixture(adminClient, {
    email,
    fullName: "Smoke Admin",
    password,
    role: "admin"
  });

  const signedIn = await completePasswordLoginFlow({
    email,
    expectedHomePath: "/admin/dashboard",
    password,
    protectedPath: "/admin/dashboard"
  });
  const adminCookie = signedIn.authCookie;

  await expectStatus(
    "admin GET /admin/dashboard after auth",
    await request(signedIn.protectedPath, { cookie: adminCookie }),
    200
  );
  await expectRedirect(
    "admin GET /setup-mfa after auth",
    await request("/setup-mfa", { cookie: adminCookie }),
    signedIn.expectedHomePath
  );
  await expectRedirect(
    "admin GET /verify-mfa after auth",
    await request("/verify-mfa", { cookie: adminCookie }),
    signedIn.expectedHomePath
  );

  await expectRedirect(
    "admin GET /login after auth",
    await request("/login", { cookie: adminCookie }),
    "/admin/dashboard"
  );

  const adminPages = [
    ["/admin/dashboard", "Recent customers"],
    ["/admin/customers", null],
    ["/admin/fraud", null]
  ];

  if (schema.support_tickets) {
    adminPages.push(["/admin/support", null]);
  } else {
    logSkip("/admin/support because public.support_tickets is not deployed");
  }

  if (schema.check_images) {
    adminPages.push(["/admin/cheques", null]);
  } else {
    logSkip("/admin/cheques because public.check_images is not deployed");
  }

  for (const [path, expectedText] of adminPages) {
    const response = await request(path, { cookie: adminCookie });
    await expectStatus(`admin page ${path}`, response, 200);

    if (expectedText) {
      await expectBodyContains(`admin page ${path}`, response, expectedText);
    }
  }

  const uniqueSuffix = Date.now();
  const createdCustomerResponse = await request("/api/v1/admin/customers", {
    body: {
      email: `smoke-${uniqueSuffix}@communitybank.local`,
      full_name: `Smoke Test ${uniqueSuffix}`,
      password: "Password123!",
      phone: "0123456789",
      status: "active"
    },
    cookie: adminCookie,
    method: "POST"
  });
  await expectStatus(
    "admin POST /api/v1/admin/customers",
    createdCustomerResponse,
    200
  );

  const createdCustomerJson = await createdCustomerResponse.json();
  assert(createdCustomerJson.id, "Expected created customer id.");

  const customerDetailResponse = await request(
    `/admin/customers/${createdCustomerJson.id}`,
    {
      cookie: adminCookie
    }
  );
  await expectStatus(
    "admin GET /admin/customers/[id]",
    customerDetailResponse,
    200
  );

  const updatedCustomerResponse = await request(
    `/api/v1/admin/customers/${createdCustomerJson.id}`,
    {
      body: {
        full_name: `Smoke Test Updated ${uniqueSuffix}`,
        status: "suspended"
      },
      cookie: adminCookie,
      method: "PATCH"
    }
  );
  await expectStatus(
    "admin PATCH /api/v1/admin/customers/[id]",
    updatedCustomerResponse,
    200
  );

  const deletedCustomerResponse = await request(
    `/api/v1/admin/customers/${createdCustomerJson.id}`,
    {
      cookie: adminCookie,
      method: "DELETE"
    }
  );
  await expectStatus(
    "admin DELETE /api/v1/admin/customers/[id]",
    deletedCustomerResponse,
    200
  );

  if (schema.support_tickets && customerContext.supportTicketId) {
    await expectStatus(
      "admin GET /admin/support/[id]",
      await request(`/admin/support/${customerContext.supportTicketId}`, {
        cookie: adminCookie
      }),
      200
    );
  }

  if (schema.check_images && customerContext.accountIds.length > 0) {
    const chequeId = randomUUID();
    const { error: chequeInsertError } = await adminClient.from("check_images").insert({
      account_id: customerContext.accountIds[0],
      amount_pence: 12345,
      id: chequeId,
      status: "pending",
      storage_path: `smoke/${chequeId}.jpg`,
      user_id: customerContext.customerId
    });

    if (chequeInsertError) {
      throw chequeInsertError;
    }

    const chequeReviewResponse = await request(`/api/v1/cheque/${chequeId}`, {
      body: {
        action: "reject",
        reason: "Smoke review rejection reason."
      },
      cookie: adminCookie,
      method: "PATCH"
    });
    await expectStatus(
      "admin PATCH /api/v1/cheque/[id]",
      chequeReviewResponse,
      200
    );

    const { data: reviewedCheque, error: reviewedChequeError } = await adminClient
      .from("check_images")
      .select("status, rejection_reason")
      .eq("id", chequeId)
      .maybeSingle();

    if (reviewedChequeError || !reviewedCheque) {
      throw reviewedChequeError ?? new Error("Cheque review did not persist.");
    }

    assert(
      reviewedCheque.status === "rejected",
      "Expected cheque review to persist rejected status."
    );
  }

  const fraudEventId = randomUUID();
  const { error: fraudInsertError } = await adminClient.from("fraud_events").insert({
    id: fraudEventId,
    status: "flagged",
    trigger_reason: "Smoke fraud review",
    user_id: customerContext.customerId
  });

  if (fraudInsertError) {
    throw fraudInsertError;
  }

  const fraudReviewResponse = await request(`/api/v1/fraud/${fraudEventId}`, {
    body: {
      action: schema.support_tickets ? "confirm" : "dismiss"
    },
    cookie: adminCookie,
    method: "PATCH"
  });
  await expectStatus("admin PATCH /api/v1/fraud/[id]", fraudReviewResponse, 200);

  const fraudReviewJson = await fraudReviewResponse.json();
  assert(fraudReviewJson.success === true, "Expected fraud review success.");

  const { data: reviewedFraudEvent, error: reviewedFraudError } = await adminClient
    .from("fraud_events")
    .select("status")
    .eq("id", fraudEventId)
    .maybeSingle();

  if (reviewedFraudError || !reviewedFraudEvent) {
    throw reviewedFraudError ?? new Error("Fraud review did not persist.");
  }

  assert(
    reviewedFraudEvent.status === (schema.support_tickets ? "confirmed" : "dismissed"),
    "Expected fraud review to persist final status."
  );
}

async function main() {
  const adminClient = createAdminClient();
  const schema = await inspectSchemaAvailability(adminClient, [
    "loans",
    "documents",
    "statements",
    "support_tickets",
    "alert_configs",
    "check_images",
    "branches",
    "atms"
  ]);

  await smokePublicRoutes();
  const customerContext = await smokeCustomerFlow(adminClient, schema);
  await smokeAdminFlow(adminClient, schema, customerContext);

  logStep("Smoke suite completed successfully");
}

main().catch((error) => {
  console.error("\n[smoke] Failure");
  console.error(error);
  process.exitCode = 1;
});
