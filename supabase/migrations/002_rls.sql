alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.cards enable row level security;
alter table public.beneficiaries enable row level security;
alter table public.bill_payments enable row level security;
alter table public.fraud_events enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.is_staff_or_admin()
returns boolean as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('staff', 'admin')
  );
$$ language sql security definer;

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

create policy "fraud_select" on public.fraud_events for select
  using (auth.uid() = user_id or public.is_staff_or_admin());

create policy "fraud_insert_staff" on public.fraud_events for insert
  with check (public.is_staff_or_admin());

create policy "fraud_update_staff" on public.fraud_events for update
  using (public.is_staff_or_admin());

create policy "audit_insert" on public.audit_logs for insert
  with check (auth.uid() is not null);

create policy "audit_select_staff" on public.audit_logs for select
  using (public.is_staff_or_admin());
