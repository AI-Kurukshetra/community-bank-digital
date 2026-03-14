-- Detailed demo seed data for CommunityBank Digital.
--
-- Prerequisites:
-- 1. Run the schema/RLS setup first.
-- 2. Create these auth users in Supabase Auth:
--    customer@demo.com / Demo1234!
--    staff@demo.com    / Demo1234!
--    admin@demo.com    / Demo1234!
-- 3. Optional: upload placeholder files to the private documents,
--    statements, and cheques buckets so downloads/previews work.
--
-- This script resolves the demo auth user IDs from auth.users by email.
-- This script uses fixed UUIDs for seeded rows so it can be re-run safely.
-- It does not delete existing data.

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

  insert into public.profiles (id, full_name, role, phone, status, created_at)
  values
    ((select customer_user_id from seed_user_ids), 'Alex Johnson', 'customer', '07123 456789', 'active', now() - interval '420 days'),
    ((select staff_user_id from seed_user_ids), 'Sarah Williams', 'staff', '07999 111222', 'active', now() - interval '540 days'),
    ((select admin_user_id from seed_user_ids), 'James Admin', 'admin', '07888 333444', 'active', now() - interval '720 days')
  on conflict (id) do nothing;

  insert into public.accounts (
    id,
    user_id,
    type,
    account_number,
    sort_code,
    balance_pence,
    is_active,
    created_at
  )
  values
    ('10000000-0000-0000-0000-000000000101', (select customer_user_id from seed_user_ids), 'current', '12345678', '20-45-67', 2684315, true, now() - interval '400 days'),
    ('10000000-0000-0000-0000-000000000102', (select customer_user_id from seed_user_ids), 'savings', '87654321', '20-45-67', 4250000, true, now() - interval '395 days'),
    ('10000000-0000-0000-0000-000000000103', (select customer_user_id from seed_user_ids), 'isa', '45671234', '20-45-67', 1565000, true, now() - interval '360 days')
  on conflict (id) do nothing;

  insert into public.cards (
    id,
    account_id,
    user_id,
    masked_number,
    card_type,
    status,
    daily_limit_pence,
    expires_at,
    created_at
  )
  values
    ('20000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-000000000101', (select customer_user_id from seed_user_ids), '4111 **** **** 1234', 'debit', 'active', 45000, '2028-03-31', now() - interval '365 days'),
    ('20000000-0000-0000-0000-000000000202', '10000000-0000-0000-0000-000000000101', (select customer_user_id from seed_user_ids), '5358 **** **** 7788', 'debit', 'frozen', 30000, '2027-11-30', now() - interval '210 days'),
    ('20000000-0000-0000-0000-000000000203', '10000000-0000-0000-0000-000000000101', (select customer_user_id from seed_user_ids), '4000 **** **** 9001', 'debit', 'cancelled', 50000, '2026-09-30', now() - interval '520 days')
  on conflict (id) do nothing;

  insert into public.beneficiaries (
    id,
    user_id,
    name,
    account_number,
    sort_code,
    bank_name,
    created_at
  )
  values
    ('e0000000-0000-0000-0000-000000000e01', (select customer_user_id from seed_user_ids), 'James Smith', '87654321', '20-45-67', 'Barclays', now() - interval '300 days'),
    ('e0000000-0000-0000-0000-000000000e02', (select customer_user_id from seed_user_ids), 'BT Internet', '31926819', '60-00-01', 'HSBC', now() - interval '295 days'),
    ('e0000000-0000-0000-0000-000000000e03', (select customer_user_id from seed_user_ids), 'Thames Water', '55221144', '40-12-33', 'Lloyds', now() - interval '280 days'),
    ('e0000000-0000-0000-0000-000000000e04', (select customer_user_id from seed_user_ids), 'HMRC Self Assessment', '12001039', '08-32-10', 'National Westminster', now() - interval '250 days'),
    ('e0000000-0000-0000-0000-000000000e05', (select customer_user_id from seed_user_ids), 'Sarah Turner', '11223344', '04-00-75', 'Nationwide', now() - interval '120 days'),
    ('e0000000-0000-0000-0000-000000000e06', (select customer_user_id from seed_user_ids), 'Northside Primary PTA', '66778899', '30-98-76', 'Santander', now() - interval '45 days')
  on conflict (id) do nothing;

  insert into public.bill_payments (
    id,
    user_id,
    payee_name,
    reference,
    amount_pence,
    frequency,
    next_payment_date,
    is_active,
    created_at
  )
  values
    ('f0000000-0000-0000-0000-000000000f01', (select customer_user_id from seed_user_ids), 'British Gas', 'HOME-ENERGY', 8500, 'monthly', current_date + 18, true, now() - interval '260 days'),
    ('f0000000-0000-0000-0000-000000000f02', (select customer_user_id from seed_user_ids), 'Camden Council Tax', 'CTAX-2041', 14500, 'monthly', current_date + 9, true, now() - interval '240 days'),
    ('f0000000-0000-0000-0000-000000000f03', (select customer_user_id from seed_user_ids), 'Harbour Gym', 'MEMBERSHIP', 2999, 'weekly', current_date + 4, true, now() - interval '110 days'),
    ('f0000000-0000-0000-0000-000000000f04', (select customer_user_id from seed_user_ids), 'Food Bank Donation', 'SPRING-APPEAL', 2500, 'one_off', current_date - 14, false, now() - interval '90 days')
  on conflict (id) do nothing;

  insert into public.loans (
    id,
    user_id,
    account_id,
    loan_type,
    principal_pence,
    balance_pence,
    rate_bps,
    monthly_payment_pence,
    next_payment_date,
    start_date,
    end_date,
    status,
    created_at
  )
  values
    (
      '30000000-0000-0000-0000-000000000301',
      (select customer_user_id from seed_user_ids),
      '10000000-0000-0000-0000-000000000101',
      'personal',
      500000,
      378500,
      699,
      15000,
      current_date + 17,
      '2025-03-01',
      '2028-03-01',
      'active',
      now() - interval '380 days'
    ),
    (
      '30000000-0000-0000-0000-000000000302',
      (select customer_user_id from seed_user_ids),
      '10000000-0000-0000-0000-000000000101',
      'auto',
      1250000,
      0,
      499,
      23500,
      null,
      '2022-02-01',
      '2025-02-01',
      'paid_off',
      now() - interval '980 days'
    )
  on conflict (id) do nothing;

  insert into public.transactions (
    id,
    account_id,
    amount_pence,
    direction,
    description,
    merchant,
    category,
    reference,
    created_at
  )
  values
    ('d0000000-0000-0000-0000-000000000d01', '10000000-0000-0000-0000-000000000101', 250000, 'credit', 'Employer Ltd Salary', null, 'salary', 'PAY-JAN26', now() - interval '71 days'),
    ('d0000000-0000-0000-0000-000000000d02', '10000000-0000-0000-0000-000000000101', 255000, 'credit', 'Employer Ltd Salary', null, 'salary', 'PAY-FEB26', now() - interval '43 days'),
    ('d0000000-0000-0000-0000-000000000d03', '10000000-0000-0000-0000-000000000101', 255000, 'credit', 'Employer Ltd Salary', null, 'salary', 'PAY-MAR26', now() - interval '12 days'),
    ('d0000000-0000-0000-0000-000000000d04', '10000000-0000-0000-0000-000000000101', 95000, 'debit', 'Monthly rent', null, 'bills', 'RENT-MAR26', now() - interval '9 days'),
    ('d0000000-0000-0000-0000-000000000d05', '10000000-0000-0000-0000-000000000101', 4230, 'debit', 'Weekly shop', 'Tesco', 'food_drink', null, now() - interval '7 days'),
    ('d0000000-0000-0000-0000-000000000d06', '10000000-0000-0000-0000-000000000101', 350, 'debit', 'Tube fare', 'TfL', 'transport', null, now() - interval '6 days'),
    ('d0000000-0000-0000-0000-000000000d07', '10000000-0000-0000-0000-000000000101', 6799, 'debit', 'Online order', 'Amazon', 'shopping', null, now() - interval '15 days'),
    ('d0000000-0000-0000-0000-000000000d08', '10000000-0000-0000-0000-000000000101', 1099, 'debit', 'Subscription', 'Netflix', 'entertainment', null, now() - interval '3 days'),
    ('d0000000-0000-0000-0000-000000000d09', '10000000-0000-0000-0000-000000000101', 14500, 'debit', 'Council Tax', null, 'bills', 'CTAX-MAR26', now() - interval '20 days'),
    ('d0000000-0000-0000-0000-000000000d0a', '10000000-0000-0000-0000-000000000101', 20000, 'credit', 'Bank transfer in', null, 'transfer', 'TRF-FRIEND26', now() - interval '33 days'),
    ('d0000000-0000-0000-0000-000000000d0b', '10000000-0000-0000-0000-000000000101', 50000, 'debit', 'Transfer to savings', null, 'transfer', 'TRF-SAVE26', now() - interval '63 days'),
    ('d0000000-0000-0000-0000-000000000d0c', '10000000-0000-0000-0000-000000000102', 50000, 'credit', 'Savings transfer', null, 'transfer', 'TRF-SAVE26', now() - interval '63 days'),
    ('d0000000-0000-0000-0000-000000000d0d', '10000000-0000-0000-0000-000000000101', 25000, 'debit', 'ISA contribution', null, 'transfer', 'TRF-ISA26', now() - interval '31 days'),
    ('d0000000-0000-0000-0000-000000000d0e', '10000000-0000-0000-0000-000000000103', 25000, 'credit', 'ISA contribution', null, 'transfer', 'TRF-ISA26', now() - interval '31 days'),
    ('d0000000-0000-0000-0000-000000000d0f', '10000000-0000-0000-0000-000000000101', 15000, 'debit', 'Loan payment', null, 'bills', 'LOAN-MAR26', now() - interval '18 days'),
    ('d0000000-0000-0000-0000-000000000d10', '10000000-0000-0000-0000-000000000101', 32500, 'credit', 'Cheque deposit', null, 'transfer', null, now() - interval '25 days'),
    ('d0000000-0000-0000-0000-000000000d11', '10000000-0000-0000-0000-000000000101', 225000, 'debit', 'University fees payment', null, 'transfer', null, now() - interval '32 days'),
    ('d0000000-0000-0000-0000-000000000d12', '10000000-0000-0000-0000-000000000101', 875000, 'credit', 'Deposit refund received', null, 'transfer', null, now() - interval '58 days'),
    ('d0000000-0000-0000-0000-000000000d13', '10000000-0000-0000-0000-000000000101', 189900, 'debit', 'Electronics order', 'Global Gadgets', 'shopping', null, now() - interval '5 days'),
    ('d0000000-0000-0000-0000-000000000d14', '10000000-0000-0000-0000-000000000101', 125000, 'debit', 'Travel kiosk purchase', 'Euro Travel Kiosk', 'transport', null, now() - interval '95 days'),
    ('d0000000-0000-0000-0000-000000000d15', '10000000-0000-0000-0000-000000000102', 2450, 'credit', 'Savings interest', null, 'other', null, now() - interval '1 day'),
    ('d0000000-0000-0000-0000-000000000d16', '10000000-0000-0000-0000-000000000101', 1250, 'debit', 'Pharmacy', 'Boots', 'health', null, now() - interval '9 days')
  on conflict (id) do nothing;

  insert into public.statements (
    id,
    account_id,
    period_start,
    period_end,
    storage_path,
    created_at
  )
  values
    ('50000000-0000-0000-0000-000000000501', '10000000-0000-0000-0000-000000000101', '2025-12-01', '2025-12-31', 'customers/alex-johnson/statements/current-2025-12.pdf', now() - interval '70 days'),
    ('50000000-0000-0000-0000-000000000502', '10000000-0000-0000-0000-000000000101', '2026-01-01', '2026-01-31', 'customers/alex-johnson/statements/current-2026-01.pdf', now() - interval '40 days'),
    ('50000000-0000-0000-0000-000000000503', '10000000-0000-0000-0000-000000000101', '2026-02-01', '2026-02-28', 'customers/alex-johnson/statements/current-2026-02.pdf', now() - interval '11 days'),
    ('50000000-0000-0000-0000-000000000504', '10000000-0000-0000-0000-000000000102', '2025-12-01', '2025-12-31', 'customers/alex-johnson/statements/savings-2025-12.pdf', now() - interval '70 days'),
    ('50000000-0000-0000-0000-000000000505', '10000000-0000-0000-0000-000000000102', '2026-01-01', '2026-01-31', 'customers/alex-johnson/statements/savings-2026-01.pdf', now() - interval '40 days'),
    ('50000000-0000-0000-0000-000000000506', '10000000-0000-0000-0000-000000000103', '2026-02-01', '2026-02-28', 'customers/alex-johnson/statements/isa-2026-02.pdf', now() - interval '11 days')
  on conflict (id) do nothing;

  insert into public.documents (
    id,
    user_id,
    type,
    filename,
    storage_path,
    created_at
  )
  values
    ('60000000-0000-0000-0000-000000000601', (select customer_user_id from seed_user_ids), 'tax', 'P60-2025.pdf', 'customers/alex-johnson/documents/tax/p60-2025.pdf', now() - interval '58 days'),
    ('60000000-0000-0000-0000-000000000602', (select customer_user_id from seed_user_ids), 'tax', 'Annual-interest-summary-2025.pdf', 'customers/alex-johnson/documents/tax/interest-summary-2025.pdf', now() - interval '56 days'),
    ('60000000-0000-0000-0000-000000000603', (select customer_user_id from seed_user_ids), 'loan', 'Personal-loan-agreement.pdf', 'customers/alex-johnson/documents/loan/personal-loan-agreement.pdf', now() - interval '370 days'),
    ('60000000-0000-0000-0000-000000000604', (select customer_user_id from seed_user_ids), 'loan', 'Auto-loan-closing-letter.pdf', 'customers/alex-johnson/documents/loan/auto-loan-closing-letter.pdf', now() - interval '390 days'),
    ('60000000-0000-0000-0000-000000000605', (select customer_user_id from seed_user_ids), 'letter', 'Overdraft-limit-change-letter.pdf', 'customers/alex-johnson/documents/letters/overdraft-limit-change-letter.pdf', now() - interval '80 days'),
    ('60000000-0000-0000-0000-000000000606', (select customer_user_id from seed_user_ids), 'other', 'Travel-insurance-certificate.pdf', 'customers/alex-johnson/documents/other/travel-insurance-certificate.pdf', now() - interval '25 days')
  on conflict (id) do nothing;

  insert into public.support_tickets (
    id,
    user_id,
    assigned_to,
    subject,
    body,
    status,
    priority,
    created_at,
    updated_at
  )
  values
    (
      '80000000-0000-0000-0000-000000000801',
      (select customer_user_id from seed_user_ids),
      (select staff_user_id from seed_user_ids),
      'Stop payment request for council tax debit',
      'Transaction: d0000000-0000-0000-0000-000000000d09' || E'\nReason: The council tax mandate should now be collected from my joint account. Please attempt to stop the next debit if it has not already been released.',
      'in_progress',
      'high',
      now() - interval '4 days',
      now() - interval '2 days'
    ),
    (
      '80000000-0000-0000-0000-000000000802',
      (select customer_user_id from seed_user_ids),
      (select staff_user_id from seed_user_ids),
      'Need a certified copy of my February statement',
      'I need a certified PDF copy of my February current account statement for a tenancy review. Please confirm if the downloaded version is acceptable or if a branch letter is required.',
      'resolved',
      'medium',
      now() - interval '20 days',
      now() - interval '17 days'
    ),
    (
      '80000000-0000-0000-0000-000000000803',
      (select customer_user_id from seed_user_ids),
      null,
      'Cheque deposit still pending review',
      'My cheque deposit from 12 March still shows as pending in the app. Please let me know whether the image needs to be uploaded again or if further review is still in progress.',
      'open',
      'high',
      now() - interval '1 day',
      now() - interval '1 day'
    ),
    (
      '80000000-0000-0000-0000-000000000804',
      (select customer_user_id from seed_user_ids),
      (select staff_user_id from seed_user_ids),
      'Need help updating my phone number',
      'I updated my phone number online, but the branch still sees the old number on file. Can you confirm whether the profile change has fully synced across staff systems?',
      'resolved',
      'low',
      now() - interval '65 days',
      now() - interval '62 days'
    )
  on conflict (id) do nothing;

  insert into public.alert_configs (
    user_id,
    type,
    is_active,
    threshold_pence,
    days_before,
    created_at
  )
  values
    ((select customer_user_id from seed_user_ids), 'low_balance', true, 10000, null, now() - interval '180 days'),
    ((select customer_user_id from seed_user_ids), 'large_transaction', true, 75000, null, now() - interval '180 days'),
    ((select customer_user_id from seed_user_ids), 'new_device_login', true, null, null, now() - interval '180 days'),
    ((select customer_user_id from seed_user_ids), 'card_used_abroad', true, null, null, now() - interval '180 days'),
    ((select customer_user_id from seed_user_ids), 'payment_due', true, null, 3, now() - interval '180 days'),
    ((select customer_user_id from seed_user_ids), 'fraud_flagged', true, null, null, now() - interval '180 days')
  on conflict (user_id, type) do update
  set
    is_active = excluded.is_active,
    threshold_pence = excluded.threshold_pence,
    days_before = excluded.days_before;

  insert into public.check_images (
    id,
    user_id,
    account_id,
    storage_path,
    amount_pence,
    status,
    rejection_reason,
    created_at
  )
  values
    ('90000000-0000-0000-0000-000000000901', (select customer_user_id from seed_user_ids), '10000000-0000-0000-0000-000000000101', 'cheques/alex-johnson/20260312-rent-rebate.png', 125000, 'pending', null, now() - interval '2 days'),
    ('90000000-0000-0000-0000-000000000902', (select customer_user_id from seed_user_ids), '10000000-0000-0000-0000-000000000101', 'cheques/alex-johnson/20260217-gift-cheque.jpg', 32500, 'processed', null, now() - interval '26 days'),
    ('90000000-0000-0000-0000-000000000903', (select customer_user_id from seed_user_ids), '10000000-0000-0000-0000-000000000101', 'cheques/alex-johnson/20260201-insurance-cheque.png', 78000, 'rejected', 'Image too dark to read the signature line.', now() - interval '40 days')
  on conflict (id) do nothing;

  insert into public.fraud_events (
    id,
    user_id,
    transaction_id,
    trigger_reason,
    status,
    reviewed_by,
    created_at
  )
  values
    (
      'a0000000-0000-0000-0000-000000000a01',
      (select customer_user_id from seed_user_ids),
      'd0000000-0000-0000-0000-000000000d13',
      'Large online purchase flagged for review',
      'flagged',
      null,
      now() - interval '5 days'
    ),
    (
      'a0000000-0000-0000-0000-000000000a02',
      (select customer_user_id from seed_user_ids),
      'd0000000-0000-0000-0000-000000000d14',
      'High-risk overseas merchant pattern confirmed as fraud',
      'confirmed',
      (select admin_user_id from seed_user_ids),
      now() - interval '94 days'
    ),
    (
      'a0000000-0000-0000-0000-000000000a03',
      (select customer_user_id from seed_user_ids),
      'd0000000-0000-0000-0000-000000000d07',
      'Repeat shopping pattern reviewed and dismissed',
      'dismissed',
      (select staff_user_id from seed_user_ids),
      now() - interval '14 days'
    )
  on conflict (id) do nothing;

  insert into public.branches (
    id,
    name,
    address,
    postcode,
    lat,
    lng,
    phone,
    opening_hours,
    created_at
  )
  values
    ('b0000000-0000-0000-0000-000000000b01', 'City Centre Branch', '12 High Street, London', 'EC1A 1BB', 51.5155, -0.0922, '020 1234 5678', '{"mon_fri":"09:00-17:00","sat":"09:00-13:00","sun":"Closed"}'::jsonb, now() - interval '700 days'),
    ('b0000000-0000-0000-0000-000000000b02', 'East End Branch', '45 Commercial Road, London', 'E1 1LN', 51.5145, -0.0567, '020 8765 4321', '{"mon_fri":"09:30-16:30","sat":"10:00-13:00","sun":"Closed"}'::jsonb, now() - interval '650 days'),
    ('b0000000-0000-0000-0000-000000000b03', 'Greenwich Branch', '8 Nelson Road, London', 'SE10 9JB', 51.4811, -0.0087, '020 4455 8899', '{"mon_fri":"09:00-17:00","sat":"09:00-12:30","sun":"Closed"}'::jsonb, now() - interval '510 days'),
    ('b0000000-0000-0000-0000-000000000b04', 'Croydon Branch', '101 George Street, Croydon', 'CR0 1LD', 51.3723, -0.1000, '020 7788 5522', '{"mon_fri":"09:00-17:00","sat":"09:30-13:00","sun":"Closed"}'::jsonb, now() - interval '470 days')
  on conflict (id) do nothing;

  insert into public.atms (
    id,
    operator,
    address,
    postcode,
    lat,
    lng,
    is_available,
    created_at
  )
  values
    ('c0000000-0000-0000-0000-000000000c01', 'Your Bank', '1 Bishopsgate, London', 'EC2N 3AQ', 51.5151, -0.0801, true, now() - interval '300 days'),
    ('c0000000-0000-0000-0000-000000000c02', 'Link', '200 Aldgate High St, London', 'EC3N 1LX', 51.5136, -0.0774, true, now() - interval '280 days'),
    ('c0000000-0000-0000-0000-000000000c03', 'Cardtronics', '88 Whitechapel Rd, London', 'E1 1JX', 51.5192, -0.0620, false, now() - interval '260 days'),
    ('c0000000-0000-0000-0000-000000000c04', 'Your Bank', '15 Greenwich Church Street, London', 'SE10 9BJ', 51.4805, -0.0107, true, now() - interval '240 days'),
    ('c0000000-0000-0000-0000-000000000c05', 'Link', '21 North End, Croydon', 'CR0 1TY', 51.3747, -0.1010, true, now() - interval '220 days')
  on conflict (id) do nothing;

  insert into public.audit_logs (
    id,
    actor_id,
    action,
    entity_type,
    entity_id,
    ip_address,
    metadata,
    created_at
  )
  values
    ('15000000-0000-0000-0000-000000001501', (select customer_user_id from seed_user_ids), 'login_success', 'profiles', (select customer_user_id from seed_user_ids), '203.0.113.10', jsonb_build_object('channel', 'web', 'device', 'MacBook Pro'), now() - interval '13 days'),
    ('15000000-0000-0000-0000-000000001502', (select customer_user_id from seed_user_ids), 'transfer_completed', 'accounts', '10000000-0000-0000-0000-000000000101', '203.0.113.10', jsonb_build_object('reference', 'TRF-SAVE26', 'amount_pence', 50000, 'destination_account_id', '10000000-0000-0000-0000-000000000102'), now() - interval '63 days'),
    ('15000000-0000-0000-0000-000000001503', (select customer_user_id from seed_user_ids), 'bill_payment_made', 'bill_payments', 'f0000000-0000-0000-0000-000000000f02', '203.0.113.10', jsonb_build_object('amount_pence', 14500, 'reference', 'CTAX-MAR26'), now() - interval '20 days'),
    ('15000000-0000-0000-0000-000000001506', (select customer_user_id from seed_user_ids), 'stop_payment_requested', 'support_tickets', '80000000-0000-0000-0000-000000000801', '203.0.113.10', jsonb_build_object('transaction_id', 'd0000000-0000-0000-0000-000000000d09'), now() - interval '4 days'),
    ('15000000-0000-0000-0000-000000001507', (select customer_user_id from seed_user_ids), 'card_limit_changed', 'cards', '20000000-0000-0000-0000-000000000201', '203.0.113.10', jsonb_build_object('daily_limit_pence', 45000), now() - interval '9 days'),
    ('15000000-0000-0000-0000-000000001508', (select customer_user_id from seed_user_ids), 'loan_payment_made', 'loans', '30000000-0000-0000-0000-000000000301', '203.0.113.10', jsonb_build_object('amount_pence', 15000, 'reference', 'LOAN-MAR26'), now() - interval '18 days'),
    ('15000000-0000-0000-0000-000000001509', (select customer_user_id from seed_user_ids), 'cheque_submitted', 'check_images', '90000000-0000-0000-0000-000000000901', '203.0.113.10', jsonb_build_object('amount_pence', 125000), now() - interval '2 days'),
    ('15000000-0000-0000-0000-000000001510', (select staff_user_id from seed_user_ids), 'cheque_approved', 'check_images', '90000000-0000-0000-0000-000000000902', '198.51.100.42', jsonb_build_object('amount_pence', 32500), now() - interval '25 days'),
    ('15000000-0000-0000-0000-000000001511', (select customer_user_id from seed_user_ids), 'statement_downloaded', 'statements', '50000000-0000-0000-0000-000000000503', '203.0.113.10', jsonb_build_object('period_end', '2026-02-28'), now() - interval '3 days'),
    ('15000000-0000-0000-0000-000000001512', (select staff_user_id from seed_user_ids), 'admin_customer_viewed', 'profile', (select customer_user_id from seed_user_ids), '198.51.100.42', jsonb_build_object('screen', 'customer_detail'), now() - interval '1 day'),
    ('15000000-0000-0000-0000-000000001513', (select admin_user_id from seed_user_ids), 'fraud_confirmed', 'fraud_events', 'a0000000-0000-0000-0000-000000000a02', '198.51.100.24', jsonb_build_object('customer_id', (select customer_user_id from seed_user_ids), 'cards_frozen', 1), now() - interval '93 days'),
    ('15000000-0000-0000-0000-000000001514', (select staff_user_id from seed_user_ids), 'ticket_resolved', 'support_tickets', '80000000-0000-0000-0000-000000000802', '198.51.100.42', jsonb_build_object('customer_id', (select customer_user_id from seed_user_ids)), now() - interval '17 days')
  on conflict (id) do nothing;

