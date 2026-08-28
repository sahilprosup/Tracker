import { test } from "node:test";
import assert from "node:assert/strict";
import { commonPrefixSegments, relativeSegments, detectUniformUnits } from "../location-tree";
import type { ItpItem } from "../types";

test("commonPrefixSegments finds the shared root across Melton Hospital's paths", () => {
  const paths = [
    "Facade / Cladding / CLADDING / Early Retail zone/Life Garden / Level 1 / Plantroom Zone A1 (Area 1)",
    "Facade / Cladding / CLADDING / North West Ambulatory Zone / NWA ZONE A1",
  ];
  assert.deepEqual(commonPrefixSegments(paths), ["Facade", "Cladding", "CLADDING"]);
});

test("commonPrefixSegments returns everything when there's only one path", () => {
  assert.deepEqual(commonPrefixSegments(["A / B / C"]), ["A", "B", "C"]);
});

test("relativeSegments strips the root", () => {
  assert.deepEqual(
    relativeSegments("Facade / Cladding / CLADDING / North West Ambulatory Zone / NWA ZONE A1", [
      "Facade",
      "Cladding",
      "CLADDING",
    ]),
    ["North West Ambulatory Zone", "NWA ZONE A1"],
  );
});

function item(overrides: Partial<ItpItem>): ItpItem {
  return {
    id: overrides.alias ?? "id",
    project_id: "p",
    visibuild_visi_id: null,
    visi_type: "task",
    alias: null,
    location_path: null,
    location_order: null,
    code: null,
    description: "desc",
    assignee: null,
    status: "open",
    visibuild_sync_status: "not_synced",
    visibuild_last_synced_at: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

test("detectUniformUnits reconstructs Melton's real 'N instances of one template' shape", () => {
  // Mirrors Plantroom Zone A1 (Area 1) at a small scale: 3 uniquely-titled
  // inspections (the real per-instance codes) plus 2 generic titles each
  // repeated 3 times, aliases allocated in contiguous per-title blocks -
  // exactly how Visibuild actually laid Melton's data out.
  const items: ItpItem[] = [
    item({ alias: "X-1", visi_type: "task", description: "Materials" }),
    item({ alias: "X-2", visi_type: "task", description: "Materials" }),
    item({ alias: "X-3", visi_type: "task", description: "Materials" }),
    item({ alias: "X-4", visi_type: "inspection", description: "L1 Plantroom Cladding (L1.F.01)" }),
    item({ alias: "X-5", visi_type: "inspection", description: "L1 Plantroom Cladding (L1.F.02)" }),
    item({ alias: "X-6", visi_type: "inspection", description: "L1 Plantroom Cladding (L1.F.03)" }),
    item({ alias: "X-7", visi_type: "hold_point", description: "Top Hats" }),
    item({ alias: "X-8", visi_type: "hold_point", description: "Top Hats" }),
    item({ alias: "X-9", visi_type: "hold_point", description: "Top Hats" }),
  ];

  const units = detectUniformUnits(items);
  assert.ok(units);
  assert.equal(units!.length, 3);
  assert.equal(units![0].label, "L1 Plantroom Cladding (L1.F.01)");
  assert.equal(units![0].sections.length, 2);
  assert.deepEqual(
    units![0].sections.map((s) => s.alias),
    ["X-1", "X-7"],
  );
  assert.equal(units![2].label, "L1 Plantroom Cladding (L1.F.03)");
  assert.deepEqual(
    units![2].sections.map((s) => s.alias),
    ["X-3", "X-9"],
  );
});

test("detectUniformUnits refuses to guess when several different templates are mixed at one location", () => {
  // Mirrors NWA ZONE A1: several distinct templates deployed a different
  // number of times each - task titles don't share one consistent count,
  // so there's no safe positional pairing.
  const items: ItpItem[] = [
    item({ alias: "A-1", visi_type: "inspection", description: "Rab Single (Elevation 1 Brick)" }),
    item({ alias: "A-2", visi_type: "inspection", description: "Rab Single (Elevation 2 Brick)" }),
    item({ alias: "A-3", visi_type: "inspection", description: "Rab Double (Elevation 1)" }),
    item({ alias: "A-4", visi_type: "task", description: "Inspect Substrate" }),
    item({ alias: "A-5", visi_type: "task", description: "Inspect Substrate" }),
    item({ alias: "A-6", visi_type: "task", description: "Inspect Substrate" }),
    item({ alias: "A-7", visi_type: "task", description: "Inspect Substrate" }),
    item({ alias: "A-8", visi_type: "task", description: "RAB board install" }),
    item({ alias: "A-9", visi_type: "task", description: "RAB board install" }),
    item({ alias: "A-10", visi_type: "task", description: "RAB board install" }),
  ];

  assert.equal(detectUniformUnits(items), null);
});

test("detectUniformUnits returns null with no unique per-instance titles at all", () => {
  const items: ItpItem[] = [
    item({ alias: "B-1", visi_type: "task", description: "Materials" }),
    item({ alias: "B-2", visi_type: "task", description: "Materials" }),
  ];
  assert.equal(detectUniformUnits(items), null);
});
