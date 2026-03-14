-- Additional demo data for the remaining customer-facing modules.
-- This migration expands transfers, bill pay, loans, statements, documents,
-- support, location lookup, and audit history without changing app logic.

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
  ('e0000000-0000-0000-0000-000000000e07', (select customer_user_id from seed_user_ids), 'Emily Carter', '33445566', '16-24-08', 'Monzo', now() - interval '210 days'),
  ('e0000000-0000-0000-0000-000000000e08', (select customer_user_id from seed_user_ids), 'Riverlight Nursery', '55001122', '09-01-28', 'Lloyds', now() - interval '165 days'),
  ('e0000000-0000-0000-0000-000000000e09', (select customer_user_id from seed_user_ids), 'Southbank Energy', '11004422', '54-21-99', 'NatWest', now() - interval '160 days'),
  ('e0000000-0000-0000-0000-000000000e0a', (select customer_user_id from seed_user_ids), 'Daniel Morgan', '99001122', '60-83-71', 'Halifax', now() - interval '118 days'),
  ('e0000000-0000-0000-0000-000000000e0b', (select customer_user_id from seed_user_ids), 'Brightline Mortgage Services', '80112233', '20-11-08', 'Barclays', now() - interval '95 days'),
  ('e0000000-0000-0000-0000-000000000e0c', (select customer_user_id from seed_user_ids), 'Homecare Physio Clinic', '44009911', '30-96-44', 'Santander', now() - interval '72 days'),
  ('e0000000-0000-0000-0000-000000000e0d', (select customer_user_id from seed_user_ids), 'Studio Rail Pass', '21009987', '23-10-44', 'HSBC', now() - interval '51 days'),
  ('e0000000-0000-0000-0000-000000000e0e', (select customer_user_id from seed_user_ids), 'Camden School Trips', '77441100', '40-51-62', 'Nationwide', now() - interval '32 days')
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
  ('f0000000-0000-0000-0000-000000000f05', (select customer_user_id from seed_user_ids), 'Southbank Energy', 'ELEC-GAS-4412', 11240, 'monthly', current_date + 6, true, now() - interval '155 days'),
  ('f0000000-0000-0000-0000-000000000f06', (select customer_user_id from seed_user_ids), 'Riverlight Nursery', 'APR-CARE', 52400, 'monthly', current_date + 11, true, now() - interval '120 days'),
  ('f0000000-0000-0000-0000-000000000f07', (select customer_user_id from seed_user_ids), 'Brightline Mortgage Services', 'MORT-PRIMARY', 95000, 'monthly', current_date + 15, true, now() - interval '95 days'),
  ('f0000000-0000-0000-0000-000000000f08', (select customer_user_id from seed_user_ids), 'Homecare Physio Clinic', 'REHAB', 7400, 'weekly', current_date + 3, true, now() - interval '54 days'),
  ('f0000000-0000-0000-0000-000000000f09', (select customer_user_id from seed_user_ids), 'Camden School Trips', 'SUMMER-TRIP', 18500, 'one_off', current_date + 21, true, now() - interval '24 days'),
  ('f0000000-0000-0000-0000-000000000f0a', (select customer_user_id from seed_user_ids), 'Studio Rail Pass', 'COMMUTE', 16200, 'monthly', current_date + 5, true, now() - interval '18 days')
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
    '30000000-0000-0000-0000-000000000303',
    (select customer_user_id from seed_user_ids),
    '10000000-0000-0000-0000-000000000104',
    'mortgage',
    18500000,
    16920000,
    389,
    95000,
    current_date + 12,
    '2024-09-01',
    '2049-08-31',
    'active',
    now() - interval '540 days'
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
  ('d0000000-0000-0000-0000-000000000d28', '10000000-0000-0000-0000-000000000104', 275000, 'credit', 'Quarterly design retainer', null, 'salary', 'RETAINER-Q4', now() - interval '150 days'),
  ('d0000000-0000-0000-0000-000000000d29', '10000000-0000-0000-0000-000000000104', 95000, 'debit', 'Mortgage loan payment', null, 'bills', 'MORT-NOV25', now() - interval '121 days'),
  ('d0000000-0000-0000-0000-000000000d2a', '10000000-0000-0000-0000-000000000104', 95000, 'debit', 'Mortgage loan payment', null, 'bills', 'MORT-DEC25', now() - interval '90 days'),
  ('d0000000-0000-0000-0000-000000000d2b', '10000000-0000-0000-0000-000000000104', 95000, 'debit', 'Mortgage loan payment', null, 'bills', 'MORT-JAN26', now() - interval '60 days'),
  ('d0000000-0000-0000-0000-000000000d2c', '10000000-0000-0000-0000-000000000104', 95000, 'debit', 'Mortgage loan payment', null, 'bills', 'MORT-FEB26', now() - interval '29 days'),
  ('d0000000-0000-0000-0000-000000000d2d', '10000000-0000-0000-0000-000000000104', 95000, 'debit', 'Mortgage loan payment', null, 'bills', 'MORT-MAR26', now() - interval '12 days'),
  ('d0000000-0000-0000-0000-000000000d2e', '10000000-0000-0000-0000-000000000104', 198000, 'credit', 'Freelance invoice settlement', null, 'salary', 'INV-MAR26', now() - interval '24 days'),
  ('d0000000-0000-0000-0000-000000000d2f', '10000000-0000-0000-0000-000000000104', 18450, 'debit', 'Rail commuter pass', 'Studio Rail Pass', 'transport', 'COMMUTE-MAR26', now() - interval '14 days'),
  ('d0000000-0000-0000-0000-000000000d30', '10000000-0000-0000-0000-000000000104', 26200, 'debit', 'Workspace insurance', null, 'bills', 'INS-MAR26', now() - interval '17 days'),
  ('d0000000-0000-0000-0000-000000000d31', '10000000-0000-0000-0000-000000000101', 52400, 'debit', 'Riverlight Nursery fee', null, 'bills', 'NURSERY-MAR26', now() - interval '13 days'),
  ('d0000000-0000-0000-0000-000000000d32', '10000000-0000-0000-0000-000000000101', 11240, 'debit', 'Southbank Energy direct debit', null, 'bills', 'ENERGY-MAR26', now() - interval '8 days'),
  ('d0000000-0000-0000-0000-000000000d33', '10000000-0000-0000-0000-000000000101', 68400, 'credit', 'Travel expense reimbursement', null, 'transfer', 'EXP-MAR26', now() - interval '7 days'),
  ('d0000000-0000-0000-0000-000000000d34', '10000000-0000-0000-0000-000000000101', 7400, 'debit', 'Homecare Physio Clinic', 'Homecare Physio Clinic', 'health', 'PHYSIO-MAR26', now() - interval '5 days'),
  ('d0000000-0000-0000-0000-000000000d35', '10000000-0000-0000-0000-000000000101', 5210, 'debit', 'Weekend groceries', 'Tesco', 'food_drink', null, now() - interval '1 day'),
  ('d0000000-0000-0000-0000-000000000d36', '10000000-0000-0000-0000-000000000102', 3250, 'credit', 'Cash ISA bonus', null, 'other', 'SAV-BONUS26', now() - interval '20 days'),
  ('d0000000-0000-0000-0000-000000000d37', '10000000-0000-0000-0000-000000000101', 45000, 'debit', 'ISA top-up', null, 'transfer', 'ISA-TOPUP26B', now() - interval '16 days'),
  ('d0000000-0000-0000-0000-000000000d38', '10000000-0000-0000-0000-000000000103', 45000, 'credit', 'ISA top-up', null, 'transfer', 'ISA-TOPUP26B', now() - interval '16 days'),
  ('d0000000-0000-0000-0000-000000000d39', '10000000-0000-0000-0000-000000000104', 9650, 'debit', 'Client dinner', 'Borough Kitchen', 'food_drink', null, now() - interval '18 days'),
  ('d0000000-0000-0000-0000-000000000d3a', '10000000-0000-0000-0000-000000000104', 42800, 'debit', 'Conference registration', 'Product Design Expo', 'shopping', 'CONF-APR26', now() - interval '41 days'),
  ('d0000000-0000-0000-0000-000000000d3b', '10000000-0000-0000-0000-000000000104', 135000, 'debit', 'Studio rent', null, 'bills', 'STUDIO-MAR26', now() - interval '11 days'),
  ('d0000000-0000-0000-0000-000000000d3c', '10000000-0000-0000-0000-000000000104', 48750, 'credit', 'Cheque deposit', null, 'transfer', null, now() - interval '15 days'),
  ('d0000000-0000-0000-0000-000000000d3d', '10000000-0000-0000-0000-000000000101', 27450, 'credit', 'Cheque deposit', null, 'transfer', null, now() - interval '26 days'),
  ('d0000000-0000-0000-0000-000000000d3e', '10000000-0000-0000-0000-000000000101', 18500, 'credit', 'School trip refund', null, 'transfer', 'SCHOOL-REF26', now() - interval '2 days'),
  ('d0000000-0000-0000-0000-000000000d3f', '10000000-0000-0000-0000-000000000104', 3180, 'debit', 'Cafe meeting', 'Workshop Coffee', 'food_drink', null, now() - interval '3 days')
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
  ('50000000-0000-0000-0000-000000000507', '10000000-0000-0000-0000-000000000104', '2025-11-01', '2025-11-30', 'customers/alex-johnson/statements/reserve-current-2025-11.pdf', now() - interval '102 days'),
  ('50000000-0000-0000-0000-000000000508', '10000000-0000-0000-0000-000000000104', '2025-12-01', '2025-12-31', 'customers/alex-johnson/statements/reserve-current-2025-12.pdf', now() - interval '72 days'),
  ('50000000-0000-0000-0000-000000000509', '10000000-0000-0000-0000-000000000104', '2026-01-01', '2026-01-31', 'customers/alex-johnson/statements/reserve-current-2026-01.pdf', now() - interval '41 days'),
  ('50000000-0000-0000-0000-000000000510', '10000000-0000-0000-0000-000000000104', '2026-02-01', '2026-02-28', 'customers/alex-johnson/statements/reserve-current-2026-02.pdf', now() - interval '12 days'),
  ('50000000-0000-0000-0000-000000000511', '10000000-0000-0000-0000-000000000105', '2025-09-01', '2025-09-30', 'customers/alex-johnson/statements/legacy-saver-2025-09.pdf', now() - interval '132 days'),
  ('50000000-0000-0000-0000-000000000512', '10000000-0000-0000-0000-000000000105', '2025-10-01', '2025-10-31', 'customers/alex-johnson/statements/legacy-saver-2025-10.pdf', now() - interval '102 days'),
  ('50000000-0000-0000-0000-000000000513', '10000000-0000-0000-0000-000000000102', '2026-02-01', '2026-02-28', 'customers/alex-johnson/statements/savings-2026-02.pdf', now() - interval '12 days'),
  ('50000000-0000-0000-0000-000000000514', '10000000-0000-0000-0000-000000000101', '2025-11-01', '2025-11-30', 'customers/alex-johnson/statements/current-2025-11.pdf', now() - interval '101 days')
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
  ('60000000-0000-0000-0000-000000000607', (select customer_user_id from seed_user_ids), 'tax', 'Self-assessment-estimate-2026.pdf', 'customers/alex-johnson/documents/tax/self-assessment-estimate-2026.pdf', now() - interval '44 days'),
  ('60000000-0000-0000-0000-000000000608', (select customer_user_id from seed_user_ids), 'tax', 'Cash-ISA-interest-certificate.pdf', 'customers/alex-johnson/documents/tax/cash-isa-interest-certificate.pdf', now() - interval '35 days'),
  ('60000000-0000-0000-0000-000000000609', (select customer_user_id from seed_user_ids), 'loan', 'Mortgage-illustration.pdf', 'customers/alex-johnson/documents/loan/mortgage-illustration.pdf', now() - interval '58 days'),
  ('60000000-0000-0000-0000-000000000610', (select customer_user_id from seed_user_ids), 'loan', 'Mortgage-direct-debit-confirmation.pdf', 'customers/alex-johnson/documents/loan/mortgage-direct-debit-confirmation.pdf', now() - interval '27 days'),
  ('60000000-0000-0000-0000-000000000611', (select customer_user_id from seed_user_ids), 'letter', 'Proof-of-funds-letter.pdf', 'customers/alex-johnson/documents/letters/proof-of-funds-letter.pdf', now() - interval '9 days'),
  ('60000000-0000-0000-0000-000000000612', (select customer_user_id from seed_user_ids), 'letter', 'Card-replacement-confirmation.pdf', 'customers/alex-johnson/documents/letters/card-replacement-confirmation.pdf', now() - interval '7 days'),
  ('60000000-0000-0000-0000-000000000613', (select customer_user_id from seed_user_ids), 'other', 'Expense-reimbursement-summary.pdf', 'customers/alex-johnson/documents/other/expense-reimbursement-summary.pdf', now() - interval '14 days'),
  ('60000000-0000-0000-0000-000000000614', (select customer_user_id from seed_user_ids), 'other', 'Travel-booking-cover-note.pdf', 'customers/alex-johnson/documents/other/travel-booking-cover-note.pdf', now() - interval '5 days')
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
    '80000000-0000-0000-0000-000000000819',
    (select customer_user_id from seed_user_ids),
    (select staff_user_id from seed_user_ids),
    'Question about archive statements and secure message removal',
    'Category: Other' || E'\n' ||
    'Account: ****2219' || E'\n\n' ||
    'I can still see archived statements for the closed legacy savings account, but I noticed the secure message area now redirects into support. Please confirm the right route for sending general non-urgent questions.',
    'resolved',
    'low',
    now() - interval '3 days',
    now() - interval '2 days'
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
  ('b0000000-0000-0000-0000-000000000b05', 'Canary Wharf Branch', '40 Bank Street, London', 'E14 5NR', 51.5035, -0.0185, '020 7111 2244', '{"mon_fri":"09:00-17:30","sat":"09:00-13:00","sun":"Closed"}'::jsonb, now() - interval '430 days'),
  ('b0000000-0000-0000-0000-000000000b06', 'Islington Branch', '77 Upper Street, London', 'N1 0NY', 51.5373, -0.1034, '020 7222 1166', '{"mon_fri":"09:00-17:00","sat":"09:30-13:00","sun":"Closed"}'::jsonb, now() - interval '390 days'),
  ('b0000000-0000-0000-0000-000000000b07', 'Wimbledon Branch', '18 The Broadway, London', 'SW19 1RE', 51.4215, -0.2061, '020 7333 1188', '{"mon_fri":"09:00-17:00","sat":"09:30-13:00","sun":"Closed"}'::jsonb, now() - interval '360 days')
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
  ('c0000000-0000-0000-0000-000000000c06', 'Your Bank', 'Jubilee Place, Canary Wharf, London', 'E14 5NY', 51.5047, -0.0192, true, now() - interval '180 days'),
  ('c0000000-0000-0000-0000-000000000c07', 'Link', 'Angel Central, London', 'N1 0PS', 51.5337, -0.1064, true, now() - interval '165 days'),
  ('c0000000-0000-0000-0000-000000000c08', 'Your Bank', 'Wimbledon Station Forecourt, London', 'SW19 7NL', 51.4210, -0.2068, true, now() - interval '148 days'),
  ('c0000000-0000-0000-0000-000000000c09', 'Cardtronics', 'Kings Cross Square, London', 'N1C 4AX', 51.5319, -0.1238, false, now() - interval '140 days')
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
  (
    '15000000-0000-0000-0000-000000001515',
    (select customer_user_id from seed_user_ids),
    'beneficiary_added',
    'beneficiaries',
    'e0000000-0000-0000-0000-000000000e07',
    '203.0.113.10',
    jsonb_build_object('bank_name', 'Monzo', 'nickname', 'Emily Carter'),
    now() - interval '118 days'
  ),
  (
    '15000000-0000-0000-0000-000000001516',
    (select customer_user_id from seed_user_ids),
    'bill_payee_saved',
    'bill_payments',
    'f0000000-0000-0000-0000-000000000f05',
    '203.0.113.10',
    jsonb_build_object('frequency', 'monthly', 'reference', 'ELEC-GAS-4412'),
    now() - interval '94 days'
  ),
  (
    '15000000-0000-0000-0000-000000001517',
    (select customer_user_id from seed_user_ids),
    'bill_payment_made',
    'bill_payments',
    'f0000000-0000-0000-0000-000000000f05',
    '203.0.113.10',
    jsonb_build_object('amount_pence', 11240, 'reference', 'ENERGY-MAR26'),
    now() - interval '8 days'
  ),
  (
    '15000000-0000-0000-0000-000000001518',
    (select customer_user_id from seed_user_ids),
    'loan_payment_made',
    'loans',
    '30000000-0000-0000-0000-000000000303',
    '203.0.113.10',
    jsonb_build_object('amount_pence', 95000, 'reference', 'MORT-MAR26'),
    now() - interval '12 days'
  ),
  (
    '15000000-0000-0000-0000-000000001519',
    (select customer_user_id from seed_user_ids),
    'document_downloaded',
    'documents',
    '60000000-0000-0000-0000-000000000611',
    '203.0.113.10',
    jsonb_build_object('filename', 'Proof-of-funds-letter.pdf'),
    now() - interval '6 days'
  ),
  (
    '15000000-0000-0000-0000-000000001520',
    (select customer_user_id from seed_user_ids),
    'alert_preferences_updated',
    'alert_configs',
    null,
    '203.0.113.10',
    jsonb_build_object('large_transaction_threshold_pence', 75000, 'low_balance_threshold_pence', 10000),
    now() - interval '4 days'
  ),
  (
    '15000000-0000-0000-0000-000000001521',
    (select customer_user_id from seed_user_ids),
    'support_ticket_created',
    'support_tickets',
    '80000000-0000-0000-0000-000000000819',
    '203.0.113.10',
    jsonb_build_object('category', 'Other'),
    now() - interval '3 days'
  ),
  (
    '15000000-0000-0000-0000-000000001522',
    (select staff_user_id from seed_user_ids),
    'cheque_approved',
    'check_images',
    '90000000-0000-0000-0000-000000000920',
    '198.51.100.42',
    jsonb_build_object('amount_pence', 48750),
    now() - interval '15 days'
  ),
  (
    '15000000-0000-0000-0000-000000001523',
    (select customer_user_id from seed_user_ids),
    'card_frozen',
    'cards',
    '20000000-0000-0000-0000-000000000205',
    '203.0.113.10',
    jsonb_build_object('reason', 'travel_fraud_review'),
    now() - interval '71 days'
  ),
  (
    '15000000-0000-0000-0000-000000001524',
    (select customer_user_id from seed_user_ids),
    'branch_locator_viewed',
    'branches',
    'b0000000-0000-0000-0000-000000000b05',
    '203.0.113.10',
    jsonb_build_object('surface', 'locate'),
    now() - interval '2 days'
  ),
  (
    '15000000-0000-0000-0000-000000001525',
    (select customer_user_id from seed_user_ids),
    'statement_downloaded',
    'statements',
    '50000000-0000-0000-0000-000000000510',
    '203.0.113.10',
    jsonb_build_object('period_end', '2026-02-28'),
    now() - interval '2 days'
  ),
  (
    '15000000-0000-0000-0000-000000001526',
    (select customer_user_id from seed_user_ids),
    'profile_updated',
    'profiles',
    (select customer_user_id from seed_user_ids),
    '203.0.113.10',
    jsonb_build_object('fields', jsonb_build_array('phone')),
    now() - interval '1 day'
  )
on conflict (id) do nothing;
