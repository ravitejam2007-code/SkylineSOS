-- =====================================================================
-- 0003_functions.sql — SkylineSOS Atomic Postgres RPC Functions
-- All functions are SECURITY DEFINER with search_path = public, extensions
-- =====================================================================

-- 1. Ticket Code Generator (Crockford base32: 0123456789ABCDEFGHJKMNPQRSTVWXYZ)
create or replace function gen_ticket_code()
returns text language plpgsql as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  b bytea := extensions.gen_random_bytes(8);
  s text := '';
  i int;
begin
  for i in 0..7 loop
    s := s || substr(alphabet, (get_byte(b, i) & 31) + 1, 1);
  end loop;
  return 'SKY-' || substr(s, 1, 4) || '-' || substr(s, 5, 4);
end;
$$;

-- 2. Database-backed Rate Limiter
create or replace function fn_rate_limit(
  p_key text,
  p_limit int,
  p_window_sec int default 60
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_bucket bigint;
  v_count int;
begin
  v_bucket := floor(extract(epoch from clock_timestamp()) / p_window_sec)::bigint;

  insert into rate_limits (key, bucket, count)
  values (p_key, v_bucket, 1)
  on conflict (key, bucket) do update set count = rate_limits.count + 1
  returning count into v_count;

  -- Opportunistically clean up buckets older than 1 hour
  delete from rate_limits
  where bucket < (v_bucket - (3600 / p_window_sec));

  return v_count <= p_limit;
end;
$$;

-- 3. Issue 60-Second Dynamic Member Code
create or replace function fn_issue_member_code(
  p_user_id uuid,
  p_ttl_seconds int default 60
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_active boolean;
  v_code text;
  v_expires_at timestamptz;
  v_attempts int := 0;
begin
  -- Validate active membership
  select exists(
    select 1 from memberships
    where user_id = p_user_id
      and status = 'active'
      and expires_on >= current_date
  ) into v_active;

  if not v_active then
    raise exception 'NO_ACTIVE_MEMBERSHIP: user does not have an active membership';
  end if;

  v_expires_at := clock_timestamp() + (p_ttl_seconds || ' seconds')::interval;

  loop
    v_attempts := v_attempts + 1;
    -- Generate 6 random digits
    v_code := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');

    begin
      insert into member_codes (user_id, code, expires_at)
      values (p_user_id, v_code, v_expires_at)
      on conflict (user_id) do update set
        code = excluded.code,
        expires_at = excluded.expires_at;
      exit;
    exception when unique_violation then
      if v_attempts >= 5 then
        raise exception 'CODE_COLLISION: could not generate unique member code';
      end if;
    end;
  end loop;

  return jsonb_build_object('code', v_code, 'expires_at', v_expires_at);
end;
$$;

-- 4. Verify 6-Digit Member Code at Door / Desk
create or replace function fn_verify_member_code(
  p_code text,
  p_staff_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid;
  v_result jsonb;
begin
  select user_id into v_user_id
  from member_codes
  where code = trim(p_code)
    and expires_at > clock_timestamp();

  if v_user_id is null then
    -- Audit failed verification attempt
    insert into audit_logs (actor_id, action, entity_type, meta)
    values (p_staff_id, 'member_code_verification_failed', 'member_code', jsonb_build_object('code', p_code));

    raise exception 'CODE_INVALID: verification code is invalid or expired';
  end if;

  select jsonb_build_object(
    'name', p.full_name,
    'tier', t.name,
    'status', m.status,
    'expires_on', m.expires_on,
    'discount_percent', t.discount_percent
  ) into v_result
  from memberships m
  join profiles p on p.id = m.user_id
  join membership_tiers t on t.id = m.tier_id
  where m.user_id = v_user_id
    and m.status = 'active'
    and m.expires_on >= current_date
  order by m.expires_on desc
  limit 1;

  if v_result is null then
    raise exception 'CODE_INVALID: user membership has expired or is cancelled';
  end if;

  -- Audit successful verification
  insert into audit_logs (actor_id, action, entity_type, entity_id, meta)
  values (p_staff_id, 'member_verified', 'profile', v_user_id::text, v_result);

  return v_result;
end;
$$;

-- 5. Create Checkout (Atomic Price & Capacity Check)
create or replace function fn_create_checkout(
  p_buyer_id uuid,
  p_items jsonb,
  p_method text,
  p_idem_key text,
  p_recorded_by uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_existing checkouts%rowtype;
  v_checkout_id uuid;
  v_subtotal int := 0;
  v_discount int := 0;
  v_total int := 0;
  v_expires_at timestamptz;
  v_has_active_membership boolean;
  v_user_tier_discount int := 0;
  v_item jsonb;
  v_type text;
  v_ref_id uuid;
  v_qty int;
  v_unit_price int;
  v_item_discount int;
  v_event events%rowtype;
  v_tt ticket_types%rowtype;
  v_variant product_variants%rowtype;
  v_tier membership_tiers%rowtype;
  v_sold_count int;
  v_pending_count int;
begin
  -- 1. Idempotency replay check
  select * into v_existing from checkouts where idempotency_key = p_idem_key;
  if found then
    return to_jsonb(v_existing);
  end if;

  -- 2. Membership status of buyer
  select exists(
    select 1 from memberships
    where user_id = p_buyer_id
      and status = 'active'
      and expires_on >= current_date
  ) into v_has_active_membership;

  if v_has_active_membership then
    select t.discount_percent into v_user_tier_discount
    from memberships m
    join membership_tiers t on t.id = m.tier_id
    where m.user_id = p_buyer_id and m.status = 'active' and m.expires_on >= current_date
    order by m.expires_on desc limit 1;
  end if;

  v_checkout_id := gen_random_uuid();
  if p_method = 'online' then
    v_expires_at := clock_timestamp() + interval '15 minutes';
  else
    v_expires_at := null;
  end if;

  -- 3. Validate items and compute totals
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_type := v_item->>'itemType';
    v_ref_id := (v_item->>'refId')::uuid;
    v_qty := (v_item->>'quantity')::int;

    if v_qty <= 0 then
      raise exception 'VALIDATION_FAILED: quantity must be positive';
    end if;

    if v_type = 'ticket' then
      select * into v_tt from ticket_types where id = v_ref_id for update;
      if not found then raise exception 'TICKET_NOT_FOUND: ticket type not found'; end if;

      select * into v_event from events where id = v_tt.event_id for update;
      if v_event.status != 'published' then raise exception 'CONFLICT: event is not published'; end if;
      if v_tt.member_only and not v_has_active_membership then
        raise exception 'MEMBER_ONLY: this ticket requires an active membership';
      end if;

      -- Resolve price
      if v_has_active_membership and v_tt.member_price_paise is not null then
        v_unit_price := v_tt.member_price_paise;
      else
        v_unit_price := v_tt.price_paise;
      end if;
      v_item_discount := 0;

      -- Capacity check
      select count(*) into v_sold_count from tickets where ticket_type_id = v_tt.id and status != 'cancelled';
      select coalesce(sum(ci.quantity), 0) into v_pending_count
      from checkout_items ci
      join checkouts c on c.id = ci.checkout_id
      where ci.ref_id = v_tt.id and c.status = 'pending' and c.expires_at > clock_timestamp();

      if (v_sold_count + v_pending_count + v_qty) > v_tt.quantity_limit then
        raise exception 'CAPACITY_EXCEEDED: ticket type sold out';
      end if;

    elsif v_type = 'merch' then
      select * into v_variant from product_variants where id = v_ref_id for update;
      if not found then raise exception 'NOT_FOUND: product variant not found'; end if;

      if (v_variant.stock_on_hand - v_variant.reserved) < v_qty then
        raise exception 'OUT_OF_STOCK: item out of stock';
      end if;

      -- Reserve inventory
      update product_variants set reserved = reserved + v_qty where id = v_variant.id;

      v_unit_price := v_variant.price_paise;
      if v_has_active_membership and v_user_tier_discount > 0 then
        v_item_discount := floor((v_unit_price * v_user_tier_discount) / 100)::int;
      else
        v_item_discount := 0;
      end if;

    elsif v_type = 'membership' then
      select * into v_tier from membership_tiers where id = v_ref_id for update;
      if not found then raise exception 'NOT_FOUND: membership tier not found'; end if;

      -- Check if already has >= 30 days left
      if exists(
        select 1 from memberships
        where user_id = p_buyer_id and status = 'active' and expires_on > (current_date + interval '30 days')
      ) then
        raise exception 'ALREADY_MEMBER: membership is already active with >= 30 days remaining';
      end if;

      v_unit_price := v_tier.fee_paise;
      v_item_discount := 0;
    else
      raise exception 'VALIDATION_FAILED: unknown item type %', v_type;
    end if;

    v_subtotal := v_subtotal + (v_unit_price * v_qty);
    v_discount := v_discount + (v_item_discount * v_qty);

    insert into checkout_items (
      checkout_id, item_type, ref_id, quantity, unit_price_paise, discount_paise
    ) values (
      v_checkout_id, v_type::item_type, v_ref_id, v_qty, v_unit_price, v_item_discount
    );
  end loop;

  v_total := greatest(0, v_subtotal - v_discount);

  insert into checkouts (
    id, buyer_id, status, payment_method, subtotal_paise, discount_paise, total_paise,
    recorded_by, note, idempotency_key, expires_at
  ) values (
    v_checkout_id, p_buyer_id, 'pending', p_method::pay_method, v_subtotal, v_discount, v_total,
    p_recorded_by, p_note, p_idem_key, v_expires_at
  );

  select * into v_existing from checkouts where id = v_checkout_id;
  return to_jsonb(v_existing);
end;
$$;

-- 6. Fulfil Checkout (Idempotent: issues tickets, decrements inventory, posts to ledger)
create or replace function fn_fulfil_checkout(
  p_checkout_id uuid,
  p_verification text,
  p_actor uuid default null,
  p_effective_on date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_checkout checkouts%rowtype;
  v_item checkout_items%rowtype;
  v_buyer profiles%rowtype;
  v_ticket_code text;
  v_i int;
  v_tt ticket_types%rowtype;
  v_tier membership_tiers%rowtype;
  v_starts_on date;
  v_expires_on date;
  v_current_expiry date;
  v_ledger_method text;
begin
  select * into v_checkout from checkouts where id = p_checkout_id for update;
  if not found then raise exception 'NOT_FOUND: checkout % not found', p_checkout_id; end if;

  -- Idempotency check: if already fulfilled/paid, return as-is
  if v_checkout.status in ('paid', 'fulfilled') then
    return jsonb_build_object('id', v_checkout.id, 'status', v_checkout.status, 'idempotent', true);
  end if;

  if v_checkout.status != 'pending' then
    raise exception 'CHECKOUT_NOT_PENDING: checkout is %', v_checkout.status;
  end if;

  select * into v_buyer from profiles where id = v_checkout.buyer_id;

  -- Map ledger method
  if v_checkout.payment_method = 'online' then
    v_ledger_method := 'online_test';
  elsif v_checkout.payment_method = 'cash' then
    v_ledger_method := 'cash';
  else
    v_ledger_method := 'manual_upi';
  end if;

  update checkouts set
    status = 'paid',
    verification = p_verification,
    paid_at = clock_timestamp()
  where id = p_checkout_id;

  for v_item in select * from checkout_items where checkout_id = p_checkout_id loop
    if v_item.item_type = 'ticket' then
      select * into v_tt from ticket_types where id = v_item.ref_id;

      for v_i in 1..v_item.quantity loop
        v_ticket_code := gen_ticket_code();
        insert into tickets (
          checkout_item_id, event_id, ticket_type_id, owner_id, holder_name, code, status
        ) values (
          v_item.id, v_tt.event_id, v_tt.id, v_checkout.buyer_id, v_buyer.full_name, v_ticket_code, 'issued'
        );
      end loop;

      -- Post to ledger (skip if free)
      if (v_item.unit_price_paise * v_item.quantity - v_item.discount_paise) > 0 then
        insert into ledger_entries (
          direction, amount_paise, category, method, source_type, source_id, memo, effective_on, created_by
        ) values (
          'in', (v_item.unit_price_paise * v_item.quantity - v_item.discount_paise),
          'tickets', v_ledger_method::pay_method_mapped, 'checkout_item', v_item.id,
          'Ticket purchase: ' || v_tt.name, p_effective_on, coalesce(p_actor, v_checkout.recorded_by, v_checkout.buyer_id)
        ) on conflict (source_type, source_id) do nothing;
      end if;

    elsif v_item.item_type = 'merch' then
      -- Deduct stock and release reserved
      update product_variants set
        stock_on_hand = stock_on_hand - v_item.quantity,
        reserved = reserved - v_item.quantity
      where id = v_item.ref_id;

      -- Post to ledger
      if (v_item.unit_price_paise * v_item.quantity - v_item.discount_paise) > 0 then
        insert into ledger_entries (
          direction, amount_paise, category, method, source_type, source_id, memo, effective_on, created_by
        ) values (
          'in', (v_item.unit_price_paise * v_item.quantity - v_item.discount_paise),
          'merch', v_ledger_method::pay_method_mapped, 'checkout_item', v_item.id,
          'Merchandise purchase', p_effective_on, coalesce(p_actor, v_checkout.recorded_by, v_checkout.buyer_id)
        ) on conflict (source_type, source_id) do nothing;
      end if;

    elsif v_item.item_type = 'membership' then
      select * into v_tier from membership_tiers where id = v_item.ref_id;

      select max(expires_on) into v_current_expiry
      from memberships where user_id = v_checkout.buyer_id and status = 'active';

      if v_current_expiry is not null and v_current_expiry > current_date then
        v_starts_on := v_current_expiry;
      else
        v_starts_on := current_date;
      end if;
      v_expires_on := v_starts_on + (v_tier.duration_days || ' days')::interval;

      insert into memberships (
        user_id, tier_id, status, starts_on, expires_on, checkout_id
      ) values (
        v_checkout.buyer_id, v_tier.id, 'active', v_starts_on, v_expires_on, v_checkout.id
      );

      -- Post to ledger
      if (v_item.unit_price_paise * v_item.quantity - v_item.discount_paise) > 0 then
        insert into ledger_entries (
          direction, amount_paise, category, method, source_type, source_id, memo, effective_on, created_by
        ) values (
          'in', (v_item.unit_price_paise * v_item.quantity - v_item.discount_paise),
          'dues', v_ledger_method::pay_method_mapped, 'checkout_item', v_item.id,
          'Membership dues: ' || v_tier.name, p_effective_on, coalesce(p_actor, v_checkout.recorded_by, v_checkout.buyer_id)
        ) on conflict (source_type, source_id) do nothing;
      end if;
    end if;
  end loop;

  update checkouts set status = 'fulfilled' where id = p_checkout_id;

  -- Write audit log
  insert into audit_logs (actor_id, action, entity_type, entity_id, meta)
  values (
    coalesce(p_actor, v_checkout.recorded_by, v_checkout.buyer_id),
    'checkout_fulfilled', 'checkout', p_checkout_id::text,
    jsonb_build_object('total_paise', v_checkout.total_paise, 'method', v_checkout.payment_method)
  );

  return jsonb_build_object('id', p_checkout_id, 'status', 'fulfilled');
end;
$$;

-- 7. Record Staff Checkout (Atomic create + fulfil)
create or replace function fn_record_staff_checkout(
  p_buyer_id uuid,
  p_items jsonb,
  p_method text,
  p_recorded_by uuid,
  p_note text,
  p_idem_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_co jsonb;
  v_co_id uuid;
begin
  if p_note is null or length(trim(p_note)) = 0 then
    raise exception 'NOTE_REQUIRED: verification note required for staff checkout';
  end if;

  v_co := fn_create_checkout(p_buyer_id, p_items, p_method, p_idem_key, p_recorded_by, p_note);
  v_co_id := (v_co->>'id')::uuid;

  return fn_fulfil_checkout(v_co_id, 'staff_recorded', p_recorded_by);
end;
$$;

-- 8. Single-Use Ticket Check-In
create or replace function fn_check_in(
  p_event_id uuid,
  p_code text,
  p_staff_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_ticket tickets%rowtype;
  v_event events%rowtype;
  v_tt ticket_types%rowtype;
  v_existing_ci check_ins%rowtype;
begin
  select * into v_ticket from tickets where code = trim(p_code) for update;
  if not found then
    raise exception 'TICKET_NOT_FOUND: no ticket matches code %', p_code;
  end if;

  if p_event_id is not null and v_ticket.event_id != p_event_id then
    raise exception 'WRONG_EVENT: ticket is for another event';
  end if;

  if v_ticket.status = 'cancelled' then
    raise exception 'TICKET_CANCELLED: ticket has been cancelled';
  end if;

  if v_ticket.status = 'checked_in' then
    select * into v_existing_ci from check_ins where ticket_id = v_ticket.id;
    raise exception 'TICKET_ALREADY_CHECKED_IN: checked in at %', v_existing_ci.checked_in_at;
  end if;

  insert into check_ins (ticket_id, staff_id, checked_in_at)
  values (v_ticket.id, p_staff_id, clock_timestamp());

  update tickets set status = 'checked_in' where id = v_ticket.id;

  select * into v_event from events where id = v_ticket.event_id;
  select * into v_tt from ticket_types where id = v_ticket.ticket_type_id;

  -- Audit log
  insert into audit_logs (actor_id, action, entity_type, entity_id, meta)
  values (
    p_staff_id, 'ticket_checked_in', 'ticket', v_ticket.id::text,
    jsonb_build_object('event_title', v_event.title, 'holder_name', v_ticket.holder_name)
  );

  return jsonb_build_object(
    'ticket_id', v_ticket.id,
    'holder_name', v_ticket.holder_name,
    'ticket_type', v_tt.name,
    'event_title', v_event.title,
    'checked_in_at', clock_timestamp()
  );
end;
$$;

-- 9. Expire Stale Checkouts (Cron job every minute)
create or replace function fn_expire_checkouts()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_co checkouts%rowtype;
  v_item checkout_items%rowtype;
begin
  for v_co in
    select * from checkouts
    where status = 'pending' and expires_at is not null and expires_at <= clock_timestamp()
    for update
  loop
    -- Release inventory
    for v_item in select * from checkout_items where checkout_id = v_co.id and item_type = 'merch' loop
      update product_variants set reserved = greatest(0, reserved - v_item.quantity)
      where id = v_item.ref_id;
    end loop;

    update checkouts set status = 'expired' where id = v_co.id;
  end loop;
end;
$$;

-- 10. Review Application
create or replace function fn_review_application(
  p_application_id uuid,
  p_reviewer_id uuid,
  p_decision text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_app membership_applications%rowtype;
  v_tier membership_tiers%rowtype;
begin
  select * into v_app from membership_applications where id = p_application_id for update;
  if not found then raise exception 'NOT_FOUND: application not found'; end if;

  insert into membership_application_reviews (
    application_id, revision, reviewer_id, decision, reason
  ) values (
    p_application_id, v_app.revision, p_reviewer_id, p_decision, p_reason
  );

  update membership_applications set
    status = p_decision,
    reviewed_by = p_reviewer_id,
    reviewed_at = clock_timestamp(),
    rejection_reason = p_reason,
    updated_at = clock_timestamp()
  where id = p_application_id;

  -- Free tier activation
  select * into v_tier from membership_tiers where id = v_app.tier_id;
  if p_decision = 'approved' and v_tier.fee_paise = 0 then
    insert into memberships (user_id, tier_id, application_id, status, starts_on, expires_on)
    values (v_app.user_id, v_tier.id, v_app.id, 'active', current_date, current_date + (v_tier.duration_days || ' days')::interval);
  end if;

  return jsonb_build_object('id', p_application_id, 'status', p_decision);
end;
$$;

-- 11. Expense Status Management
create or replace function fn_set_expense_status(
  p_expense_id uuid,
  p_actor_id uuid,
  p_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_expense expenses%rowtype;
begin
  select * into v_expense from expenses where id = p_expense_id for update;
  if not found then raise exception 'NOT_FOUND: expense not found'; end if;

  if p_status = 'approved' and v_expense.submitted_by = p_actor_id then
    raise exception 'SELF_APPROVAL_FORBIDDEN: submitter cannot approve own expense';
  end if;

  if p_status = 'paid' and v_expense.status != 'approved' then
    raise exception 'CONFLICT: expense must be approved before marked paid';
  end if;

  update expenses set
    status = p_status,
    reviewed_by = p_actor_id,
    reviewed_at = clock_timestamp(),
    reject_reason = p_reason
  where id = p_expense_id;

  -- Post to ledger when paid
  if p_status = 'paid' then
    insert into ledger_entries (
      direction, amount_paise, category, method, source_type, source_id, memo, created_by
    ) values (
      'out', v_expense.amount_paise, 'expense', 'manual_upi', 'expense', v_expense.id,
      v_expense.description, p_actor_id
    ) on conflict (source_type, source_id) do nothing;
  end if;

  insert into audit_logs (actor_id, action, entity_type, entity_id, meta)
  values (p_actor_id, 'expense_' || p_status, 'expense', p_expense_id::text, jsonb_build_object('amount_paise', v_expense.amount_paise));

  return jsonb_build_object('id', p_expense_id, 'status', p_status);
end;
$$;

-- 12. Record Fundraiser Contribution
create or replace function fn_record_contribution(
  p_fundraiser_id uuid,
  p_amount_paise int,
  p_method text,
  p_note text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_cid uuid := gen_random_uuid();
begin
  insert into contributions (
    id, fundraiser_id, amount_paise, method, note, recorded_by
  ) values (
    v_cid, p_fundraiser_id, p_amount_paise, p_method, p_note, p_actor_id
  );

  insert into ledger_entries (
    direction, amount_paise, category, method, source_type, source_id, memo, created_by
  ) values (
    'in', p_amount_paise, 'fundraiser', p_method, 'contribution', v_cid,
    'Fundraiser contribution: ' || p_note, p_actor_id
  );

  insert into audit_logs (actor_id, action, entity_type, entity_id, meta)
  values (p_actor_id, 'contribution_recorded', 'contribution', v_cid::text, jsonb_build_object('amount_paise', p_amount_paise));

  return jsonb_build_object('id', v_cid, 'amount_paise', p_amount_paise);
end;
$$;

-- 13. Treasurer Overview Aggregator
create or replace function fn_treasurer_overview(
  p_from date default null,
  p_to date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_in int := 0;
  v_out int := 0;
  v_by_cat jsonb;
  v_by_method jsonb;
  v_recent jsonb;
begin
  select coalesce(sum(amount_paise), 0) into v_in
  from ledger_entries
  where direction = 'in'
    and (p_from is null or effective_on >= p_from)
    and (p_to is null or effective_on <= p_to);

  select coalesce(sum(amount_paise), 0) into v_out
  from ledger_entries
  where direction = 'out'
    and (p_from is null or effective_on >= p_from)
    and (p_to is null or effective_on <= p_to);

  select coalesce(jsonb_object_agg(category, total), '{}'::jsonb) into v_by_cat
  from (
    select category, sum(amount_paise) as total
    from ledger_entries
    where (p_from is null or effective_on >= p_from)
      and (p_to is null or effective_on <= p_to)
    group by category
  ) s;

  select coalesce(jsonb_object_agg(method, total), '{}'::jsonb) into v_by_method
  from (
    select method, sum(amount_paise) as total
    from ledger_entries
    where (p_from is null or effective_on >= p_from)
      and (p_to is null or effective_on <= p_to)
    group by method
  ) s;

  select coalesce(jsonb_agg(row_to_json(r)), '[]'::jsonb) into v_recent
  from (
    select id, direction, amount_paise, category, method, source_type, source_id, memo, effective_on, created_at
    from ledger_entries
    order by effective_on desc, created_at desc
    limit 10
  ) r;

  return jsonb_build_object(
    'inPaise', v_in,
    'outPaise', v_out,
    'netPaise', v_in - v_out,
    'byCategory', v_by_cat,
    'byMethod', v_by_method,
    'recent', v_recent
  );
end;
$$;

-- 14. Event Summary Aggregator
create or replace function fn_event_summary(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_capacity int;
  v_sold int := 0;
  v_checked_in int := 0;
  v_rev_by_method jsonb;
begin
  select capacity into v_capacity from events where id = p_event_id;
  if not found then raise exception 'NOT_FOUND: event not found'; end if;

  select count(*) into v_sold from tickets where event_id = p_event_id and status != 'cancelled';
  select count(*) into v_checked_in from tickets where event_id = p_event_id and status = 'checked_in';

  select coalesce(jsonb_object_agg(coalesce(c.payment_method::text, 'unknown'), total), '{}'::jsonb)
  into v_rev_by_method
  from (
    select c.payment_method, sum(ci.unit_price_paise * ci.quantity - ci.discount_paise) as total
    from tickets t
    join checkout_items ci on ci.id = t.checkout_item_id
    join checkouts c on c.id = ci.checkout_id
    where t.event_id = p_event_id and c.status = 'fulfilled'
    group by c.payment_method
  ) s;

  return jsonb_build_object(
    'sold', v_sold,
    'capacity', v_capacity,
    'checkedIn', v_checked_in,
    'attendanceRate', case when v_sold > 0 then round((v_checked_in::numeric / v_sold::numeric) * 100, 1) else 0 end,
    'revenueByMethod', v_rev_by_method
  );
end;
$$;

-- 15. Fundraiser Progress Aggregator
create or replace function fn_fundraiser_progress(p_fundraiser_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_goal int;
  v_raised int := 0;
  v_tasks_total int := 0;
  v_tasks_done int := 0;
  v_tasks_overdue int := 0;
begin
  select goal_paise into v_goal from fundraisers where id = p_fundraiser_id;
  if not found then raise exception 'NOT_FOUND: fundraiser not found'; end if;

  select coalesce(sum(amount_paise), 0) into v_raised
  from contributions where fundraiser_id = p_fundraiser_id;

  select count(*),
         count(*) filter (where status = 'done'),
         count(*) filter (where status != 'done' and due_on is not null and due_on < current_date)
  into v_tasks_total, v_tasks_done, v_tasks_overdue
  from tasks where fundraiser_id = p_fundraiser_id;

  return jsonb_build_object(
    'goal', v_goal,
    'raised', v_raised,
    'tasks', jsonb_build_object(
      'total', v_tasks_total,
      'done', v_tasks_done,
      'overdue', v_tasks_overdue
    )
  );
end;
$$;

-- 16. Action Queue (Computed dynamically per role)
create or replace function fn_action_queue(
  p_role text,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_items jsonb;
begin
  select coalesce(jsonb_agg(row_to_json(a)), '[]'::jsonb) into v_items
  from (
    -- Pending applications (admin)
    select
      ma.id::text as id,
      'membership_review' as kind,
      'Pending application from ' || p.full_name as title,
      'high' as priority,
      '/admin/membership' as link,
      'Review application' as next_action
    from membership_applications ma
    join profiles p on p.id = ma.user_id
    where ma.status = 'pending' and p_role = 'admin'

    union all

    -- Pending expenses (admin or treasurer)
    select
      e.id::text as id,
      'expense_review' as kind,
      'Expense ₹' || (e.amount_paise / 100)::text || ' for ' || e.category as title,
      'high' as priority,
      '/treasurer/expenses' as link,
      'Approve or reject' as next_action
    from expenses e
    where e.status = 'submitted' and p_role in ('admin', 'treasurer') and e.submitted_by != p_user_id

    union all

    -- Assigned tasks (volunteer or admin)
    select
      t.id::text as id,
      'task' as kind,
      t.title,
      t.priority,
      '/volunteer' as link,
      'Update task progress' as next_action
    from tasks t
    where t.assignee_id = p_user_id and t.status in ('todo', 'in_progress')
  ) a;

  return v_items;
end;
$$;

-- 17. Membership Renewal Reminders (30d and 7d notifications)
create or replace function fn_renewal_reminders()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  m memberships%rowtype;
begin
  for m in
    select * from memberships
    where status = 'active'
      and (expires_on = current_date + interval '30 days' or expires_on = current_date + interval '7 days')
  loop
    insert into notifications (
      user_id, kind, title, body, dedupe_key
    ) values (
      m.user_id, 'membership_expiry', 'Membership Renewal Reminder',
      'Your membership expires on ' || m.expires_on || '. Renew today to maintain your perks!',
      m.id || ':' || m.expires_on
    ) on conflict (dedupe_key) do nothing;
  end loop;
end;
$$;
