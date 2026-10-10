-- =====================================================================
-- 0002_rls.sql — RLS Deny-All Safety Net
-- The browser talks ONLY to Supabase Auth for login/token refresh.
-- All data access goes through the Express API in Edge Function (service_role).
-- =====================================================================

alter table profiles enable row level security;
alter table user_roles enable row level security;
alter table app_settings enable row level security;
alter table membership_tiers enable row level security;
alter table membership_applications enable row level security;
alter table membership_application_reviews enable row level security;
alter table memberships enable row level security;
alter table member_codes enable row level security;
alter table events enable row level security;
alter table ticket_types enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table checkouts enable row level security;
alter table checkout_items enable row level security;
alter table payments enable row level security;
alter table webhook_events enable row level security;
alter table tickets enable row level security;
alter table check_ins enable row level security;
alter table announcements enable row level security;
alter table mailing_preferences enable row level security;
alter table notifications enable row level security;
alter table fundraisers enable row level security;
alter table tasks enable row level security;
alter table contributions enable row level security;
alter table expenses enable row level security;
alter table ledger_entries enable row level security;
alter table audit_logs enable row level security;
alter table rate_limits enable row level security;

-- Revoke all table and function permissions from browser client roles (anon, authenticated)
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- Grant service_role full access (Edge Function uses service_role key)
grant all on all tables in schema public to service_role;
grant all on all functions in schema public to service_role;
grant all on all sequences in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on functions to service_role;
alter default privileges in schema public grant all on sequences to service_role;
