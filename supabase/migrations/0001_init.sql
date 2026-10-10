-- =====================================================================
-- 0001_init.sql — SkylineSOS Core DDL
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- Custom types
do $$ begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('admin', 'treasurer', 'door', 'volunteer', 'member');
  end if;
  if not exists (select 1 from pg_type where typname = 'pay_method') then
    create type pay_method as enum ('online', 'cash', 'manual_upi');
  end if;
  if not exists (select 1 from pg_type where typname = 'item_type') then
    create type item_type as enum ('ticket', 'merch', 'membership');
  end if;
end $$;

-- 1. Profiles & Roles
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(full_name) between 2 and 80),
  email text not null unique,
  student_id text unique,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists user_roles (
  user_id uuid primary key references profiles(id) on delete cascade,
  role app_role not null default 'member',
  granted_by uuid references profiles(id),
  granted_at timestamptz not null default now()
);
create index if not exists idx_user_roles_role on user_roles(role);

create table if not exists app_settings (
  key text primary key,
  value jsonb not null
);

-- 2. Membership
create table if not exists membership_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  fee_paise int not null check (fee_paise >= 0),
  duration_days int not null check (duration_days > 0),
  discount_percent int not null default 0 check (discount_percent between 0 and 100),
  benefits text[] not null default '{}',
  is_active boolean not null default true
);

create table if not exists membership_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  tier_id uuid not null references membership_tiers(id),
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'rejected', 'withdrawn')),
  revision int not null default 1,
  answers jsonb not null default '{}',
  submitted_at timestamptz,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_membership_applications_user on membership_applications(user_id);
create index if not exists idx_membership_applications_tier on membership_applications(tier_id);
create unique index if not exists one_open_application on membership_applications(user_id) where status in ('draft', 'pending', 'approved');

create table if not exists membership_application_reviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references membership_applications(id) on delete cascade,
  revision int not null,
  reviewer_id uuid not null references profiles(id),
  decision text not null check (decision in ('approved', 'rejected')),
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_application_reviews_app on membership_application_reviews(application_id);

create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  tier_id uuid not null references membership_tiers(id),
  application_id uuid references membership_applications(id),
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  starts_on date not null,
  expires_on date not null check (expires_on > starts_on),
  checkout_id uuid
);
create index if not exists idx_memberships_user_expiry on memberships(user_id, expires_on desc);
create index if not exists idx_memberships_tier on memberships(tier_id);

create table if not exists member_codes (
  user_id uuid primary key references profiles(id) on delete cascade,
  code char(6) not null unique,
  expires_at timestamptz not null
);

-- 3. Events & Tickets
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  venue text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  capacity int not null check (capacity > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled', 'completed')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_events_status_starts on events(status, starts_at);

create table if not exists ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  price_paise int not null check (price_paise >= 0),
  member_price_paise int check (member_price_paise >= 0),
  member_only boolean not null default false,
  quantity_limit int not null check (quantity_limit > 0),
  sales_start timestamptz,
  sales_end timestamptz
);
create index if not exists idx_ticket_types_event on ticket_types(event_id);

-- 4. Merch
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'archived'))
);

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  sku text not null unique,
  label text not null,
  price_paise int not null check (price_paise >= 0),
  stock_on_hand int not null check (stock_on_hand >= 0),
  reserved int not null default 0 check (reserved >= 0),
  check (reserved <= stock_on_hand)
);
create index if not exists idx_product_variants_prod on product_variants(product_id);

-- 5. Checkouts & Payments
create table if not exists checkouts (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references profiles(id),
  status text not null default 'pending' check (status in ('pending', 'paid', 'fulfilled', 'expired', 'failed', 'cancelled')),
  payment_method pay_method not null,
  subtotal_paise int not null check (subtotal_paise >= 0),
  discount_paise int not null default 0 check (discount_paise >= 0),
  total_paise int not null check (total_paise >= 0),
  verification text check (verification in ('razorpay_verified', 'staff_recorded')),
  recorded_by uuid references profiles(id),
  note text,
  idempotency_key text not null unique,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  check (payment_method = 'online' or (recorded_by is not null and note is not null))
);
create index if not exists idx_checkouts_buyer on checkouts(buyer_id);
create index if not exists idx_checkouts_status_expires on checkouts(status, expires_at);

create table if not exists checkout_items (
  id uuid primary key default gen_random_uuid(),
  checkout_id uuid not null references checkouts(id) on delete cascade,
  item_type item_type not null,
  ref_id uuid not null,
  quantity int not null check (quantity > 0),
  unit_price_paise int not null check (unit_price_paise >= 0),
  discount_paise int not null default 0 check (discount_paise >= 0),
  fulfilment_status text not null default 'pending' check (fulfilment_status in ('pending', 'packed', 'handed_over', 'n/a'))
);
create index if not exists idx_checkout_items_checkout on checkout_items(checkout_id);
create index if not exists idx_checkout_items_ref on checkout_items(ref_id);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  checkout_id uuid not null references checkouts(id) on delete cascade,
  provider text not null default 'razorpay',
  mode text not null default 'test',
  provider_order_id text unique,
  provider_payment_id text unique,
  amount_paise int not null,
  status text not null default 'created' check (status in ('created', 'captured', 'failed')),
  created_at timestamptz not null default now()
);
create index if not exists idx_payments_checkout on payments(checkout_id);

