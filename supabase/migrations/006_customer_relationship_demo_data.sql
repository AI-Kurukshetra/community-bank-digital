-- Additional seeded relationship data for the demo customer.
-- This expands the cheque queue, support queue, and customer detail page
-- so admin screens render with fuller operational history by default.

create temporary table if not exists seed_user_ids (
  customer_user_id uuid not null,
  staff_user_id uuid not null,
  admin_user_id uuid not null
);

truncate table seed_user_ids;

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
  (
    '10000000-0000-0000-0000-000000000104',
    (select customer_user_id from seed_user_ids),
    'current',
    '44221190',
    '20-45-67',
    980500,
    true,
    now() - interval '250 days'
  ),
  (
    '10000000-0000-0000-0000-000000000105',
    (select customer_user_id from seed_user_ids),
    'savings',
    '66442219',
    '20-45-67',
    134200,
    false,
    now() - interval '520 days'
  )
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
  (
    '20000000-0000-0000-0000-000000000204',
    '10000000-0000-0000-0000-000000000104',
    (select customer_user_id from seed_user_ids),
    '4831 **** **** 6612',
    'debit',
    'active',
    65000,
    '2029-01-31',
    now() - interval '240 days'
  ),
  (
    '20000000-0000-0000-0000-000000000205',
    '10000000-0000-0000-0000-000000000104',
    (select customer_user_id from seed_user_ids),
    '4111 **** **** 4302',
    'debit',
    'frozen',
    20000,
    '2028-09-30',
    now() - interval '72 days'
  ),
  (
    '20000000-0000-0000-0000-000000000206',
    '10000000-0000-0000-0000-000000000101',
    (select customer_user_id from seed_user_ids),
    '5200 **** **** 9950',
    'debit',
    'active',
    90000,
    '2029-11-30',
    now() - interval '18 days'
  ),
  (
    '20000000-0000-0000-0000-000000000207',
    '10000000-0000-0000-0000-000000000101',
    (select customer_user_id from seed_user_ids),
    '4000 **** **** 1455',
    'debit',
    'cancelled',
    50000,
    '2027-06-30',
    now() - interval '610 days'
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
  (
    'd0000000-0000-0000-0000-000000000d17',
    '10000000-0000-0000-0000-000000000104',
    325000,
    'credit',
    'Quarterly client retainer',
    null,
    'transfer',
    'CLIENT-Q1',
    now() - interval '54 days'
  ),
  (
    'd0000000-0000-0000-0000-000000000d18',
    '10000000-0000-0000-0000-000000000104',
    89000,
    'debit',
    'Workspace equipment order',
    'North Wharf Tech',
    'shopping',
    null,
    now() - interval '34 days'
  ),
  (
    'd0000000-0000-0000-0000-000000000d19',
    '10000000-0000-0000-0000-000000000104',
    18600,
    'debit',
    'Hotel stay deposit',
    'StayCity London',
    'travel',
    null,
    now() - interval '28 days'
  ),
  (
    'd0000000-0000-0000-0000-000000000d1a',
    '10000000-0000-0000-0000-000000000104',
    3200,
    'debit',
    'Coffee meeting',
    'Kaffeine',
    'food_drink',
    null,
    now() - interval '21 days'
  ),
  (
    'd0000000-0000-0000-0000-000000000d1b',
    '10000000-0000-0000-0000-000000000101',
    118900,
    'debit',
    'Cash withdrawal at ATM',
    null,
    'cash',
    null,
    now() - interval '11 days'
  ),
  (
    'd0000000-0000-0000-0000-000000000d1c',
    '10000000-0000-0000-0000-000000000101',
    118900,
    'credit',
    'ATM dispute provisional refund',
    null,
    'transfer',
    'ATM-REFUND',
    now() - interval '8 days'
  ),
  (
    'd0000000-0000-0000-0000-000000000d1d',
    '10000000-0000-0000-0000-000000000102',
    5600,
    'credit',
    'Loyalty savings bonus',
    null,
    'other',
    null,
    now() - interval '6 days'
  ),
  (
    'd0000000-0000-0000-0000-000000000d1e',
    '10000000-0000-0000-0000-000000000103',
    14500,
    'credit',
    'ISA reinvestment top-up',
    null,
    'other',
    'ISA-MAR26',
    now() - interval '10 days'
  ),
  (
    'd0000000-0000-0000-0000-000000000d1f',
    '10000000-0000-0000-0000-000000000105',
    180000,
    'credit',
    'Legacy saver maturity transfer',
    null,
    'transfer',
    'MATURITY-2026',
    now() - interval '88 days'
  ),
  (
    'd0000000-0000-0000-0000-000000000d20',
    '10000000-0000-0000-0000-000000000105',
    120000,
    'debit',
    'Transfer to new current account',
    null,
    'transfer',
    'MATURITY-2026',
    now() - interval '87 days'
  ),
  (
    'd0000000-0000-0000-0000-000000000d21',
    '10000000-0000-0000-0000-000000000104',
    120000,
    'credit',
    'Transfer from legacy saver',
    null,
    'transfer',
    'MATURITY-2026',
    now() - interval '87 days'
  ),
  (
    'd0000000-0000-0000-0000-000000000d22',
    '10000000-0000-0000-0000-000000000101',
    156500,
    'debit',
    'Travel agency booking',
    'Sunline Travel',
    'transport',
    null,
    now() - interval '60 days'
  ),
  (
    'd0000000-0000-0000-0000-000000000d23',
    '10000000-0000-0000-0000-000000000101',
    6400,
    'debit',
    'Online pharmacy',
    'MediDirect',
    'health',
    null,
    now() - interval '9 days'
  ),
  (
    'd0000000-0000-0000-0000-000000000d24',
    '10000000-0000-0000-0000-000000000101',
    74200,
    'debit',
    'Electronics purchase',
    'North City Electronics',
    'shopping',
    null,
    now() - interval '5 days'
  ),
  (
    'd0000000-0000-0000-0000-000000000d25',
    '10000000-0000-0000-0000-000000000101',
    3120,
    'debit',
    'Dinner with clients',
    'The Cedar Room',
    'food_drink',
    null,
    now() - interval '2 days'
  ),
  (
    'd0000000-0000-0000-0000-000000000d26',
    '10000000-0000-0000-0000-000000000101',
    45000,
    'debit',
    'Transfer to reserve saver',
    null,
    'transfer',
    'TRF-RESERVE26',
    now() - interval '14 days'
  ),
  (
    'd0000000-0000-0000-0000-000000000d27',
    '10000000-0000-0000-0000-000000000102',
    45000,
    'credit',
    'Reserve transfer',
    null,
    'transfer',
    'TRF-RESERVE26',
    now() - interval '14 days'
  )
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
    '80000000-0000-0000-0000-000000000813',
    (select customer_user_id from seed_user_ids),
    null,
    'Travel card replacement still not dispatched',
    'Category: Cards' || E'\n' ||
    'Account: ****1190' || E'\n\n' ||
    'My replacement card for the travel account still has not been dispatched even though the previous card was frozen earlier this week. Please confirm whether it can be expedited.',
    'open',
    'high',
    now() - interval '4 hours',
    now() - interval '4 hours'
  ),
  (
    '80000000-0000-0000-0000-000000000814',
    (select customer_user_id from seed_user_ids),
    (select admin_user_id from seed_user_ids),
    'Need evidence pack for overnight ATM cash dispute',
    'Category: Fraud' || E'\n' ||
    'Account: ****5678' || E'\n\n' ||
    'Please confirm what documents you need from me to progress the overnight ATM dispute and whether the provisional refund is temporary.',
    'in_progress',
    'high',
    now() - interval '10 days',
    now() - interval '8 days'
  ),
  (
    '80000000-0000-0000-0000-000000000815',
    (select customer_user_id from seed_user_ids),
    (select staff_user_id from seed_user_ids),
    'Proof of funds letter for reserve account',
    'Category: Statements' || E'\n' ||
    'Account: ****1190' || E'\n\n' ||
    'I need a proof of funds letter that references the reserve current account balance for a tenancy renewal. Please confirm if this can be emailed securely.',
    'resolved',
    'medium',
    now() - interval '17 days',
    now() - interval '13 days'
  ),
  (
    '80000000-0000-0000-0000-000000000816',
    (select customer_user_id from seed_user_ids),
    null,
    'Can the archived savings account be reactivated?',
    'Category: Profile' || E'\n' ||
    'Account: ****2219' || E'\n\n' ||
    'The legacy savings account still appears in the admin history. Please let me know whether it can be reactivated or should be fully closed from the profile.',
    'open',
    'low',
    now() - interval '19 days',
    now() - interval '19 days'
  ),
  (
    '80000000-0000-0000-0000-000000000817',
    (select customer_user_id from seed_user_ids),
    (select staff_user_id from seed_user_ids),
    'Cheque rejected because signature was cropped',
    'Category: Payments' || E'\n' ||
    'Account: ****5678' || E'\n\n' ||
    'One of my recent cheque uploads was rejected because the signature line was cropped. Please confirm whether I should resubmit the same cheque or visit a branch.',
    'in_progress',
    'medium',
    now() - interval '24 days',
    now() - interval '20 days'
  ),
  (
    '80000000-0000-0000-0000-000000000818',
    (select customer_user_id from seed_user_ids),
    (select staff_user_id from seed_user_ids),
    'Travel agency refund still pending',
    'Category: Payments' || E'\n' ||
    'Account: ****5678' || E'\n\n' ||
    'The travel agency booking was cancelled weeks ago, but the refund is still not visible. Please check whether a merchant dispute is needed.',
    'resolved',
    'medium',
    now() - interval '41 days',
    now() - interval '35 days'
  )
