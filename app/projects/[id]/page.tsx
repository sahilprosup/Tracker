import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { SubmitPhotoButton } from "@/app/components/submit-photo-button";
import { AddItpItemForm } from "@/app/components/add-itp-item-form";
import { MarkClosedButton } from "@/app/components/mark-closed-button";
import type { ItpItem } from "@/lib/types";

const TAG_CLASS: Record<string, string> = {
  open: "m-tag m-tag--open",
  submitted: "m-tag m-tag--submitted",
  closed: "m-tag m-tag--closed",
};

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    {
      data: { session },
    },
    { data: project },
  ] = await Promise.all([
    // getSession() reads the cookie locally instead of round-tripping to
    // Supabase Auth - safe here because the proxy middleware already called
    // getUser() (which does hit the network) to validate/refresh it for
    // every request that reaches this page.
    supabase.auth.getSession(),
    supabase.from("projects").select("id, name, company").eq("id", id).single(),
  ]);
  const user = session?.user ?? null;

  if (!project) notFound();

  const [profile, { data: items }] = await Promise.all([
    user ? getProfile(supabase, user) : Promise.resolve(null),
    supabase
      .from("itp_items")
      .select("*")
      .eq("project_id", id)
      // Visibuild's location tree has a manually-set sibling order that isn't
      // alphabetical (e.g. "Small Plantroom Zone A4" is listed before "Big
      // Plantroom Zone A2" under the same parent in Visibuild itself), so
      // sorting the location_path string alphabetically scrambles sections
      // compared to how they appear in Visibuild. location_order holds that
      // real order where it's been backfilled; items without it (not yet
      // backfilled for this project) sort alphabetically after everything
      // that has an order, rather than being interleaved arbitrarily.
      .order("location_order", { ascending: true, nullsFirst: false })
      .order("location_path"),
  ]);
  const isCoordinator = profile?.role === "coordinator" || profile?.role === "admin";

  const all = (items ?? []) as ItpItem[];
  const closed = all.filter((i) => i.status === "closed").length;

  const grouped = new Map<string, ItpItem[]>();
  for (const item of all) {
    const key = item.location_path ?? "Unassigned location";
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }

  return (
    <div>
      <header className="m-header">
        <Link href="/dashboard" className="m-brand">
          <span className="m-brand-mark">ProLine</span>
          <span className="inline-block h-[13px] w-px bg-[var(--color-neutral-400)]" />
          <span className="m-brand-sub">ITP Tracker</span>
        </Link>
        <Link href={`/projects/${id}/report`} className="m-navlink">
          Daily report
        </Link>
      </header>

      <div className="m-pad m-rule-strong grid grid-cols-1 items-end gap-6 pb-5 pt-7 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <Link href="/dashboard" className="m-eyebrow text-[var(--color-neutral-700)]">
            ← All projects
          </Link>
          <h1 className="m-display mt-2.5" style={{ textWrap: "pretty" }}>
            {project.name}
          </h1>
          <div className="mt-2 text-[13px] text-[var(--color-neutral-700)]">
            {project.company} ·{" "}
            {all.length ? `${closed} of ${all.length} ITP items closed` : "No ITP items loaded"}
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href={`/projects/${id}/report`} className="m-btn">
            Daily report
          </Link>
        </div>
      </div>

      {isCoordinator && (
        <div className="m-pad m-rule py-4">
          <AddItpItemForm projectId={id} />
        </div>
      )}

      {grouped.size === 0 && (
        <p className="m-pad py-14 text-sm text-[var(--color-neutral-600)]">
          No ITP items loaded for this project yet. Run a Visibuild sync or add one manually.
        </p>
      )}

      {[...grouped.entries()].map(([location, locationItems]) => (
        <section key={location}>
          <div className="m-pad m-rule-strong flex items-baseline justify-between gap-4 pb-2 pt-4.5">
            <h2 className="text-[13px] font-extrabold uppercase tracking-[0.12em]">{location}</h2>
            <span className="m-eyebrow text-[var(--color-neutral-700)]">
              {locationItems.length} items · {locationItems.filter((i) => i.status === "closed").length} closed
            </span>
          </div>

          {locationItems.map((item) => (
            <div key={item.id} className="m-item-row">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-mono text-[11px] font-bold tracking-wide text-[var(--color-neutral-600)]">
                    {item.alias}
                  </span>
                  <span className={TAG_CLASS[item.status]}>{item.status}</span>
                  <span className="m-eyebrow text-[var(--color-neutral-500)]">
                    {item.visi_type.replace("_", " ")}
                  </span>
                </div>
                <div className="mt-1.5 text-base font-medium leading-snug" style={{ textWrap: "pretty" }}>
                  {item.description}
                </div>
                {item.assignee && (
                  <div className="mt-1 text-xs text-[var(--color-neutral-600)]">
                    Assigned to {item.assignee}
                  </div>
                )}
              </div>

              {item.status === "open" ? (
                <SubmitPhotoButton itpItemId={item.id} itemLabel={`${item.alias ?? ""} — ${item.description}`} />
              ) : isCoordinator ? (
                <MarkClosedButton itemId={item.id} status={item.status} />
              ) : (
                <span className="m-eyebrow whitespace-nowrap text-[var(--color-neutral-600)]">
                  {item.status === "closed" ? "Closed ✓" : "Submitted ✓"}
                </span>
              )}
            </div>
          ))}
        </section>
      ))}

      <div className="pb-16" />
    </div>
  );
}
