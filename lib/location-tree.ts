import type { ItpItem } from "@/lib/types";

// itp_items.location_path is Visibuild's full location breadcrumb, e.g.
// "Facade / Cladding / CLADDING / Early Retail zone/Life Garden / Level 1 /
// Plantroom Zone A1 (Area 1)". Every item in a project shares the same
// leading segments (the project's package root), which isn't a useful
// navigation level on its own - this finds where paths actually diverge so
// drill-down starts at the first meaningful branch instead of one giant
// "Facade" button containing everything.
export function commonPrefixSegments(paths: string[]): string[] {
  const nonEmpty = paths.filter(Boolean);
  if (nonEmpty.length === 0) return [];
  const split = nonEmpty.map((p) => p.split(" / "));
  const first = split[0];
  let prefixLen = first.length;
  for (const segs of split.slice(1)) {
    let i = 0;
    while (i < prefixLen && i < segs.length && segs[i] === first[i]) i++;
    prefixLen = i;
  }
  return first.slice(0, prefixLen);
}

export function relativeSegments(fullPath: string, root: string[]): string[] {
  return fullPath.split(" / ").slice(root.length);
}

function aliasNumber(alias: string | null): number {
  if (!alias) return 0;
  const match = alias.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

export interface UnitGroup {
  label: string;
  anchor: ItpItem;
  sections: ItpItem[];
}

// Detects Visibuild's "one checklist template deployed N times at this
// location" pattern: N items with their own unique description (normally
// the inspection, each carrying a distinct code like "L1.F.01" baked into
// its title) plus a fixed set of generic task/hold_point titles each
// repeated exactly N times. Confirmed directly against Visibuild's data
// (Melton Hospital, Plantroom Zone A1: 35 uniquely-titled inspections +
// exactly 5 other titles each repeated 35 times, 210 items total) - each
// bulk deployment call assigns one contiguous block of alias numbers per
// title, in instance order, so the k-th item (sorted by alias) in every
// repeated group belongs to the same physical unit as the k-th
// unique-description item. Returns null when a location doesn't cleanly
// fit this shape (e.g. several different templates mixed at one location)
// rather than guessing - a wrong grouping here would misfile a real
// compliance photo against the wrong physical unit.
export function detectUniformUnits(items: ItpItem[]): UnitGroup[] | null {
  const byTitle = new Map<string, ItpItem[]>();
  for (const item of items) {
    const key = `${item.visi_type}::${item.description}`;
    byTitle.set(key, [...(byTitle.get(key) ?? []), item]);
  }

  const groups = [...byTitle.values()];
  const singletons = groups.filter((g) => g.length === 1).map((g) => g[0]);
  const repeated = groups.filter((g) => g.length > 1);

  if (singletons.length < 2 || repeated.length === 0) return null;
  const n = singletons.length;
  if (!repeated.every((g) => g.length === n)) return null;

  const sortedAnchors = [...singletons].sort((a, b) => aliasNumber(a.alias) - aliasNumber(b.alias));
  const sortedRepeated = repeated.map((g) => [...g].sort((a, b) => aliasNumber(a.alias) - aliasNumber(b.alias)));

  return sortedAnchors.map((anchor, i) => ({
    label: anchor.description,
    anchor,
    sections: sortedRepeated.map((g) => g[i]),
  }));
}
