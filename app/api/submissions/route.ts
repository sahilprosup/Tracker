import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncSubmissionToVisibuild } from "@/lib/visibuild";
import { nowInMelbourne } from "@/lib/time";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { itpItemId, photoPath, note, fileName, mimeType } = await request.json();
  if (!itpItemId || !photoPath) {
    return NextResponse.json({ error: "Missing itpItemId or photoPath" }, { status: 400 });
  }

  const { data: item } = await supabase
    .from("itp_items")
    .select("id, project_id, visibuild_visi_id, alias, description, projects(visibuild_project_id)")
    .eq("id", itpItemId)
    .single();
  if (!item) {
    return NextResponse.json({ error: "ITP item not found" }, { status: 404 });
  }

  const { time: nowTime } = nowInMelbourne();
  const { data: checkpoint } = await supabase
    .from("checkpoints")
    .select("id, time_of_day")
    .eq("project_id", item.project_id)
    .lte("time_of_day", nowTime)
    .order("time_of_day", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: submission, error } = await supabase
    .from("submissions")
    .insert({
      itp_item_id: itpItemId,
      submitted_by: user.id,
      photo_path: photoPath,
      file_name: fileName || null,
      mime_type: mimeType || null,
      note: note || null,
      checkpoint_id: checkpoint?.id ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Push the photo into Visibuild as ticket evidence. This does NOT close the
  // original visi in Visibuild (no confirmed endpoint for that yet - see
  // lib/visibuild.ts) so it never auto-closes the item here either; a
  // coordinator still confirms the close-out via "Mark closed" once they've
  // checked it in Visibuild. This never blocks the submission from succeeding.
  const project = item.projects as unknown as { visibuild_project_id: string | null } | null;
  const syncResult = await syncSubmissionToVisibuild({
    submissionId: submission.id,
    itpItemId,
    visibuildVisiId: item.visibuild_visi_id,
    visibuildProjectId: project?.visibuild_project_id ?? null,
    itemAlias: item.alias,
    itemDescription: item.description,
    photoPath,
  });

  if (syncResult.status === "synced") {
    await supabase
      .from("submissions")
      .update({ visibuild_sync_status: "synced", visibuild_synced_at: new Date().toISOString() })
      .eq("id", submission.id);
  }

  return NextResponse.json({ submission, visibuildSync: syncResult.status });
}
