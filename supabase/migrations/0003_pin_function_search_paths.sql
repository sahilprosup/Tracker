-- Fixes Supabase security advisor warning: function_search_path_mutable.
-- Without a pinned search_path, a SECURITY DEFINER-adjacent function like
-- is_coordinator_or_admin() could be tricked by a role that creates
-- objects earlier in the resolved search_path.
alter function public.is_coordinator_or_admin() set search_path = public, pg_temp;
alter function public.handle_new_submission() set search_path = public, pg_temp;
