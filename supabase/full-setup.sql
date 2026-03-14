create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid references auth.users(id) primary key,
  full_name text not null,
  role text not null default 'customer'
    check (role in ('customer', 'staff', 'admin')),
  phone text,
  status text not null default 'active',
  created_at timestamptz default now()
);

create table if not exists public.accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  type text not null check (type in ('current', 'savings', 'isa')),
  account_number text unique not null,
  sort_code text not null,
  balance_pence integer not null default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.transactions (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references public.accounts(id) not null,
  amount_pence integer not null,
  direction text not null check (direction in ('debit', 'credit')),
  description text,
  merchant text,
  category text default 'other',
  reference text,
  created_at timestamptz default now()
);

create table if not exists public.cards (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references public.accounts(id) not null,
  user_id uuid references public.profiles(id) not null,
  masked_number text not null,
  card_type text default 'debit',
  status text default 'active'
    check (status in ('active', 'frozen', 'cancelled')),
  daily_limit_pence integer default 50000,
  expires_at date,
  created_at timestamptz default now()
);

create table if not exists public.beneficiaries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  name text not null,
  account_number text not null,
  sort_code text not null,
  bank_name text,
  created_at timestamptz default now()
);

create table if not exists public.bill_payments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  payee_name text not null,
  reference text,
  amount_pence integer not null,
  frequency text default 'one_off'
    check (frequency in ('one_off', 'weekly', 'monthly')),
  next_payment_date date,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.loans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  account_id uuid references public.accounts(id),
  loan_type text default 'personal'
    check (loan_type in ('personal', 'mortgage', 'auto', 'business')),
  principal_pence integer not null,
  balance_pence integer not null,
  rate_bps integer not null,
  monthly_payment_pence integer not null,
  next_payment_date date,
  start_date date,
  end_date date,
  status text default 'active'
    check (status in ('active', 'paid_off', 'defaulted')),
  created_at timestamptz default now()
);

create table if not exists public.statements (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references public.accounts(id) not null,
  period_start date not null,
  period_end date not null,
  storage_path text,
  created_at timestamptz default now()
);

create table if not exists public.documents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  type text not null
    check (type in ('tax', 'loan', 'letter', 'other')),
  filename text not null,
  storage_path text not null,
  created_at timestamptz default now()
);

create table if not exists public.support_tickets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  assigned_to uuid references public.profiles(id),
  subject text not null,
  body text not null,
  status text default 'open'
    check (status in ('open', 'in_progress', 'resolved')),
  priority text default 'medium'
    check (priority in ('low', 'medium', 'high')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.alert_configs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  type text not null check (type in (
    'low_balance',
    'large_transaction',
    'new_device_login',
    'card_used_abroad',
    'payment_due',
    'fraud_flagged'
  )),
  is_active boolean default true,
  threshold_pence integer,
  days_before integer,
  created_at timestamptz default now(),
  unique(user_id, type)
);

create table if not exists public.check_images (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  account_id uuid references public.accounts(id) not null,
  storage_path text not null,
  amount_pence integer,
  status text default 'pending'
    check (status in ('pending', 'processing', 'processed', 'rejected')),
  rejection_reason text,
  created_at timestamptz default now()
);

create table if not exists public.fraud_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  transaction_id uuid references public.transactions(id),
  trigger_reason text,
  status text default 'flagged'
    check (status in ('flagged', 'confirmed', 'dismissed')),
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table if not exists public.branches (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  address text not null,
  postcode text not null,
  lat double precision not null,
  lng double precision not null,
  phone text,
  opening_hours jsonb,
  created_at timestamptz default now()
);

create table if not exists public.atms (
  id uuid default gen_random_uuid() primary key,
  operator text not null,
  address text not null,
  postcode text not null,
  lat double precision not null,
  lng double precision not null,
  is_available boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  ip_address text,
  metadata jsonb,
  created_at timestamptz default now()
);

create or replace function public.is_staff_or_admin()
returns boolean as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('staff', 'admin')
  );
