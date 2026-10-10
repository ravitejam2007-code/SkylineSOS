-- =====================================================================
-- 0004_cron.sql — Scheduled Background Jobs via pg_cron
-- =====================================================================

create extension if not exists pg_cron with schema extensions;

-- Remove existing jobs if re-running
do $$ begin
  perform cron.unschedule('sky-expire-checkouts');
exception when others then
  null;
end $$;

do $$ begin
  perform cron.unschedule('sky-renewal-reminders');
exception when others then
  null;
end $$;

-- 1. Expire stale checkouts every minute
select cron.schedule(
  'sky-expire-checkouts',
  '* * * * *',
  $$ select fn_expire_checkouts() $$
);

-- 2. Send renewal notifications daily at 03:00 UTC
select cron.schedule(
  'sky-renewal-reminders',
  '0 3 * * *',
  $$ select fn_renewal_reminders() $$
);
