import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/app/components/print-button";
import { nowInMelbourne, melbourneDayBoundsUtc } from "@/lib/time";

interface SubmissionRow {
  id: string;
  submitted_at: string;
  note: string | null;
  checkpoint_id: string | null;
  photo_path: string;
  file_name: string | null;
  mime_type: string | null;
  submitted_via: "app" | "slack";
  slack_display_name: string | null;
  itp_items: { alias: string | null; description: string; location_path: string | null } | null;
  profiles: { full_name: string; email: string } | null;
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await params;
  const { date } = await searchParams;
  const reportDate = date ?? nowInMelbourne().date;
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

  const { start: dayStart, end: dayEnd } = melbourneDayBoundsUtc(reportDate);

  const { data: submissions } = await supabase
    .from("submissions")
    .select(
      "id, submitted_at, note, checkpoint_id, photo_path, file_name, mime_type, submitted_via, slack_display_name, itp_items(alias, description, location_path), profiles(full_name, email)",
    )
    .gte("submitted_at", dayStart)
    .lt("submitted_at", dayEnd)
    .in(
      "itp_item_id",
      (await supabase.from("itp_items").select("id").eq("project_id", id)).data?.map((r) => r.id) ?? [],
    )
    .order("submitted_at")
    .returns<SubmissionRow[]>();

  const checkpointCounts = new Map<string, number>();
  for (const s of submissions ?? []) {
    if (s.checkpoint_id)
      checkpointCounts.set(s.checkpoint_id, (checkpointCounts.get(s.checkpoint_id) ?? 0) + 1);
  }

  const photoUrls = new Map<string, string>();
  for (const s of submissions ?? []) {
    const { data } = await supabase.storage.from("itp-photos").createSignedUrl(s.photo_path, 3600);
    if (data?.signedUrl) photoUrls.set(s.id, data.signedUrl);
  }

  return (
    <div>
      <header className="m-header m-noprint">
        <Link href="/dashboard" className="m-brand">
          <span className="m-brand-mark">ProLine</span>
          <span className="inline-block h-[13px] w-px bg-[var(--color-neutral-400)]" />
          <span className="m-brand-sub">ITP Tracker</span>
        </Link>
        <PrintButton />
      </header>

      <div className="m-pad m-rule-strong pb-5 pt-7">
        <Link href={`/projects/${id}`} className="m-eyebrow m-noprint text-[var(--color-neutral-700)]">
          ← Back to checklist
        </Link>
        <h1 className="m-display mt-2.5">Daily report</h1>
        <div className="mt-2 text-[13px] text-[var(--color-neutral-700)]">
          {project?.name} · {project?.company} · {reportDate}
        </div>
      </div>

      <div className="m-cells">
        {(checkpoints ?? []).map((cp) => {
          const actual = checkpointCounts.get(cp.id) ?? 0;
          const met = actual >= cp.target_count;
          return (
            <div
              key={cp.id}
              style={
                met
                  ? { background: "var(--color-neutral-200)", color: "var(--color-text)" }
                  : { background: "var(--color-accent)", color: "var(--color-bg)" }
              }
            >
              <div className="m-eyebrow">
                {cp.label} · {cp.time_of_day.slice(0, 5)}
              </div>
              <div className="mt-1.5 text-[34px] font-black leading-tight tracking-tight">
                {actual} / {cp.target_count}
              </div>
              <div className="m-eyebrow mt-1 opacity-80">{met ? "Target met" : "Outstanding"}</div>
            </div>
          );
        })}
      </div>

      <div className="m-pad pb-16">
        <table className="m-table">
          <thead>
            <tr>
              <th style={{ width: 68 }}>Evidence</th>
              <th style={{ width: 74 }}>Time</th>
              <th>Submitted by</th>
              <th className="m-hide-sm">Location</th>
              <th>Item</th>
              <th className="m-hide-sm">Note</th>
            </tr>
          </thead>
          <tbody>
            {(submissions ?? []).map((s) => {
              const url = photoUrls.get(s.id);
              const isImage = s.mime_type?.startsWith("image/") ?? true;
              return (
                <tr key={s.id}>
                  <td>
                    {!url ? (
                      <span className="text-xs text-[var(--color-neutral-400)]">—</span>
                    ) : isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt="ITP submission"
                        className="grayscale h-[52px] w-[52px] object-cover"
                      />
                    ) : (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={s.file_name ?? "document"}
                        className="flex h-[52px] w-[52px] items-center justify-center border border-[var(--color-neutral-300)] bg-[var(--color-neutral-200)] text-[9px] font-bold uppercase tracking-wider text-[var(--color-neutral-700)]"
                      >
                        {s.file_name?.split(".").pop() ?? "file"}
                      </a>
                    )}
                  </td>
                  <td className="tabular-nums text-[var(--color-neutral-700)]">
                    {new Date(s.submitted_at).toLocaleTimeString("en-AU", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </td>
                  <td>
                    {s.profiles?.full_name ?? s.profiles?.email ?? s.slack_display_name ?? "Unknown"}
                    <span
                      className="m-eyebrow block"
                      style={{
                        color:
                          s.submitted_via === "slack"
                            ? "var(--color-accent-700)"
                            : "var(--color-neutral-500)",
                      }}
                    >
                      {s.submitted_via === "slack" ? "via Slack" : "via app"}
                    </span>
                  </td>
                  <td className="m-hide-sm text-[var(--color-neutral-700)]">{s.itp_items?.location_path}</td>
                  <td>
                    {s.itp_items?.alias} — {s.itp_items?.description}
                  </td>
                  <td className="m-hide-sm text-[var(--color-neutral-700)]">{s.note ?? "—"}</td>
                </tr>
              );
            })}
            {(submissions ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="py-14 text-sm text-[var(--color-neutral-600)]">
                  No submissions recorded for {reportDate}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
