import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { postToSlack, formatConsolidatedDailyReport } from "@/lib/slack";
import { nowInMelbourne, melbourneDayBoundsUtc } from "@/lib/time";

// Call once at end of day, e.g. POST /api/cron/daily-report?secret=CRON_SECRET
// Builds a per-project summary (submission count, checkpoint hit/miss, who
// submitted what) across every active project, stores each in daily_reports,
// then posts ONE consolidated message to Slack across all projects - this is
// the "rip me a report... across all 43 projects" the tracker is meant for,
// not 43 separate Slack messages.
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret") ?? request.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { date: reportDate } = nowInMelbourne();
  const { start: dayStart, end: dayEnd } = melbourneDayBoundsUtc(reportDate);

  const { data: projects } = await supabase.from("projects").select("id, name").eq("active", true);

  const reports = [];
  const consolidatedProjects: {
    name: string;
    submissionCount: number;
    checkpointsMet: number;
    checkpointsTotal: number;
  }[] = [];

  for (const project of projects ?? []) {
    const { data: items } = await supabase.from("itp_items").select("id").eq("project_id", project.id);
    const itemIds = (items ?? []).map((i: { id: string }) => i.id);
    if (itemIds.length === 0) continue;

    interface SubmissionWithProfile {
      id: string;
      checkpoint_id: string | null;
      submitted_by: string | null;
      slack_display_name: string | null;
      profiles: { full_name: string; email: string } | null;
    }

    const { data: submissions } = await supabase
      .from("submissions")
      .select("id, checkpoint_id, submitted_by, slack_display_name, profiles(full_name, email)")
      .in("itp_item_id", itemIds)
      .gte("submitted_at", dayStart)
      .lt("submitted_at", dayEnd)
      .returns<SubmissionWithProfile[]>();

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
      const name = s.profiles?.full_name ?? s.profiles?.email ?? s.slack_display_name ?? "Unknown";
      bySubmitterMap.set(name, (bySubmitterMap.get(name) ?? 0) + 1);
    }
    const bySubmitter = [...bySubmitterMap.entries()].map(([name, count]) => ({ name, count }));

    const submissionCount = submissions?.length ?? 0;
    const checkpointEntries = Object.values(checkpointSummary);
    if (submissionCount === 0 && checkpointEntries.length === 0) continue;

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

    consolidatedProjects.push({
      name: project.name,
      submissionCount,
      checkpointsMet: checkpointEntries.filter((c) => c.actual >= c.target).length,
      checkpointsTotal: checkpointEntries.length,
    });

    reports.push({ project: project.name, submissionCount, bySubmitter });
  }

  await postToSlack(formatConsolidatedDailyReport({ reportDate, projects: consolidatedProjects }));

  return NextResponse.json({ reportDate, projectsReported: reports.length, reports });
}
