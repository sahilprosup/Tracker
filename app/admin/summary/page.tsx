import Link from "next/link";
import { requireCoordinator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { nowInMelbourne, melbourneDayBoundsUtc } from "@/lib/time";

interface ProjectRow {
  id: string;
  name: string;
  company: string | null;
}

export default async function CrossProjectSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireCoordinator();
  const { date } = await searchParams;
  const reportDate = date ?? nowInMelbourne().date;
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, company")
    .eq("active", true)
    .order("name")
    .returns<ProjectRow[]>();

  const { start: dayStart, end: dayEnd } = melbourneDayBoundsUtc(reportDate);

  const rows = [];
  let grandTotal = 0;

  for (const project of projects ?? []) {
    const { data: items } = await supabase.from("itp_items").select("id").eq("project_id", project.id);
    const itemIds = (items ?? []).map((i) => i.id);

    const { count: submissionCount } = itemIds.length
      ? await supabase
          .from("submissions")
          .select("id", { count: "exact", head: true })
          .in("itp_item_id", itemIds)
          .gte("submitted_at", dayStart)
          .lt("submitted_at", dayEnd)
      : { count: 0 };

    const { data: checkpoints } = await supabase
      .from("checkpoints")
      .select("id, target_count")
      .eq("project_id", project.id);

    let checkpointsMet = 0;
    for (const cp of checkpoints ?? []) {
      const { count } = itemIds.length
        ? await supabase
            .from("submissions")
            .select("id", { count: "exact", head: true })
            .in("itp_item_id", itemIds)
            .eq("checkpoint_id", cp.id)
            .gte("submitted_at", dayStart)
            .lt("submitted_at", dayEnd)
        : { count: 0 };
      if ((count ?? 0) >= cp.target_count) checkpointsMet += 1;
    }

    const total = submissionCount ?? 0;
    grandTotal += total;
    if (total === 0 && (checkpoints ?? []).length === 0) continue;

    rows.push({
      project,
      submissionCount: total,
      checkpointsMet,
      checkpointsTotal: (checkpoints ?? []).length,
    });
  }

  rows.sort((a, b) => b.submissionCount - a.submissionCount);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/admin" className="text-xs text-zinc-400 hover:text-zinc-600">
        ← Admin
      </Link>
      <h1 className="mt-1 text-2xl font-semibold text-zinc-900">Cross-project summary</h1>
      <p className="text-sm text-zinc-500">
        The same view the end-of-day Slack report is built from — {reportDate}. Only projects with
        ITP items or activity today are listed.
      </p>

      <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4">
        <p className="text-xs text-zinc-500">Total submitted today, all projects</p>
        <p className="text-2xl font-semibold text-zinc-900">{grandTotal}</p>
      </div>

      <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-400">
            <th className="py-2">Project</th>
            <th className="py-2">Submitted</th>
            <th className="py-2">Checkpoints hit</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.project.id} className="border-b border-zinc-100">
              <td className="py-2">
                <p className="font-medium text-zinc-800">{row.project.name}</p>
                <p className="text-xs text-zinc-400">{row.project.company}</p>
              </td>
              <td className="py-2">{row.submissionCount}</td>
              <td className="py-2">
                {row.checkpointsTotal > 0 ? (
                  <span className={row.checkpointsMet < row.checkpointsTotal ? "text-amber-600" : "text-emerald-600"}>
                    {row.checkpointsMet}/{row.checkpointsTotal}
                  </span>
                ) : (
                  <span className="text-zinc-300">—</span>
                )}
              </td>
              <td className="py-2 text-right">
                <Link
                  href={`/projects/${row.project.id}/report?date=${reportDate}`}
                  className="text-xs text-zinc-500 hover:underline"
                >
                  Detail →
                </Link>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-zinc-400">
                No ITP activity recorded for {reportDate}.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