create table if not exists webhook_events (
  provider_event_id text primary key,
  event_type text not null,
  payload_hash text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

-- 6. Tickets & Check-Ins
create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  checkout_item_id uuid not null references checkout_items(id),
  event_id uuid not null references events(id),
  ticket_type_id uuid not null references ticket_types(id),
  owner_id uuid not null references profiles(id),
  holder_name text not null,
  code text not null unique,
  status text not null default 'issued' check (status in ('issued', 'checked_in', 'cancelled')),
  issued_at timestamptz not null default now()
);
create index if not exists idx_tickets_event_status on tickets(event_id, status);
create index if not exists idx_tickets_owner on tickets(owner_id);
create index if not exists idx_tickets_code on tickets(code);

create table if not exists check_ins (
  ticket_id uuid primary key references tickets(id) on delete cascade,
  staff_id uuid not null references profiles(id),
  checked_in_at timestamptz not null default now()
);

-- 7. Announcements, Preferences & Notifications
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text not null check (audience in ('public', 'members', 'staff')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  author_id uuid references profiles(id),
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_announcements_audience_status on announcements(audience, status, published_at desc);

create table if not exists mailing_preferences (
  user_id uuid references profiles(id) on delete cascade,
  topic text not null check (topic in ('events', 'merch', 'fundraisers', 'general')),
  opted_in boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, topic)
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  dedupe_key text not null unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on notifications(user_id, created_at desc);

-- 8. Fundraisers & Tasks
create table if not exists fundraisers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  goal_paise int not null check (goal_paise > 0),
  starts_on date,
  ends_on date,
  status text not null default 'active' check (status in ('active', 'closed')),
  owner_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  fundraiser_id uuid not null references fundraisers(id) on delete cascade,
  title text not null,
  assignee_id uuid references profiles(id),
  due_on date,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'cancelled')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_tasks_fundraiser on tasks(fundraiser_id);
create index if not exists idx_tasks_assignee on tasks(assignee_id);

create table if not exists contributions (
  id uuid primary key default gen_random_uuid(),
  fundraiser_id uuid not null references fundraisers(id),
  amount_paise int not null check (amount_paise > 0),
  method text not null check (method in ('cash', 'manual_upi')),
  note text not null,
  recorded_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_contributions_fundraiser on contributions(fundraiser_id);

-- 9. Expenses
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  amount_paise int not null check (amount_paise > 0),
  category text not null,
  description text not null,
  submitted_by uuid not null references profiles(id),
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected', 'paid')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  reject_reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_expenses_submitted on expenses(submitted_by);
create index if not exists idx_expenses_status on expenses(status);

-- 10. Ledger (Append-only & Immutable)
create table if not exists ledger_entries (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('in', 'out')),
  amount_paise int not null check (amount_paise >= 0),
  category text not null check (category in ('dues', 'tickets', 'merch', 'fundraiser', 'expense', 'refund')),
  method text not null check (method in ('online_test', 'cash', 'manual_upi')),
  source_type text not null check (source_type in ('checkout_item', 'contribution', 'expense', 'reversal')),
  source_id uuid not null,
  memo text,
  effective_on date not null default current_date,
  reverses_id uuid references ledger_entries(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (source_type, source_id)
);
create index if not exists idx_ledger_entries_effective on ledger_entries(effective_on desc);
create index if not exists idx_ledger_entries_category on ledger_entries(category);

-- Prevent update/delete on ledger_entries
create or replace function trg_protect_ledger() returns trigger language plpgsql as $$
begin
  raise exception 'LEDGER_IMMUTABLE: ledger entries cannot be updated or deleted';
end;
$$;

drop trigger if exists protect_ledger_entries on ledger_entries;
create trigger protect_ledger_entries
before update or delete on ledger_entries
for each row execute function trg_protect_ledger();

-- 11. Audit Logs & Rate Limits
create table if not exists audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity_type text,
  entity_id text,
  meta jsonb not null default '{}',
  request_id text,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_logs_created on audit_logs(created_at desc);
create index if not exists idx_audit_logs_actor on audit_logs(actor_id);

create table if not exists rate_limits (
  key text not null,
  bucket bigint not null,
  count int not null default 0,
  primary key (key, bucket)
);

-- 12. New User Registration Trigger
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.profiles (id, full_name, email, student_id, is_demo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'student_id',
    coalesce((new.raw_user_meta_data->>'is_demo')::boolean, false)
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email;

  insert into public.user_roles (user_id, role)
  values (new.id, 'member')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();