$$ language sql security definer;

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.cards enable row level security;
alter table public.beneficiaries enable row level security;
alter table public.bill_payments enable row level security;
alter table public.loans enable row level security;
alter table public.statements enable row level security;
alter table public.documents enable row level security;
alter table public.support_tickets enable row level security;
alter table public.alert_configs enable row level security;
alter table public.check_images enable row level security;
alter table public.fraud_events enable row level security;
alter table public.branches enable row level security;
alter table public.atms enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "accounts_select" on public.accounts;
drop policy if exists "transactions_select" on public.transactions;
drop policy if exists "cards_select" on public.cards;
drop policy if exists "cards_update_own" on public.cards;
drop policy if exists "beneficiaries_all" on public.beneficiaries;
drop policy if exists "bill_payments_all" on public.bill_payments;
drop policy if exists "loans_select" on public.loans;
drop policy if exists "statements_select" on public.statements;
drop policy if exists "documents_select" on public.documents;
drop policy if exists "tickets_all" on public.support_tickets;
drop policy if exists "alert_configs_all" on public.alert_configs;
drop policy if exists "check_images_all" on public.check_images;
drop policy if exists "fraud_select" on public.fraud_events;
drop policy if exists "fraud_staff_write" on public.fraud_events;
drop policy if exists "fraud_staff_update" on public.fraud_events;
drop policy if exists "branches_public" on public.branches;
drop policy if exists "atms_public" on public.atms;
drop policy if exists "audit_insert" on public.audit_logs;
drop policy if exists "audit_select_staff" on public.audit_logs;

create policy "profiles_select" on public.profiles for select
  using (auth.uid() = id or public.is_staff_or_admin());

create policy "profiles_update_own" on public.profiles for update
  using (auth.uid() = id);

create policy "accounts_select" on public.accounts for select
  using (auth.uid() = user_id or public.is_staff_or_admin());

create policy "transactions_select" on public.transactions for select
  using (
    account_id in (
      select id from public.accounts where user_id = auth.uid()
    )
    or public.is_staff_or_admin()
  );

create policy "cards_select" on public.cards for select
  using (auth.uid() = user_id or public.is_staff_or_admin());

create policy "cards_update_own" on public.cards for update
  using (auth.uid() = user_id);

create policy "beneficiaries_all" on public.beneficiaries for all
  using (auth.uid() = user_id);

create policy "bill_payments_all" on public.bill_payments for all
  using (auth.uid() = user_id);

create policy "loans_select" on public.loans for select
  using (auth.uid() = user_id or public.is_staff_or_admin());

create policy "statements_select" on public.statements for select
  using (
    account_id in (
      select id from public.accounts where user_id = auth.uid()
    )
    or public.is_staff_or_admin()
  );

create policy "documents_select" on public.documents for select
  using (auth.uid() = user_id or public.is_staff_or_admin());

create policy "tickets_all" on public.support_tickets for all
  using (auth.uid() = user_id or public.is_staff_or_admin());

create policy "alert_configs_all" on public.alert_configs for all
  using (auth.uid() = user_id);

create policy "check_images_all" on public.check_images for all
  using (auth.uid() = user_id or public.is_staff_or_admin());

create policy "fraud_select" on public.fraud_events for select
  using (auth.uid() = user_id or public.is_staff_or_admin());

create policy "fraud_staff_write" on public.fraud_events for insert
  with check (public.is_staff_or_admin());

create policy "fraud_staff_update" on public.fraud_events for update
  using (public.is_staff_or_admin());

create policy "branches_public" on public.branches for select
  using (true);

create policy "atms_public" on public.atms for select
  using (true);

create policy "audit_insert" on public.audit_logs for insert
  with check (auth.uid() is not null);

create policy "audit_select_staff" on public.audit_logs for select
  using (public.is_staff_or_admin());

-- Seed rows use the three demo auth users created in Supabase Auth.
create temporary table if not exists seed_user_ids (
  customer_user_id uuid not null,
  staff_user_id uuid not null,
  admin_user_id uuid not null
);

truncate table seed_user_ids;

-- This insert fails fast if any of the three demo auth users do not exist.
insert into seed_user_ids (
  customer_user_id,
  staff_user_id,
  admin_user_id
)
select
  max(case when email = 'customer@demo.com' then id end),
  max(case when email = 'staff@demo.com' then id end),
  max(case when email = 'admin@demo.com' then id end)
