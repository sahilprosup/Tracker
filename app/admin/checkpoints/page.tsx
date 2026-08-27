import Link from "next/link";
import { requireCoordinator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CheckpointEditor } from "@/app/components/checkpoint-editor";
import type { Checkpoint } from "@/lib/types";

interface ProjectWithCheckpoints {
  id: string;
  name: string;
  checkpoints: Checkpoint[];
}

export default async function CheckpointsPage() {
  await requireCoordinator();
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, checkpoints(id, label, time_of_day, target_count)")
    .eq("active", true)
    .order("name");

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin" className="text-xs text-zinc-400 hover:text-zinc-600">
        ← Admin
      </Link>
      <h1 className="mt-1 text-2xl font-semibold text-zinc-900">Checkpoints</h1>
      <p className="text-sm text-zinc-500">
        The three daily checkpoints (default 08:30 / 11:30 / 14:30, 5 photos each) that drive the
        Slack nudges and the daily report. Projects with none configured won&apos;t get checkpoint
        tracking until you add one.
      </p>

      <div className="mt-6 space-y-4">
        {((projects ?? []) as ProjectWithCheckpoints[]).map((project) => (
          <CheckpointEditor
            key={project.id}
            projectId={project.id}
            projectName={project.name}
            checkpoints={project.checkpoints}
          />
        ))}
      </div>
    </div>
  );
}
