# Local development

Apply the Supabase migrations in order before testing the full app surface:

- `supabase/migrations/001_schema.sql`
- `supabase/migrations/002_rls.sql`
- `supabase/migrations/003_seed.sql`
- `supabase/migrations/004_extended_feature_rls.sql`
- `supabase/migrations/005_admin_console_demo_data.sql`
- `supabase/migrations/006_customer_relationship_demo_data.sql`
- `supabase/migrations/007_full_module_demo_data.sql`

`supabase/migrations/003_seed.sql` expects these auth users to exist first:

- Customer: `customer@demo.com` / `Demo1234!`
- Staff: `staff@demo.com` / `Demo1234!`
- Admin: `admin@demo.com` / `Demo1234!`

Authentication notes:

- Sign in uses email and password only.
- The seeded operational data for admin queues and customer detail views comes
  from the demo migrations above.

Smoke test:

- Start the app locally, for example `npm run dev -- --port 3100`
- Run `npm run smoke:e2e`

The smoke suite provisions its own `smoke.admin@communitybank.local` and
`smoke.customer@communitybank.local` accounts. Feature checks that depend on
missing backend tables are reported as skips until the full schema has been
applied to the target Supabase project.
