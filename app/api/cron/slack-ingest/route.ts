import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ingestSlackChannel } from "@/lib/slack-ingest";

// Call this on a schedule, e.g. POST /api/cron/slack-ingest?secret=CRON_SECRET
// Pulls new photos/documents from every project's mapped Slack channel and
// logs them as submissions. Requires SLACK_BOT_TOKEN and each project's
// slack_channel_id to be set (see /admin/slack).
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret") ?? request.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SLACK_BOT_TOKEN) {
    return NextResponse.json({ error: "SLACK_BOT_TOKEN not configured" }, { status: 200 });
  }

  const supabase = createServiceClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, slack_channel_id, slack_last_synced_ts")
    .eq("active", true)
    .not("slack_channel_id", "is", null);

  const results = [];
  for (const project of projects ?? []) {
    try {
      const result = await ingestSlackChannel({
        id: project.id,
        name: project.name,
        slack_channel_id: project.slack_channel_id as string,
        slack_last_synced_ts: project.slack_last_synced_ts,
      });
      results.push(result);
    } catch (err) {
      results.push({ project: project.name, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ checked: results.length, results });
}
