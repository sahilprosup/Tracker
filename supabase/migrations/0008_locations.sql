-- Caches Visibuild's real location tree (not just the leaf locations that
-- itp_items happen to have items at) so a project page can show a zone as a
-- clickable button even when nothing has been assigned to it yet (e.g.
-- Melton Hospital's "IPU Tower" and "Podium West" - real locations in
-- Visibuild's tree with zero Proline items today). full_path uses the same
-- " / "-joined breadcrumb format as itp_items.location_path so the two can
-- be walked with the same relative-segment logic. sort_order is the node's
-- real sibling position from Visibuild (list_project_locations), which is
-- manually set there and not alphabetical.
create table locations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  visibuild_location_id text not null,
  full_path text not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  unique (project_id, visibuild_location_id)
);

create index locations_project_idx on locations(project_id);

alter table locations enable row level security;

create policy "locations: authenticated read" on locations
  for select to authenticated using (true);
