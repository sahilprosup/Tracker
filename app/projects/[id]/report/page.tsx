import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/app/components/print-button";

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await params;
  const { date } = await searchParams;
  const reportDate = date ?? new Date().toISOString().slice(0, 10);
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, company")
    .eq("id", id)
    .single();

  const { data: checkpoints } = await supabase
    .from("checkpoints")
    .select("id, label, time_of_day, target_count")
    .eq("project_id", id)
    .order("time_of_day");

  const dayStart = `${reportDate}T00:00:00Z`;
  const dayEnd = `${reportDate}T23:59:59Z`;

  const { data: submissions } = await supabase
    .from("submissions")
    .select(
      "id, submitted_at, note, checkpoint_id, photo_path, itp_items(alias, description, location_path), profiles(full_name, email)",
    )
    .gte("submitted_at", dayStart)
    .lte("submitted_at", dayEnd)
    .in(
      "itp_item_id",
      (
        await supabase.from("itp_items").select("id").eq("project_id", id)
      ).data?.map((r) => r.id) ?? [],
    )
    .order("submitted_at");

  const checkpointCounts = new Map<string, number>();
  for (const s of submissions ?? []) {
    if (s.checkpoint_id) checkpointCounts.set(s.checkpoint_id, (checkpointCounts.get(s.checkpoint_id) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 print:px-0 print:py-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href={`/projects/${id}`} className="text-xs text-zinc-400 hover:text-zinc-600">
          ← Back to checklist
        </Link>
        <PrintButton />
      </div>

      <h1 className="text-xl font-semibold text-zinc-900">Daily ITP Report</h1>
      <p className="text-sm text-zinc-500">
        {project?.name} ({project?.company}) — {reportDate}
      </p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {(checkpoints ?? []).map((cp) => {
          const actual = checkpointCounts.get(cp.id) ?? 0;
          const met = actual >= cp.target_count;
          return (
            <div
              key={cp.id}
              className={`rounded-lg border p-3 ${met ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}
            >
              <p className="text-xs font-medium text-zinc-600">
                {cp.label} ({cp.time_of_day.slice(0, 5)})
              </p>
              <p className="text-lg font-semibold text-zinc-900">
                {actual}/{cp.target_count}
              </p>
            </div>
          );
        })}
      </div>

      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-400">
            <th className="py-2">Time</th>
            <th className="py-2">Submitted by</th>
            <th className="py-2">Location</th>
            <th className="py-2">Item</th>
            <th className="py-2">Note</th>
          </tr>
        </thead>
        <tbody>
          {(submissions ?? []).map((s: any) => (
            <tr key={s.id} className="border-b border-zinc-100">
              <td className="py-2 text-zinc-500">
                {new Date(s.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </td>
              <td className="py-2">{s.profiles?.full_name ?? s.profiles?.email}</td>
              <td className="py-2 text-zinc-500">{s.itp_items?.location_path}</td>
              <td className="py-2">{s.itp_items?.alias} — {s.itp_items?.description}</td>
              <td className="py-2 text-zinc-500">{s.note ?? "—"}</td>
            </tr>
          ))}
          {(submissions ?? []).length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-zinc-400">
                No submissions recorded for {reportDate}.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
