import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/app/components/sign-out-button";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const isCoordinator = profile?.role === "coordinator" || profile?.role === "admin";

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, company, active")
    .eq("active", true)
    .order("name");

  const { data: itemCounts } = await supabase
    .from("itp_items")
    .select("project_id, status");

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { count: myTodayCount } = user
    ? await supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("submitted_by", user.id)
        .gte("submitted_at", todayStart.toISOString())
    : { count: null };

  const countsByProject = new Map<string, { total: number; submitted: number; closed: number }>();
  for (const row of itemCounts ?? []) {
    const entry = countsByProject.get(row.project_id) ?? { total: 0, submitted: 0, closed: 0 };
    entry.total += 1;
    if (row.status === "submitted") entry.submitted += 1;
    if (row.status === "closed") entry.closed += 1;
    countsByProject.set(row.project_id, entry);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Projects</h1>
          <p className="text-sm text-zinc-500">ITP checklist progress across all active sites.</p>
        </div>
        <div className="flex items-center gap-3">
          {isCoordinator && (
            <Link
              href="/admin"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              Admin
            </Link>
          )}
          <SignOutButton />
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-zinc-200 bg-white px-4 py-3">
        <p className="text-xs text-zinc-500">Your submissions today</p>
        <p className="text-xl font-semibold text-zinc-900">{myTodayCount ?? 0}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(projects ?? []).map((project) => {
          const counts = countsByProject.get(project.id) ?? { total: 0, submitted: 0, closed: 0 };
          const done = counts.submitted + counts.closed;
          const pct = counts.total ? Math.round((done / counts.total) * 100) : 0;

          return (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-400"
            >
              <h2 className="font-medium text-zinc-900">{project.name}</h2>
              <p className="text-xs text-zinc-500">{project.company}</p>
              {counts.total > 0 ? (
                <>
                  <div className="mt-3 h-2 w-full rounded-full bg-zinc-100">
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {done}/{counts.total} ITP items submitted or closed ({pct}%)
                  </p>
                </>
              ) : (
                <p className="mt-3 text-xs text-zinc-400">No ITP items loaded yet</p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
