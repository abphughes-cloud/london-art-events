-- Run after contract/schema.sql. The app reads with the anon key; only the service role writes.
grant usage on schema public to anon, authenticated, service_role;
grant select on events, sources to anon, authenticated;
grant all on events, sources to service_role;
