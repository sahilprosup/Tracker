import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type CoordinatorContext =
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; status: 401 | 403; error: string };

async function requireCoordinatorClient(): Promise<CoordinatorContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Not signed in" };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || (profile.role !== "coordinator" && profile.role !== "admin")) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true, supabase };
}

// Lets coordinators add ITP items by hand, one at a time or pasted in bulk.
// This exists because bulk-importing every project from Visibuild needs
// write-scoped API credentials we don't have yet (see
// scripts/import-visibuild.ts) — until then, coordinators can still get a
// project's checklist into the tracker themselves, at whatever pace the
// project needs (one item, or a whole pasted list).
export async function POST(request: Request) {
  const ctx = await requireCoordinatorClient();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase } = ctx;

  const body = await request.json();
  const { projectId } = body;
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  // Bulk mode: { projectId, items: [{ description, locationPath?, alias?, visiType?, assignee? }, ...] }
  if (Array.isArray(body.items)) {
    const rows = body.items
      .filter((i: { description?: string }) => i.description?.trim())
      .map((i: { description: string; locationPath?: string; alias?: string; visiType?: string; assignee?: string }) => ({
        project_id: projectId,
        description: i.description.trim(),
        location_path: i.locationPath?.trim() || null,
        alias: i.alias?.trim() || null,
        visi_type: i.visiType || "task",
        assignee: i.assignee?.trim() || null,
      }));

    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid items to add" }, { status: 400 });
    }
    if (rows.length > 500) {
      return NextResponse.json({ error: "Paste 500 items or fewer at a time" }, { status: 400 });
    }

    const { data: items, error } = await supabase.from("itp_items").insert(rows).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items, count: items.length });
  }

  // Single-item mode (unchanged)
  const { description, locationPath, alias, visiType, assignee } = body;
  if (!description) {
    return NextResponse.json({ error: "Missing description" }, { status: 400 });
  }

  const { data: item, error } = await supabase
    .from("itp_items")
    .insert({
      project_id: projectId,
      description,
      location_path: locationPath || null,
      alias: alias || null,
      visi_type: visiType || "task",
      assignee: assignee || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item });
}

// Manually close (or reopen) an item. Exists because Visibuild write-back is
// stubbed (lib/visibuild.ts) - until that's real, a coordinator verifying the
// close-out directly in Visibuild needs a way to reflect that here too,
// otherwise every submitted item sits at "submitted" forever.
export async function PATCH(request: Request) {
  const ctx = await requireCoordinatorClient();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase } = ctx;

  const { id, status } = await request.json();
  if (!id || (status !== "closed" && status !== "submitted")) {
    return NextResponse.json({ error: "Missing id or invalid status" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("itp_items")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
