import Link from "next/link";
import { requireCoordinator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const TOOLS = [
  {
    href: "/admin/summary",
    name: "Cross-project summary",
    body: "Today's submissions and checkpoint hits across every site — the same data behind the end-of-day Slack report.",
  },
  {
    href: "/admin/slack",
    name: "Slack channel mapping",
    body: "Link each project to its Slack channel so photos posted there are logged automatically.",
  },
  {
    href: "/admin/checkpoints",
    name: "Checkpoints",
    body: "Edit the 08:30 / 11:30 / 14:30 targets per project.",
  },
  {
    href: "/admin/sync-log",
    name: "Visibuild sync log",
    body: "Every attempt to push a submission back into Visibuild, with the failures first.",
  },
];

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
    <div>
      <header className="m-header">
        <Link href="/dashboard" className="m-brand">
          <span className="m-brand-mark">ProLine</span>
          <span className="inline-block h-[13px] w-px bg-[var(--color-neutral-400)]" />
          <span className="m-brand-sub">ITP Tracker</span>
        </Link>
        <Link href="/dashboard" className="m-navlink">
          Dashboard
        </Link>
      </header>

      <div className="m-pad m-rule-strong pb-5 pt-7">
        <Link href="/dashboard" className="m-eyebrow text-[var(--color-neutral-700)]">
          ← Dashboard
        </Link>
        <h1 className="m-display mt-2.5">Admin</h1>
        <div className="mt-2 text-[13px] text-[var(--color-neutral-700)]">
          Checkpoints, Slack mapping and Visibuild sync health.
        </div>
      </div>

      <div className="m-cells">
        <div>
          <div className="text-4xl font-black leading-none">{totalProjects ?? 0}</div>
          <div className="m-label mt-1.5">Active projects</div>
        </div>
        <div>
          <div className="text-4xl font-black leading-none">{totalSubmissions ?? 0}</div>
          <div className="m-label mt-1.5">Total submissions</div>
        </div>
        <div
          style={
            pendingSync
              ? { background: "var(--color-accent)", color: "var(--color-bg)" }
              : undefined
          }
        >
          <div className="text-4xl font-black leading-none">{pendingSync ?? 0}</div>
          <div className="m-label mt-1.5" style={pendingSync ? { color: "inherit" } : undefined}>
            Failed Visibuild syncs
          </div>
        </div>
      </div>

      <div className="m-pad pb-16">
        {TOOLS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="m-rule grid grid-cols-[minmax(0,1fr)_40px] items-center gap-4 py-5"
          >
            <div>
              <div className="text-[19px] font-extrabold tracking-tight">{t.name}</div>
              <div
                className="mt-1 max-w-[62ch] text-[13px] text-[var(--color-neutral-700)]"
                style={{ textWrap: "pretty" }}
              >
                {t.body}
              </div>
            </div>
            <div className="text-right text-[19px] font-bold text-[var(--color-accent)]">→</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
