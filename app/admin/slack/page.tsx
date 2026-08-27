import Link from "next/link";
import { requireCoordinator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SlackChannelEditor } from "@/app/components/slack-channel-editor";

export default async function SlackMappingPage() {
  await requireCoordinator();
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, slack_channel_id, slack_last_synced_ts")
    .eq("active", true)
    .order("name");

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin" className="text-xs text-zinc-400 hover:text-zinc-600">
        ← Admin
      </Link>
      <h1 className="mt-1 text-2xl font-semibold text-zinc-900">Slack channel mapping</h1>
      <p className="text-sm text-zinc-500">
        Map each project to the Slack channel its ITP photos get posted into. The bot must be
        invited to the channel first (<code className="font-mono text-xs">/invite @ITP Tracker</code>),
        and <code className="font-mono text-xs">SLACK_BOT_TOKEN</code> must be set for ingestion to
        run at all. Get a channel&apos;s ID from Slack: right-click the channel → View channel
        details → scroll down.
      </p>

      <div className="mt-6 space-y-2">
        {(projects ?? []).map((project) => (
          <div
            key={project.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-3"
          >
            <div>
              <p className="text-sm font-medium text-zinc-800">{project.name}</p>
              {project.slack_last_synced_ts && (
                <p className="text-xs text-zinc-400">Last synced message: {project.slack_last_synced_ts}</p>
              )}
            </div>
            <SlackChannelEditor projectId={project.id} initialChannelId={project.slack_channel_id} />
          </div>
        ))}
      </div>
    </div>
  );
}
