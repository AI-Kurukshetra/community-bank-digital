-- Additional demo data for admin operations views.
-- This migration expands support, fraud, and cheque queues with enough
-- volume to exercise the dashboard, customer detail page, and review flows.

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
    '80000000-0000-0000-0000-000000000805',
    (select customer_user_id from seed_user_ids),
    null,
    'Card replacement after travel fraud alert',
    'Category: Cards' || E'\n' ||
    'My primary debit card was frozen after a travel transaction review. Please confirm replacement timescales before I leave again next week.',
    'open',
    'high',
    now() - interval '6 hours',
    now() - interval '6 hours'
  ),
  (
    '80000000-0000-0000-0000-000000000806',
    (select customer_user_id from seed_user_ids),
    (select staff_user_id from seed_user_ids),
    'Standing order not appearing in payment schedule',
    'Category: Payments' || E'\n' ||
    'A new standing order to my landlord was created yesterday, but it is not visible in the upcoming payments screen. Please confirm it was saved.',
    'in_progress',
    'medium',
    now() - interval '2 days',
    now() - interval '18 hours'
  ),
  (
    '80000000-0000-0000-0000-000000000807',
    (select customer_user_id from seed_user_ids),
    null,
    'Need branch letter for proof of address',
    'Category: Statements' || E'\n' ||
    'I need a branch-stamped letter confirming my current address for a visa application. Please advise the fastest route.',
    'open',
    'low',
    now() - interval '5 days',
    now() - interval '5 days'
  ),
  (
    '80000000-0000-0000-0000-000000000808',
    (select customer_user_id from seed_user_ids),
    (select staff_user_id from seed_user_ids),
    'Cheque image uploaded sideways',
    'Category: Payments' || E'\n' ||
    'The cheque preview in the app looks rotated and I am not sure whether it is still readable enough for processing.',
    'resolved',
    'low',
    now() - interval '12 days',
    now() - interval '10 days'
  ),
  (
    '80000000-0000-0000-0000-000000000809',
    (select customer_user_id from seed_user_ids),
    (select admin_user_id from seed_user_ids),
    'Unauthorised cash withdrawal dispute',
    'Category: Fraud' || E'\n' ||
    'I do not recognise a cash withdrawal showing overnight on my current account. Please freeze the card if needed and start a dispute.',
    'in_progress',
    'high',
    now() - interval '8 days',
    now() - interval '1 day'
  ),
  (
    '80000000-0000-0000-0000-000000000810',
    (select customer_user_id from seed_user_ids),
    null,
    'Profile phone number still shows old branch record',
    'Category: Profile' || E'\n' ||
    'My updated phone number shows correctly in the app, but branch staff still read the old one back to me during a call.',
    'open',
    'low',
    now() - interval '9 days',
    now() - interval '9 days'
  ),
  (
    '80000000-0000-0000-0000-000000000811',
    (select customer_user_id from seed_user_ids),
    (select staff_user_id from seed_user_ids),
    'Need transfer limit increased for house deposit',
    'Category: Payments' || E'\n' ||
    'I need to move a larger amount than the current digital transfer limit will allow. Please advise how to increase or stage the payment.',
    'in_progress',
    'high',
    now() - interval '14 days',
    now() - interval '3 days'
  ),
  (
    '80000000-0000-0000-0000-000000000812',
    (select customer_user_id from seed_user_ids),
    (select staff_user_id from seed_user_ids),
    'Paper statement request for mortgage broker',
    'Category: Statements' || E'\n' ||
    'My mortgage broker needs a stamped paper statement covering the last three months. Please confirm whether this can be mailed or collected.',
    'resolved',
    'medium',
    now() - interval '22 days',
    now() - interval '19 days'
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
  ('90000000-0000-0000-0000-000000000904', (select customer_user_id from seed_user_ids), '10000000-0000-0000-0000-000000000101', 'cheques/alex-johnson/20260313-school-refund.png', 46800, 'pending', null, now() - interval '16 hours'),
  ('90000000-0000-0000-0000-000000000905', (select customer_user_id from seed_user_ids), '10000000-0000-0000-0000-000000000101', 'cheques/alex-johnson/20260311-client-expense.jpg', 92500, 'pending', null, now() - interval '3 days'),
  ('90000000-0000-0000-0000-000000000906', (select customer_user_id from seed_user_ids), '10000000-0000-0000-0000-000000000101', 'cheques/alex-johnson/20260310-charity-reimbursement.png', 28750, 'pending', null, now() - interval '4 days'),
  ('90000000-0000-0000-0000-000000000907', (select customer_user_id from seed_user_ids), '10000000-0000-0000-0000-000000000101', 'cheques/alex-johnson/20260308-insurance-payout.png', 164000, 'pending', null, now() - interval '6 days'),
  ('90000000-0000-0000-0000-000000000908', (select customer_user_id from seed_user_ids), '10000000-0000-0000-0000-000000000101', 'cheques/alex-johnson/20260307-travel-claim.jpg', 35200, 'pending', null, now() - interval '7 days'),
  ('90000000-0000-0000-0000-000000000909', (select customer_user_id from seed_user_ids), '10000000-0000-0000-0000-000000000101', 'cheques/alex-johnson/20260305-tax-rebate.png', 121500, 'pending', null, now() - interval '9 days'),
  ('90000000-0000-0000-0000-000000000910', (select customer_user_id from seed_user_ids), '10000000-0000-0000-0000-000000000101', 'cheques/alex-johnson/20260301-childcare-credit.jpg', 19800, 'pending', null, now() - interval '13 days'),
  ('90000000-0000-0000-0000-000000000911', (select customer_user_id from seed_user_ids), '10000000-0000-0000-0000-000000000101', 'cheques/alex-johnson/20260225-contractor-refund.png', 55000, 'processed', null, now() - interval '18 days'),
  ('90000000-0000-0000-0000-000000000912', (select customer_user_id from seed_user_ids), '10000000-0000-0000-0000-000000000101', 'cheques/alex-johnson/20260223-club-dues.jpg', 14600, 'processed', null, now() - interval '20 days'),
  ('90000000-0000-0000-0000-000000000913', (select customer_user_id from seed_user_ids), '10000000-0000-0000-0000-000000000101', 'cheques/alex-johnson/20260220-medical-refund.png', 88100, 'processed', null, now() - interval '23 days'),
  ('90000000-0000-0000-0000-000000000914', (select customer_user_id from seed_user_ids), '10000000-0000-0000-0000-000000000101', 'cheques/alex-johnson/20260218-event-refund.jpg', 42000, 'rejected', 'Signature line was cropped out of the uploaded image.', now() - interval '25 days'),
  ('90000000-0000-0000-0000-000000000915', (select customer_user_id from seed_user_ids), '10000000-0000-0000-0000-000000000101', 'cheques/alex-johnson/20260215-retail-rebate.png', 27500, 'rejected', 'Cheque date was not legible in the submitted image.', now() - interval '28 days')
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
    'a0000000-0000-0000-0000-000000000a04',
    (select customer_user_id from seed_user_ids),
    'd0000000-0000-0000-0000-000000000d05',
    'Repeated card-not-present grocery pattern triggered manual review',
    'flagged',
    null,
    now() - interval '2 days'
  ),
  (
    'a0000000-0000-0000-0000-000000000a05',
    (select customer_user_id from seed_user_ids),
    'd0000000-0000-0000-0000-000000000d16',
    'Multiple pharmacy attempts in a short time window',
    'flagged',
    null,
    now() - interval '9 days'
  ),
  (
    'a0000000-0000-0000-0000-000000000a06',
    (select customer_user_id from seed_user_ids),
    'd0000000-0000-0000-0000-000000000d04',
    'Rent payment verified after customer callback',
    'dismissed',
    (select staff_user_id from seed_user_ids),
    now() - interval '36 days'
  ),
  (
    'a0000000-0000-0000-0000-000000000a07',
    (select customer_user_id from seed_user_ids),
    'd0000000-0000-0000-0000-000000000d11',
    'Large transfer confirmed as authorised educational payment',
    'dismissed',
    (select admin_user_id from seed_user_ids),
    now() - interval '45 days'
  ),
  (
    'a0000000-0000-0000-0000-000000000a08',
    (select customer_user_id from seed_user_ids),
    'd0000000-0000-0000-0000-000000000d14',
    'Travel merchant pattern remains under investigation',
    'confirmed',
    (select admin_user_id from seed_user_ids),
    now() - interval '60 days'
  )
on conflict (id) do nothing;
