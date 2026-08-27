import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Lets coordinators add ITP items by hand. This exists because bulk-importing
// every project from Visibuild needs write-scoped API credentials we don't
// have yet (see scripts/import-visibuild.ts) — until then, coordinators can
// still get a project's checklist into the tracker manually.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || (profile.role !== "coordinator" && profile.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { projectId, description, locationPath, alias, visiType, assignee } = await request.json();
  if (!projectId || !description) {
    return NextResponse.json({ error: "Missing projectId or description" }, { status: 400 });
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
