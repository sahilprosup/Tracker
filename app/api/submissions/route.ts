import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncSubmissionToVisibuild } from "@/lib/visibuild";

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
    .select("id, visibuild_visi_id")
    .eq("id", itpItemId)
    .single();
  if (!item) {
    return NextResponse.json({ error: "ITP item not found" }, { status: 404 });
  }

  const now = new Date();
  const { data: checkpoint } = await supabase
    .from("checkpoints")
    .select("id, time_of_day")
    .lte("time_of_day", now.toTimeString().slice(0, 8))
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

  // Attempt to close the loop in Visibuild. Currently stubbed — see lib/visibuild.ts —
  // this never blocks the submission itself from succeeding.
  const syncResult = await syncSubmissionToVisibuild({
    submissionId: submission.id,
    itpItemId,
    visibuildVisiId: item.visibuild_visi_id,
    photoPath,
  });

  if (syncResult.status === "synced") {
    await supabase
      .from("submissions")
      .update({ visibuild_sync_status: "synced", visibuild_synced_at: new Date().toISOString() })
      .eq("id", submission.id);
    await supabase.from("itp_items").update({ status: "closed" }).eq("id", itpItemId);
  }

  return NextResponse.json({ submission, visibuildSync: syncResult.status });
}
