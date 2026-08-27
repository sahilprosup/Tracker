-- profiles had select and update policies but no insert policy, so the
-- auth callback's upsert on first sign-in silently failed (RLS denies an
-- action with no matching policy) - discovered when a real user signed in
-- successfully but never got a profile row, so they never got their
-- coordinator role. The callback was also switched to run this upsert as
-- service role instead of depending on this policy alone.
create policy "profiles: self insert" on profiles
  for insert with check (id = (select auth.uid()));
