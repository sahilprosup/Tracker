// Bulk-imports every visi for a given Visibuild project into itp_items.
//
// The pilot data in the migration (Melton Hospital, facade/cladding, 25
// items) was pulled by hand via Claude's Visibuild MCP session, which only
// works interactively and doesn't scale to 44 projects / thousands of visis.
// This script is the real path: it expects a proper Visibuild REST API
// (VISIBUILD_API_BASE_URL + VISIBUILD_ACCESS_TOKEN, the same env vars
// lib/visibuild.ts is waiting on) and paginates through every visi for a
// project, upserting into Supabase.
//
// Usage once credentials exist:
//   npx tsx scripts/import-visibuild.ts <visibuild_project_id>
//   npx tsx scripts/import-visibuild.ts --all   # every project already in `projects`

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const VISIBUILD_API_BASE_URL = process.env.VISIBUILD_API_BASE_URL;
const VISIBUILD_ACCESS_TOKEN = process.env.VISIBUILD_ACCESS_TOKEN;

interface VisibuildVisi {
  id: string;
  type: "inspection" | "task" | "hold_point";
  alias: string;
  location_path: string;
  code: string | null;
  description: string;
  assignee: string | null;
  status: "open" | "closed";
}

async function fetchAllVisis(visibuildProjectId: string): Promise<VisibuildVisi[]> {
  if (!VISIBUILD_API_BASE_URL || !VISIBUILD_ACCESS_TOKEN) {
    throw new Error(
      "VISIBUILD_API_BASE_URL / VISIBUILD_ACCESS_TOKEN not set — see scripts/import-visibuild.ts header.",
    );
  }

  const visis: VisibuildVisi[] = [];
  let cursor: string | null = null;

  do {
    const url = new URL(`${VISIBUILD_API_BASE_URL}/projects/${visibuildProjectId}/visis`);
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${VISIBUILD_ACCESS_TOKEN}` } });
    if (!res.ok) throw new Error(`Visibuild API error ${res.status}: ${await res.text()}`);

    const page = await res.json();
    visis.push(...page.items);
    cursor = page.next_cursor ?? null;
  } while (cursor);

  return visis;
}

async function importProject(supabase: ReturnType<typeof createClient>, visibuildProjectId: string) {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name")
    .eq("visibuild_project_id", visibuildProjectId)
    .single();
  if (projectError || !project) {
    throw new Error(`No local project row for visibuild_project_id=${visibuildProjectId}`);
  }

  const visis = await fetchAllVisis(visibuildProjectId);
  console.log(`Fetched ${visis.length} visis for ${project.name}`);

  const rows = visis.map((v) => ({
    project_id: project.id,
    visibuild_visi_id: v.id,
    visi_type: v.type,
    alias: v.alias,
    location_path: v.location_path,
    code: v.code,
    description: v.description,
    assignee: v.assignee,
    status: v.status === "closed" ? ("closed" as const) : ("open" as const),
  }));

  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("itp_items").upsert(chunk, { onConflict: "visibuild_visi_id" });
    if (error) throw error;
    console.log(`  upserted ${i + chunk.length}/${rows.length}`);
  }
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const arg = process.argv[2];

  if (!arg) {
    console.error("Usage: import-visibuild.ts <visibuild_project_id> | --all");
    process.exit(1);
  }

  if (arg === "--all") {
    const { data: projects } = await supabase.from("projects").select("visibuild_project_id").not("visibuild_project_id", "is", null);
    for (const p of projects ?? []) {
      await importProject(supabase, p.visibuild_project_id as string);
    }
  } else {
    await importProject(supabase, arg);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
