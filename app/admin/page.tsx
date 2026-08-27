import Link from "next/link";
import { requireCoordinator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  await requireCoordinator();
  const supabase = await createClient();

  const { count: pendingSync } = await supabase
    .from("visibuild_sync_log")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed");

  const { count: totalSubmissions } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true });

  const { count: totalProjects } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("active", true);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/dashboard" className="text-xs text-zinc-400 hover:text-zinc-600">
        ← Dashboard
      </Link>
      <h1 className="mt-1 text-2xl font-semibold text-zinc-900">Admin</h1>
      <p className="text-sm text-zinc-500">Coordinator tools: checkpoints, sync health, projects.</p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-500">Active projects</p>
          <p className="text-2xl font-semibold">{totalProjects ?? 0}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-500">Total submissions</p>
          <p className="text-2xl font-semibold">{totalSubmissions ?? 0}</p>
        </div>
        <div className={`rounded-lg border p-4 ${pendingSync ? "border-red-200 bg-red-50" : "border-zinc-200 bg-white"}`}>
          <p className="text-xs text-zinc-500">Failed Visibuild syncs</p>
          <p className="text-2xl font-semibold">{pendingSync ?? 0}</p>
        </div>
      </div>

      <div className="mt-8 space-y-2">
        <Link
          href="/admin/summary"
          className="block rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400"
        >
          <p className="font-medium text-zinc-900">Cross-project summary</p>
          <p className="text-sm text-zinc-500">Today&apos;s submissions and checkpoint hits across every project — the same data behind the end-of-day Slack report.</p>
        </Link>
        <Link
          href="/admin/checkpoints"
          className="block rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400"
        >
          <p className="font-medium text-zinc-900">Checkpoints</p>
          <p className="text-sm text-zinc-500">Edit the 08:30 / 11:30 / 14:30 targets per project.</p>
        </Link>
        <Link
          href="/admin/sync-log"
          className="block rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400"
        >
          <p className="font-medium text-zinc-900">Visibuild sync log</p>
          <p className="text-sm text-zinc-500">Every attempt to push a submission back into Visibuild.</p>
        </Link>
      </div>
    </div>
  );
}
