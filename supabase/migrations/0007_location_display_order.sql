-- Visibuild's location tree has a manually-set sibling order that is not
-- alphabetical (e.g. "Small Plantroom Zone A4" is listed before "Big
-- Plantroom Zone A2" under the same parent). Grouping itp_items by
-- location_path and sorting that string alphabetically therefore scrambles
-- sections compared to how the location appears in Visibuild itself.
-- This column holds the real sibling-order-derived position so the app can
-- reproduce Visibuild's own ordering; it's populated per-project as each
-- project's location tree is walked (see the Melton Hospital backfill),
-- and stays null (falls back to alphabetical) for anything not yet done.
alter table itp_items add column location_order integer;