from auth.users
where email in ('customer@demo.com', 'staff@demo.com', 'admin@demo.com');

  insert into public.profiles (id, full_name, role) values
    ((select customer_user_id from seed_user_ids), 'Alex Johnson', 'customer'),
    ((select staff_user_id from seed_user_ids), 'Sarah Williams', 'staff'),
    ((select admin_user_id from seed_user_ids), 'James Admin', 'admin')
  on conflict (id) do nothing;

  insert into public.accounts (
    id,
    user_id,
    type,
    account_number,
    sort_code,
    balance_pence
  ) values
    ('10000000-0000-0000-0000-000000000001', (select customer_user_id from seed_user_ids), 'current', '12345678', '20-45-67', 342567),
    ('10000000-0000-0000-0000-000000000002', (select customer_user_id from seed_user_ids), 'savings', '87654321', '20-45-67', 1250000)
  on conflict (account_number) do nothing;

  insert into public.cards (
    id,
    account_id,
    user_id,
    masked_number,
    status,
    daily_limit_pence,
    expires_at
  ) values
    ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', (select customer_user_id from seed_user_ids), '4111 **** **** 1234', 'active', 50000, '2028-03-31')
  on conflict do nothing;

  insert into public.beneficiaries (
    user_id,
    name,
    account_number,
    sort_code,
    bank_name
  ) values
    ((select customer_user_id from seed_user_ids), 'James Smith', '87654321', '20-45-67', 'Barclays'),
    ((select customer_user_id from seed_user_ids), 'BT Internet', '31926819', '60-00-01', 'HSBC');

  insert into public.bill_payments (
    user_id,
    payee_name,
    amount_pence,
    frequency,
    next_payment_date,
    is_active
  ) values
    (
      (select customer_user_id from seed_user_ids),
      'British Gas',
      8500,
      'monthly',
      date_trunc('month', now()) + interval '1 month',
      true
    );

  insert into public.loans (
    id,
    user_id,
    loan_type,
    principal_pence,
    balance_pence,
    rate_bps,
    monthly_payment_pence,
    next_payment_date,
    start_date,
    end_date,
    status
  ) values
    (
      '30000000-0000-0000-0000-000000000001',
      (select customer_user_id from seed_user_ids),
      'personal',
      500000,
      423500,
      699,
      15000,
      date_trunc('month', now()) + interval '1 month',
      '2025-03-01',
      '2028-03-01',
      'active'
    )
  on conflict do nothing;

  insert into public.transactions (
    account_id,
    amount_pence,
    direction,
    description,
    merchant,
    category
  ) values
    ('10000000-0000-0000-0000-000000000001', 240000, 'credit', 'Employer Ltd Salary', null, 'salary'),
    ('10000000-0000-0000-0000-000000000001', 4230, 'debit', 'Weekly shop', 'Tesco', 'food_drink'),
    ('10000000-0000-0000-0000-000000000001', 350, 'debit', 'Tube fare', 'TfL', 'transport'),
    ('10000000-0000-0000-0000-000000000001', 6799, 'debit', 'Online order', 'Amazon', 'shopping'),
    ('10000000-0000-0000-0000-000000000001', 1099, 'debit', 'Subscription', 'Netflix', 'entertainment'),
    ('10000000-0000-0000-0000-000000000001', 3500, 'debit', 'Monthly bill', 'Vodafone', 'bills'),
    ('10000000-0000-0000-0000-000000000001', 1250, 'debit', 'Pharmacy', 'Boots', 'health'),
    ('10000000-0000-0000-0000-000000000001', 480, 'debit', 'Coffee', 'Costa', 'food_drink'),
    ('10000000-0000-0000-0000-000000000001', 6100, 'debit', 'Petrol', 'Shell', 'transport'),
    ('10000000-0000-0000-0000-000000000001', 14500, 'debit', 'Council Tax', null, 'bills'),
    ('10000000-0000-0000-0000-000000000001', 20000, 'credit', 'Bank transfer in', null, 'transfer'),
    ('10000000-0000-0000-0000-000000000002', 50000, 'credit', 'Savings transfer', null, 'transfer'),
    ('10000000-0000-0000-0000-000000000002', 8500, 'debit', 'British Gas', null, 'bills'),
    ('10000000-0000-0000-0000-000000000001', 3200, 'debit', 'Lunch', 'Pret A Manger', 'food_drink'),
    ('10000000-0000-0000-0000-000000000001', 15000, 'debit', 'Trainers', 'JD Sports', 'shopping');

  insert into public.fraud_events (user_id, trigger_reason, status) values
    ((select customer_user_id from seed_user_ids), 'Large transaction flagged for review', 'flagged');

  insert into public.branches (
    name,
    address,
    postcode,
    lat,
    lng,
    phone,
    opening_hours
  ) values
    (
      'City Centre Branch',
      '12 High Street, London',
      'EC1A 1BB',
      51.5155,
      -0.0922,
      '020 1234 5678',
      '{"mon_fri":"09:00-17:00","sat":"09:00-13:00","sun":"Closed"}'
    ),
    (
      'East End Branch',
      '45 Commercial Road, London',
      'E1 1LN',
      51.5145,
      -0.0567,
      '020 8765 4321',
      '{"mon_fri":"09:30-16:30","sat":"10:00-13:00","sun":"Closed"}'
    );

  insert into public.atms (
    operator,
    address,
    postcode,
    lat,
    lng,
    is_available
  ) values
    ('Your Bank', '1 Bishopsgate, London', 'EC2N 3AQ', 51.5151, -0.0801, true),
    ('Link', '200 Aldgate High St, London', 'EC3N 1LX', 51.5136, -0.0774, true),
    ('Cardtronics', '88 Whitechapel Rd, London', 'E1 1JX', 51.5192, -0.0620, true);

