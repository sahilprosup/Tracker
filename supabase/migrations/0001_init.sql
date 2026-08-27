-- ProLine Tracker schema
-- Mirrors Visibuild's project/visi model so ITP items can be tracked locally
-- and (later) synced back once write access to Visibuild is available.

create type user_role as enum ('site_worker', 'coordinator', 'admin');
create type visi_type as enum ('inspection', 'task', 'hold_point');
create type item_status as enum ('open', 'submitted', 'closed');
create type sync_status as enum ('not_synced', 'pending', 'synced', 'failed');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role user_role not null default 'site_worker',
  slack_user_id text,
  created_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  visibuild_project_id text unique,
  name text not null,
  company text,
  slack_channel_id text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table checkpoints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  label text not null,
  time_of_day time not null,
  target_count integer not null default 5,
  created_at timestamptz not null default now()
);

create table itp_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  visibuild_visi_id text unique,
  visi_type visi_type not null default 'task',
  alias text,
  location_path text,
  code text,
  description text not null,
  assignee text,
  status item_status not null default 'open',
  visibuild_sync_status sync_status not null default 'not_synced',
  visibuild_last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index itp_items_project_idx on itp_items(project_id);
create index itp_items_status_idx on itp_items(status);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  itp_item_id uuid not null references itp_items(id) on delete cascade,
  submitted_by uuid not null references profiles(id),
  photo_path text not null,
  note text,
  submitted_at timestamptz not null default now(),
  checkpoint_id uuid references checkpoints(id),
  visibuild_sync_status sync_status not null default 'not_synced',
  visibuild_synced_at timestamptz,
  visibuild_sync_error text
);

create index submissions_item_idx on submissions(itp_item_id);
create index submissions_submitted_at_idx on submissions(submitted_at);
create index submissions_submitted_by_idx on submissions(submitted_by);

create table daily_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  report_date date not null,
  submission_count integer not null default 0,
  checkpoint_summary jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  posted_to_slack boolean not null default false,
  unique (project_id, report_date)
);

create table visibuild_sync_log (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references submissions(id) on delete cascade,
  itp_item_id uuid references itp_items(id) on delete cascade,
  action text not null,
  status sync_status not null default 'pending',
  detail text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table projects enable row level security;
alter table checkpoints enable row level security;
alter table itp_items enable row level security;
alter table submissions enable row level security;
alter table daily_reports enable row level security;
alter table visibuild_sync_log enable row level security;

create function is_coordinator_or_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('coordinator', 'admin')
  );
$$;

create policy "profiles: read all, self update" on profiles
  for select using (true);
create policy "profiles: self update" on profiles
  for update using (id = auth.uid());

create policy "projects: read all authenticated" on projects
  for select using (auth.role() = 'authenticated');
create policy "projects: coordinators manage" on projects
  for all using (is_coordinator_or_admin());

create policy "checkpoints: read all authenticated" on checkpoints
  for select using (auth.role() = 'authenticated');
create policy "checkpoints: coordinators manage" on checkpoints
  for all using (is_coordinator_or_admin());

create policy "itp_items: read all authenticated" on itp_items
  for select using (auth.role() = 'authenticated');
create policy "itp_items: coordinators manage" on itp_items
  for all using (is_coordinator_or_admin());

create policy "submissions: read all authenticated" on submissions
  for select using (auth.role() = 'authenticated');
create policy "submissions: authenticated insert own" on submissions
  for insert with check (submitted_by = auth.uid());
create policy "submissions: coordinators manage" on submissions
  for all using (is_coordinator_or_admin());

create policy "daily_reports: read all authenticated" on daily_reports
  for select using (auth.role() = 'authenticated');
create policy "daily_reports: coordinators manage" on daily_reports
  for all using (is_coordinator_or_admin());

create policy "sync_log: coordinators read" on visibuild_sync_log
  for select using (is_coordinator_or_admin());

-- Keep itp_items.status and updated_at in sync when a submission lands.
create function handle_new_submission()
returns trigger language plpgsql as $$
begin
  update itp_items
  set status = 'submitted', updated_at = now()
  where id = new.itp_item_id and status = 'open';
  return new;
end;
$$;

create trigger on_submission_created
  after insert on submissions
  for each row execute function handle_new_submission();

insert into storage.buckets (id, name, public)
values ('itp-photos', 'itp-photos', false)
on conflict (id) do nothing;

create policy "itp-photos: authenticated read" on storage.objects
  for select using (bucket_id = 'itp-photos' and auth.role() = 'authenticated');
create policy "itp-photos: authenticated upload" on storage.objects
  for insert with check (bucket_id = 'itp-photos' and auth.role() = 'authenticated');
