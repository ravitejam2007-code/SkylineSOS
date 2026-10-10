-- Fix checkout insertion ordering so checkouts parent row exists before checkout_items child rows
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

  -- Insert parent checkout row first so checkout_items foreign key is satisfied
  insert into checkouts (
    id, buyer_id, status, payment_method, subtotal_paise, discount_paise, total_paise,
    recorded_by, note, idempotency_key, expires_at
  ) values (
    v_checkout_id, p_buyer_id, 'pending', p_method::pay_method, 0, 0, 0,
    p_recorded_by, p_note, p_idem_key, v_expires_at
  );

  -- 3. Validate items and compute totals
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_type := coalesce(v_item->>'itemType', v_item->>'type');
    v_ref_id := (coalesce(v_item->>'refId', v_item->>'ref_id'))::uuid;
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

  update checkouts set
    subtotal_paise = v_subtotal,
    discount_paise = v_discount,
    total_paise = v_total
  where id = v_checkout_id;

  select * into v_existing from checkouts where id = v_checkout_id;
  return to_jsonb(v_existing);
end;
$$;