on conflict (id) do nothing;

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
  (
    '90000000-0000-0000-0000-000000000916',
    (select customer_user_id from seed_user_ids),
    '10000000-0000-0000-0000-000000000104',
    'cheques/alex-johnson/20260314-conference-rebate.png',
    68900,
    'pending',
    null,
    now() - interval '7 hours'
  ),
  (
    '90000000-0000-0000-0000-000000000917',
    (select customer_user_id from seed_user_ids),
    '10000000-0000-0000-0000-000000000104',
    'cheques/alex-johnson/20260313-client-refund.jpg',
    142300,
    'pending',
    null,
    now() - interval '1 day'
  ),
  (
    '90000000-0000-0000-0000-000000000918',
    (select customer_user_id from seed_user_ids),
    '10000000-0000-0000-0000-000000000101',
    'cheques/alex-johnson/20260312-childcare-credit.png',
    23700,
    'pending',
    null,
    now() - interval '2 days'
  ),
  (
    '90000000-0000-0000-0000-000000000919',
    (select customer_user_id from seed_user_ids),
    '10000000-0000-0000-0000-000000000104',
    'cheques/alex-johnson/20260309-vendor-refund.jpg',
    90500,
    'pending',
    null,
    now() - interval '5 days'
  ),
  (
    '90000000-0000-0000-0000-000000000920',
    (select customer_user_id from seed_user_ids),
    '10000000-0000-0000-0000-000000000104',
    'cheques/alex-johnson/20260227-expense-settlement.png',
    48750,
    'processed',
    null,
    now() - interval '16 days'
  ),
  (
    '90000000-0000-0000-0000-000000000921',
    (select customer_user_id from seed_user_ids),
    '10000000-0000-0000-0000-000000000101',
    'cheques/alex-johnson/20260224-school-fundraiser.jpg',
    66500,
    'rejected',
    'The endorsement area was obscured and could not be verified.',
    now() - interval '19 days'
  ),
  (
    '90000000-0000-0000-0000-000000000922',
    (select customer_user_id from seed_user_ids),
    '10000000-0000-0000-0000-000000000104',
    'cheques/alex-johnson/20260221-insurance-adjustment.png',
    31100,
    'rejected',
    'The uploaded image was too blurry around the date field.',
    now() - interval '22 days'
  ),
  (
    '90000000-0000-0000-0000-000000000923',
    (select customer_user_id from seed_user_ids),
    '10000000-0000-0000-0000-000000000101',
    'cheques/alex-johnson/20260216-club-reimbursement.jpg',
    27450,
    'processed',
    null,
    now() - interval '27 days'
  )
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
    'a0000000-0000-0000-0000-000000000a09',
    (select customer_user_id from seed_user_ids),
    'd0000000-0000-0000-0000-000000000d1b',
    'Unexpected overnight ATM cash withdrawal triggered manual review',
    'flagged',
    null,
    now() - interval '11 days'
  ),
  (
    'a0000000-0000-0000-0000-000000000a0a',
    (select customer_user_id from seed_user_ids),
    'd0000000-0000-0000-0000-000000000d22',
    'Travel agency booking was disputed after the itinerary mismatch review',
    'confirmed',
    (select admin_user_id from seed_user_ids),
    now() - interval '58 days'
  ),
  (
    'a0000000-0000-0000-0000-000000000a0b',
    (select customer_user_id from seed_user_ids),
    'd0000000-0000-0000-0000-000000000d24',
    'High-value electronics purchase from a new merchant',
    'flagged',
    null,
    now() - interval '5 days'
  ),
  (
    'a0000000-0000-0000-0000-000000000a0c',
    (select customer_user_id from seed_user_ids),
    'd0000000-0000-0000-0000-000000000d23',
    'Pharmacy transaction was verified after customer callback',
    'dismissed',
    (select staff_user_id from seed_user_ids),
    now() - interval '8 days'
  )
on conflict (id) do nothing;
