import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { SignOutButton } from "@/app/components/sign-out-button";
import { ProjectIndex } from "@/app/components/project-index";
import { nowInMelbourne, melbourneDayBoundsUtc } from "@/lib/time";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { start: todayStart } = melbourneDayBoundsUtc(nowInMelbourne().date);

  const [
    {
      data: { session },
    },
    { data: projects },
    { data: itemCounts },
    { data: lastActivity },
  ] = await Promise.all([
    // getSession() reads the cookie locally instead of round-tripping to
    // Supabase Auth - safe here because the proxy middleware already called
    // getUser() (which does hit the network) to validate/refresh it for
    // every request that reaches this page.
    supabase.auth.getSession(),
    supabase.from("projects").select("id, name, company, active").eq("active", true).order("name"),
    supabase.from("itp_items").select("project_id, status"),
    supabase
      .from("submissions")
      .select("submitted_at, itp_items(project_id)")
      .order("submitted_at", { ascending: false })
      .limit(500),
  ]);
  const user = session?.user ?? null;

  const [profile, { count: myTodayCount }] = await Promise.all([
    user ? getProfile(supabase, user) : Promise.resolve(null),
    user
      ? supabase
          .from("submissions")
          .select("id", { count: "exact", head: true })
          .eq("submitted_by", user.id)
          .gte("submitted_at", todayStart)
      : Promise.resolve({ count: null }),
  ]);
  const isCoordinator = profile?.role === "coordinator" || profile?.role === "admin";

  const countsByProject = new Map<string, { total: number; done: number }>();
  for (const row of itemCounts ?? []) {
    const entry = countsByProject.get(row.project_id) ?? { total: 0, done: 0 };
    entry.total += 1;
    if (row.status === "submitted" || row.status === "closed") entry.done += 1;
    countsByProject.set(row.project_id, entry);
  }

  const lastByProject = new Map<string, string>();
  for (const row of (lastActivity ?? []) as { submitted_at: string; itp_items: { project_id: string }[] | null }[]) {
    const pid = row.itp_items?.[0]?.project_id;
    if (pid && !lastByProject.has(pid)) lastByProject.set(pid, row.submitted_at);
  }

  const openItems = [...countsByProject.values()].reduce((a, c) => a + (c.total - c.done), 0);

  const rows = (projects ?? []).map((p) => {
    const c = countsByProject.get(p.id) ?? { total: 0, done: 0 };
    return {
      id: p.id,
      name: p.name,
      company: p.company ?? "—",
      done: c.done,
      total: c.total,
      lastActivity: lastByProject.get(p.id) ?? null,
    };
  });

  return (
    <div>
      <header className="m-header">
        <Link href="/dashboard" className="m-brand">
          <span className="m-brand-mark">ProLine</span>
          <span className="inline-block h-[13px] w-px bg-[var(--color-neutral-400)]" />
          <span className="m-brand-sub">ITP Tracker</span>
        </Link>
        <div className="flex items-center gap-4">
          {isCoordinator && (
            <Link href="/admin" className="m-navlink">
              Admin
            </Link>
          )}
          <SignOutButton />
        </div>
      </header>

      <div className="m-pad m-rule-strong grid grid-cols-1 items-end gap-8 pb-5 pt-9 md:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <div className="m-kicker mb-2.5">
            {new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <h1 className="m-display">Projects</h1>
        </div>
        <div className="m-stats">
          <div>
            <div className="m-stat-value">{rows.length}</div>
            <div className="m-label mt-1.5">Active sites</div>
          </div>
          <div>
            <div className="m-stat-value">{openItems}</div>
            <div className="m-label mt-1.5">Open items</div>
          </div>
          <div>
            <div className="m-stat-value m-stat-value--accent">{myTodayCount ?? 0}</div>
            <div className="m-label mt-1.5">Your uploads today</div>
          </div>
        </div>
      </div>

      <ProjectIndex rows={rows} />

      <div className="m-pad m-rule-strong border-b-0 border-t-2 pb-16 pt-7 text-xs text-[var(--color-neutral-600)]">
        Synced from Visibuild · Slack ingest active
      </div>
    </div>
  );
}
