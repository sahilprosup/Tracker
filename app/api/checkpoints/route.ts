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

export async function POST(request: Request) {
  const ctx = await requireCoordinatorClient();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase } = ctx;

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
  const ctx = await requireCoordinatorClient();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase } = ctx;

  const { id, targetCount } = await request.json();
  if (!id || !targetCount) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const { data, error } = await supabase
    .from("checkpoints")
    .update({ target_count: targetCount })
    .eq("id", id)
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: "Checkpoint not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const ctx = await requireCoordinatorClient();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase } = ctx;

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { data, error } = await supabase.from("checkpoints").delete().eq("id", id).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: "Checkpoint not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
