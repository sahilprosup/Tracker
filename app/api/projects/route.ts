import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Lets coordinators map a project to the Slack channel its ITP photos get
// posted into, so /api/cron/slack-ingest knows where to look.
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || (profile.role !== "coordinator" && profile.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, slackChannelId } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { data, error } = await supabase
    .from("projects")
    .update({ slack_channel_id: slackChannelId || null })
    .eq("id", id)
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
