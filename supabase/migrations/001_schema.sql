create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid references auth.users(id) primary key,
  full_name text not null,
  role text not null default 'customer'
    check (role in ('customer', 'staff', 'admin')),
  phone text,
  status text not null default 'active',
  created_at timestamptz default now()
);

create table public.accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  type text not null check (type in ('current', 'savings', 'isa')),
  account_number text unique not null,
  sort_code text not null,
  balance_pence integer not null default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table public.transactions (
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

create table public.cards (
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

create table public.beneficiaries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  name text not null,
  account_number text not null,
  sort_code text not null,
  bank_name text,
  created_at timestamptz default now()
);

create table public.bill_payments (
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

create table public.fraud_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  transaction_id uuid references public.transactions(id),
  trigger_reason text,
  status text default 'flagged'
    check (status in ('flagged', 'confirmed', 'dismissed')),
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  ip_address text,
  metadata jsonb,
  created_at timestamptz default now()
);
