alter table public.loans enable row level security;
alter table public.statements enable row level security;
alter table public.documents enable row level security;
alter table public.support_tickets enable row level security;
alter table public.alert_configs enable row level security;
alter table public.check_images enable row level security;
alter table public.branches enable row level security;
alter table public.atms enable row level security;

drop policy if exists "loans_select" on public.loans;
drop policy if exists "statements_select" on public.statements;
drop policy if exists "documents_select" on public.documents;
drop policy if exists "tickets_all" on public.support_tickets;
drop policy if exists "alert_configs_all" on public.alert_configs;
drop policy if exists "check_images_all" on public.check_images;
drop policy if exists "branches_public" on public.branches;
drop policy if exists "atms_public" on public.atms;

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

create policy "branches_public" on public.branches for select
  using (true);

create policy "atms_public" on public.atms for select
  using (true);
