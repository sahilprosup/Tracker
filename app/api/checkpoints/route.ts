import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function assertCoordinator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || (profile.role !== "coordinator" && profile.role !== "admin")) return null;

  return supabase;
}

export async function POST(request: Request) {
  const supabase = await assertCoordinator();
  if (!supabase) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { projectId, label, timeOfDay, targetCount } = await request.json();
  if (!projectId || !label || !timeOfDay || !targetCount) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { error } = await supabase
    .from("checkpoints")
    .insert({ project_id: projectId, label, time_of_day: timeOfDay, target_count: targetCount });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const supabase = await assertCoordinator();
  if (!supabase) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, targetCount } = await request.json();
  if (!id || !targetCount) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const { error } = await supabase.from("checkpoints").update({ target_count: targetCount }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await assertCoordinator();
  if (!supabase) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabase.from("checkpoints").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
