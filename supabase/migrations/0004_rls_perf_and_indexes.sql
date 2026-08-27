-- Fixes Supabase performance advisor warnings: auth_rls_initplan (wrap
-- auth.<fn>() in a subselect so it's evaluated once per query instead of
-- once per row) and multiple_permissive_policies (collapse the overlapping
-- "coordinators manage" ALL policies with the "read all authenticated"
-- SELECT policies into one policy per action). Also adds indexes for every
-- foreign key that was missing one.

create index if not exists checkpoints_project_idx on checkpoints(project_id);
create index if not exists submissions_checkpoint_idx on submissions(checkpoint_id);
create index if not exists sync_log_itp_item_idx on visibuild_sync_log(itp_item_id);
create index if not exists sync_log_submission_idx on visibuild_sync_log(submission_id);

drop policy if exists "profiles: self update" on profiles;
create policy "profiles: self update" on profiles
  for update using (id = (select auth.uid()));

drop policy if exists "projects: read all authenticated" on projects;
drop policy if exists "projects: coordinators manage" on projects;
create policy "projects: read all authenticated" on projects
  for select using ((select auth.role()) = 'authenticated');
create policy "projects: coordinators write" on projects
  for insert with check (is_coordinator_or_admin());
create policy "projects: coordinators update" on projects
  for update using (is_coordinator_or_admin());
create policy "projects: coordinators delete" on projects
  for delete using (is_coordinator_or_admin());

drop policy if exists "checkpoints: read all authenticated" on checkpoints;
drop policy if exists "checkpoints: coordinators manage" on checkpoints;
create policy "checkpoints: read all authenticated" on checkpoints
  for select using ((select auth.role()) = 'authenticated');
create policy "checkpoints: coordinators write" on checkpoints
  for insert with check (is_coordinator_or_admin());
create policy "checkpoints: coordinators update" on checkpoints
  for update using (is_coordinator_or_admin());
create policy "checkpoints: coordinators delete" on checkpoints
  for delete using (is_coordinator_or_admin());

drop policy if exists "itp_items: read all authenticated" on itp_items;
drop policy if exists "itp_items: coordinators manage" on itp_items;
create policy "itp_items: read all authenticated" on itp_items
  for select using ((select auth.role()) = 'authenticated');
create policy "itp_items: coordinators write" on itp_items
  for insert with check (is_coordinator_or_admin());
create policy "itp_items: coordinators update" on itp_items
  for update using (is_coordinator_or_admin());
create policy "itp_items: coordinators delete" on itp_items
  for delete using (is_coordinator_or_admin());

drop policy if exists "submissions: read all authenticated" on submissions;
drop policy if exists "submissions: authenticated insert own" on submissions;
drop policy if exists "submissions: coordinators manage" on submissions;
create policy "submissions: read all authenticated" on submissions
  for select using ((select auth.role()) = 'authenticated');
create policy "submissions: insert own or coordinator" on submissions
  for insert with check (submitted_by = (select auth.uid()) or is_coordinator_or_admin());
create policy "submissions: coordinators update" on submissions
  for update using (is_coordinator_or_admin());
create policy "submissions: coordinators delete" on submissions
  for delete using (is_coordinator_or_admin());

drop policy if exists "daily_reports: read all authenticated" on daily_reports;
drop policy if exists "daily_reports: coordinators manage" on daily_reports;
create policy "daily_reports: read all authenticated" on daily_reports
  for select using ((select auth.role()) = 'authenticated');
create policy "daily_reports: coordinators write" on daily_reports
  for insert with check (is_coordinator_or_admin());
create policy "daily_reports: coordinators update" on daily_reports
  for update using (is_coordinator_or_admin());
create policy "daily_reports: coordinators delete" on daily_reports
  for delete using (is_coordinator_or_admin());
