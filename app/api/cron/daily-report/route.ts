import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { postToSlack, formatDailyReport } from "@/lib/slack";

// Call once at end of day, e.g. POST /api/cron/daily-report?secret=CRON_SECRET
// Builds a per-project summary (submission count, checkpoint hit/miss, who
// submitted what) across every active project, stores it in daily_reports,
// and posts it to Slack.
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret") ?? request.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const reportDate = new Date().toISOString().slice(0, 10);
  const dayStart = `${reportDate}T00:00:00Z`;
  const dayEnd = `${reportDate}T23:59:59Z`;

  const { data: projects } = await supabase.from("projects").select("id, name").eq("active", true);

  const reports = [];

  for (const project of projects ?? []) {
    const { data: items } = await supabase.from("itp_items").select("id").eq("project_id", project.id);
    const itemIds = (items ?? []).map((i: { id: string }) => i.id);
    if (itemIds.length === 0) continue;

    const { data: submissions } = await supabase
      .from("submissions")
      .select("id, checkpoint_id, submitted_by, profiles(full_name, email)")
      .in("itp_item_id", itemIds)
      .gte("submitted_at", dayStart)
      .lte("submitted_at", dayEnd);

    const { data: checkpoints } = await supabase
      .from("checkpoints")
      .select("id, label, target_count")
      .eq("project_id", project.id);

    const checkpointSummary: Record<string, { target: number; actual: number }> = {};
    for (const cp of checkpoints ?? []) {
      checkpointSummary[cp.label] = {
        target: cp.target_count,
        actual: (submissions ?? []).filter((s) => s.checkpoint_id === cp.id).length,
      };
    }

    const bySubmitterMap = new Map<string, number>();
    for (const s of submissions ?? []) {
      const name = (s as any).profiles?.full_name ?? (s as any).profiles?.email ?? "Unknown";
      bySubmitterMap.set(name, (bySubmitterMap.get(name) ?? 0) + 1);
    }
    const bySubmitter = [...bySubmitterMap.entries()].map(([name, count]) => ({ name, count }));

    const submissionCount = submissions?.length ?? 0;
    if (submissionCount === 0 && Object.keys(checkpointSummary).length === 0) continue;

    await supabase.from("daily_reports").upsert(
      {
        project_id: project.id,
        report_date: reportDate,
        submission_count: submissionCount,
        checkpoint_summary: checkpointSummary,
        posted_to_slack: true,
      },
      { onConflict: "project_id,report_date" },
    );

    await postToSlack(
      formatDailyReport({
        projectName: project.name,
        reportDate,
        submissionCount,
        checkpointSummary,
        bySubmitter,
      }),
    );

    reports.push({ project: project.name, submissionCount });
  }

  return NextResponse.json({ reportDate, projectsReported: reports.length, reports });
}
