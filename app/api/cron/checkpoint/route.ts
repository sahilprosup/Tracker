import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { postToSlack, formatCheckpointNudge } from "@/lib/slack";

// Call this once per checkpoint time (8:30 / 11:30 / 14:30) from an external
// scheduler (cron-job.org, Vercel Cron, GitHub Actions schedule, etc.), e.g.:
//   POST /api/cron/checkpoint?secret=CRON_SECRET
// It finds every checkpoint whose time_of_day just passed, tallies today's
// submissions against target_count, and nudges Slack for any project behind.
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret") ?? request.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const nowTime = now.toTimeString().slice(0, 8);
  const windowStart = new Date(now.getTime() - 15 * 60 * 1000).toTimeString().slice(0, 8);

  interface DueCheckpoint {
    id: string;
    label: string;
    time_of_day: string;
    target_count: number;
    project_id: string;
    projects: { name: string } | null;
  }

  const { data: checkpoints } = await supabase
    .from("checkpoints")
    .select("id, label, time_of_day, target_count, project_id, projects(name)")
    .gte("time_of_day", windowStart)
    .lte("time_of_day", nowTime)
    .returns<DueCheckpoint[]>();

  const results: { project: string; checkpoint: string; target: number; actual: number }[] = [];
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  for (const cp of checkpoints ?? []) {
    const { data: items } = await supabase.from("itp_items").select("id").eq("project_id", cp.project_id);
    const itemIds = (items ?? []).map((i: { id: string }) => i.id);
    if (itemIds.length === 0) continue;

    const { count } = await supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .in("itp_item_id", itemIds)
      .gte("submitted_at", todayStart.toISOString());

    const actual = count ?? 0;
    const projectName = cp.projects?.name ?? "Unknown project";

    await postToSlack(
      formatCheckpointNudge({
        projectName,
        checkpointLabel: cp.label,
        target: cp.target_count,
        actual,
      }),
    );

    results.push({ project: projectName, checkpoint: cp.label, target: cp.target_count, actual });
  }

  return NextResponse.json({ checked: results.length, results });
}
