# Community Bank Digital

Community Bank Digital is a full-stack demo banking application built with Next.js and Supabase. It includes both a customer banking experience and an internal admin operations console covering accounts, cards, transfers, bill pay, cheque review, fraud workflows, support queues, documents, statements, and location lookup.

## Highlights

- Customer banking flows for accounts, transfers, bill payments, cards, loans, budgeting, alerts, documents, statements, support, and cheque deposit.
- Admin operations surfaces for customer management, fraud review, cheque processing, support triage, and dashboard reporting.
- Supabase-backed auth, data access, storage downloads, and audit logging.
- Seeded demo data for customer and admin journeys.
- Automatic starter-account provisioning for customers with no linked accounts so account-dependent flows can still run.

## Tech Stack

- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- Supabase Auth, Database, and Storage
- Recharts
- React Hook Form + Zod

## Project Structure

```text
app/           Next.js routes, pages, and API handlers
components/    UI components and feature modules
lib/           Auth, Supabase, validation, and server helpers
supabase/      Schema, RLS, seed migrations, and full setup SQL
scripts/       Smoke test automation
types/         Shared TypeScript types
utils/         Formatting, audit, masking, and helper utilities
```

## Features

### Customer experience

- Authentication and profile bootstrap
- Account overview and transaction history
- Internal transfers and beneficiary transfers
- Bill pay and scheduled payment management
- Card controls and transaction review
- Loan overview and repayments
- Budgeting charts and category summaries
- Alerts and preferences
- Statement and document downloads
- Support ticket submission and tracking
- Cheque deposit workflow
- ATM and branch locator

### Admin experience

- Customer directory and detailed customer profile view
- Fraud queue and investigation detail screens
- Cheque review queue
- Support queue and ticket detail screens
- Operations dashboard with summary metrics and charts

## Environment Variables

Create a local `.env.local` file from `.env.local.example`.

Required variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_NAME=Community Bank Digital
NEXT_PUBLIC_BANK_NAME=Community Bank
```

Do not commit real service-role credentials.

## Local Setup

### Prerequisites

- Node.js 20+
- npm
- A Supabase project

### Install dependencies

```bash
npm install
```

### Configure Supabase

1. Copy `.env.local.example` to `.env.local`.
2. Fill in your Supabase project URL, anon key, and service-role key.
3. Create these auth users in Supabase Auth before applying the main demo seed:

```text
customer@demo.com / Demo1234!
staff@demo.com    / Demo1234!
admin@demo.com    / Demo1234!
```

### Apply database setup

Run the SQL files in this order:

```text
supabase/migrations/001_schema.sql
supabase/migrations/002_rls.sql
supabase/migrations/003_seed.sql
supabase/migrations/004_extended_feature_rls.sql
supabase/migrations/005_admin_console_demo_data.sql
supabase/migrations/006_customer_relationship_demo_data.sql
supabase/migrations/007_full_module_demo_data.sql
```

The repository also includes `supabase/full-setup.sql` if you prefer a single SQL file for a full local reset/setup workflow.

### Run the app

Development:

```bash
npm run dev -- --port 3100
```

Production build:

```bash
npm run build
npm run start -- --port 3100
```

## Demo Accounts

After the auth users and migrations are in place, you can sign in as:

- Customer: `customer@demo.com` / `Demo1234!`
- Staff: `staff@demo.com` / `Demo1234!`
- Admin: `admin@demo.com` / `Demo1234!`

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run type-check
npm run smoke:e2e
```

## Smoke Testing

The smoke test script exercises major customer and admin flows against the configured Supabase backend.

```bash
npm run smoke:e2e
```

Notes:

- Start the app first, for example on port `3100`.
- The smoke suite provisions its own temporary smoke users.
- Features backed by missing tables are reported as skipped instead of failing hard.

## Notes

- Sign-in currently uses email and password only.
- Some routes such as `messages`, `reports`, `transactions`, and `kyc` currently redirect into the active support or dashboard surfaces instead of maintaining separate feature implementations.
- New or recovered customer profiles with no existing accounts are auto-provisioned with starter `current`, `savings`, and `isa` accounts so downstream banking modules remain usable.
