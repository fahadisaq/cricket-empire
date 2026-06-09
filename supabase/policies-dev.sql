-- DEV write policies — lets the browser (anon key) persist the world while we
-- build. This is permissive (anyone can write). Before public launch, replace
-- with auth-scoped policies + a server-side tick using the service-role key.
-- Run this once in the SQL editor, after schema.sql.

do $$
begin
  create policy ce_dev_write_world    on ce_world        for all using (true) with check (true);
  create policy ce_dev_write_clubs    on ce_clubs        for all using (true) with check (true);
  create policy ce_dev_write_players  on ce_players      for all using (true) with check (true);
  create policy ce_dev_write_leagues  on ce_leagues      for all using (true) with check (true);
  create policy ce_dev_write_auct     on ce_auctions     for all using (true) with check (true);
  create policy ce_dev_write_log      on ce_world_log    for all using (true) with check (true);
  create policy ce_dev_write_matches  on ce_match_results for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

-- Users table needs read+write too (for claiming clubs).
alter table ce_users enable row level security;
do $$
begin
  create policy ce_dev_users_all on ce_users for all using (true) with check (true);
exception when duplicate_object then null;
end $$;
