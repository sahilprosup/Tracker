import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SubmitPhotoButton } from "@/app/components/submit-photo-button";
import { AddItpItemForm } from "@/app/components/add-itp-item-form";
import { MarkClosedButton } from "@/app/components/mark-closed-button";
import { commonPrefixSegments, relativeSegments, detectUniformUnits } from "@/lib/location-tree";
import type { ItpItem } from "@/lib/types";

const TAG_CLASS: Record<string, string> = {
  open: "m-tag m-tag--open",
  submitted: "m-tag m-tag--submitted",
  closed: "m-tag m-tag--closed",
};

// Path segments are joined with "|" (not "/") because some real Visibuild
// location names contain a literal "/" (e.g. "Early Retail zone/Life
// Garden") - using "/" as the delimiter would split that name in half.
function encodePath(segments: string[]) {
  return segments.map(encodeURIComponent).join("|");
}
function decodePath(raw: string | undefined) {
  if (!raw) return [];
  return raw.split("|").filter(Boolean).map(decodeURIComponent);
}

function closedCount(items: ItpItem[]) {
  return items.filter((i) => i.status === "closed").length;
}

function ItemRow({ item, isCoordinator }: { item: ItpItem; isCoordinator: boolean }) {
  return (
    <div className="m-item-row">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-[11px] font-bold tracking-wide text-[var(--color-neutral-600)]">
            {item.alias}
          </span>
          <span className={TAG_CLASS[item.status]}>{item.status}</span>
          <span className="m-eyebrow text-[var(--color-neutral-500)]">{item.visi_type.replace("_", " ")}</span>
        </div>
        <div className="mt-1.5 text-base font-medium leading-snug" style={{ textWrap: "pretty" }}>
          {item.description}
        </div>
        {item.assignee && <div className="mt-1 text-xs text-[var(--color-neutral-600)]">Assigned to {item.assignee}</div>}
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
  );
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ path?: string; unit?: string }>;
}) {
  const { id } = await params;
  const { path: rawPath, unit: rawUnit } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const isCoordinator = profile?.role === "coordinator" || profile?.role === "admin";

  const { data: project } = await supabase.from("projects").select("id, name, company").eq("id", id).single();
  if (!project) notFound();

  const { data: itemsData } = await supabase
    .from("itp_items")
    .select("*")
    .eq("project_id", id)
    .order("location_order", { ascending: true, nullsFirst: false })
    .order("location_path");
  const all = (itemsData ?? []) as ItpItem[];

  const root = commonPrefixSegments(all.map((i) => i.location_path).filter((p): p is string => !!p));
  const currentPath = decodePath(rawPath);

  const withRelSegs = all.map((item) => ({
    item,
    relSegs: item.location_path ? relativeSegments(item.location_path, root) : [],
  }));
  const currentKey = currentPath.join(" / ");
  const atNode = withRelSegs.filter((x) => x.relSegs.join(" / ") === currentKey);
  const below = withRelSegs.filter(
    (x) => x.relSegs.length > currentPath.length && x.relSegs.slice(0, currentPath.length).join(" / ") === currentKey,
  );

  const breadcrumb = [
    { label: project.name, href: `/projects/${id}` },
    ...currentPath.map((seg, i) => ({
      label: seg,
      href: `/projects/${id}?path=${encodePath(currentPath.slice(0, i + 1))}`,
    })),
  ];

  const totalItems = all.length;

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
          <div className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-[var(--color-neutral-600)]">
            {breadcrumb.map((crumb, i) => (
              <span key={crumb.href} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-[var(--color-neutral-400)]">/</span>}
                {i === breadcrumb.length - 1 ? (
                  <span className="font-semibold text-[var(--color-neutral-900)]">{crumb.label}</span>
                ) : (
                  <Link href={crumb.href} className="hover:underline">
                    {crumb.label}
                  </Link>
                )}
              </span>
            ))}
          </div>
          <h1 className="m-display mt-2" style={{ textWrap: "pretty" }}>
            {currentPath.length ? currentPath[currentPath.length - 1] : project.name}
          </h1>
          <div className="mt-2 text-[13px] text-[var(--color-neutral-700)]">
            {project.company} ·{" "}
            {totalItems ? `${closedCount(all)} of ${totalItems} ITP items closed` : "No ITP items loaded"}
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href={`/projects/${id}/report`} className="m-btn">
            Daily report
          </Link>
        </div>
      </div>

      {isCoordinator && currentPath.length === 0 && (
        <div className="m-pad m-rule py-4">
          <AddItpItemForm projectId={id} />
        </div>
      )}

      {totalItems === 0 && (
        <p className="m-pad py-14 text-sm text-[var(--color-neutral-600)]">
          No ITP items loaded for this project yet. Run a Visibuild sync or add one manually.
        </p>
      )}

      {below.length > 0 ? (
        <ZoneButtons id={id} currentPath={currentPath} below={below} />
      ) : (
        <LeafView id={id} currentPath={currentPath} items={atNode.map((x) => x.item)} unitParam={rawUnit} isCoordinator={isCoordinator} />
      )}

      <div className="pb-16" />
    </div>
  );
}

function ZoneButtons({
  id,
  currentPath,
  below,
}: {
  id: string;
  currentPath: string[];
  below: { item: ItpItem; relSegs: string[] }[];
}) {
  const nextIndex = currentPath.length;
  const groups = new Map<string, { items: ItpItem[]; minOrder: number }>();
  for (const { item, relSegs } of below) {
    const key = relSegs[nextIndex];
    const g = groups.get(key) ?? { items: [], minOrder: Infinity };
    g.items.push(item);
    g.minOrder = Math.min(g.minOrder, item.location_order ?? Infinity);
    groups.set(key, g);
  }
  const sorted = [...groups.entries()].sort((a, b) => a[1].minOrder - b[1].minOrder);

  return (
    <div className="m-pad grid grid-cols-1 gap-2.5 py-5 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map(([label, g]) => (
        <Link
          key={label}
          href={`/projects/${id}?path=${encodePath([...currentPath, label])}`}
          className="m-rule flex flex-col gap-1.5 rounded-md border border-[var(--color-neutral-200)] p-4 transition hover:border-[var(--color-neutral-400)]"
        >
          <span className="text-base font-semibold" style={{ textWrap: "pretty" }}>
            {label}
          </span>
          <span className="m-eyebrow text-[var(--color-neutral-600)]">
            {g.items.length} items · {closedCount(g.items)} closed
          </span>
        </Link>
      ))}
    </div>
  );
}

function LeafView({
  id,
  currentPath,
  items,
  unitParam,
  isCoordinator,
}: {
  id: string;
  currentPath: string[];
  items: ItpItem[];
  unitParam: string | undefined;
  isCoordinator: boolean;
}) {
  if (items.length === 0) return null;

  const units = detectUniformUnits(items);

  if (!units) {
    return (
      <section>
        <div className="m-pad m-rule-strong flex items-baseline justify-between gap-4 pb-2 pt-4.5">
          <h2 className="text-[13px] font-extrabold uppercase tracking-[0.12em]">Items</h2>
          <span className="m-eyebrow text-[var(--color-neutral-700)]">
            {items.length} items · {closedCount(items)} closed
          </span>
        </div>
        {items.map((item) => (
          <ItemRow key={item.id} item={item} isCoordinator={isCoordinator} />
        ))}
      </section>
    );
  }

  const unitIndex = unitParam !== undefined ? parseInt(unitParam, 10) : NaN;
  const selected = Number.isInteger(unitIndex) ? units[unitIndex] : undefined;

  if (selected) {
    const unitItems = [selected.anchor, ...selected.sections];
    return (
      <section>
        <div className="m-pad m-rule-strong flex items-baseline justify-between gap-4 pb-2 pt-4.5">
          <Link href={`/projects/${id}?path=${encodePath(currentPath)}`} className="m-eyebrow hover:underline">
            ← All units
          </Link>
          <span className="m-eyebrow text-[var(--color-neutral-700)]">
            {closedCount(unitItems)} of {unitItems.length} closed
          </span>
        </div>
        <h2 className="m-pad pt-3 text-lg font-semibold" style={{ textWrap: "pretty" }}>
          {selected.label}
        </h2>
        {unitItems.map((item) => (
          <ItemRow key={item.id} item={item} isCoordinator={isCoordinator} />
        ))}
      </section>
    );
  }

  return (
    <section>
      <div className="m-pad m-rule-strong flex items-baseline justify-between gap-4 pb-2 pt-4.5">
        <h2 className="text-[13px] font-extrabold uppercase tracking-[0.12em]">Checklist units</h2>
        <span className="m-eyebrow text-[var(--color-neutral-700)]">{units.length} units</span>
      </div>
      <div className="m-pad grid grid-cols-1 gap-2.5 py-5 sm:grid-cols-2 lg:grid-cols-3">
        {units.map((unit, i) => {
          const unitItems = [unit.anchor, ...unit.sections];
          return (
            <Link
              key={unit.anchor.id}
              href={`/projects/${id}?path=${encodePath(currentPath)}&unit=${i}`}
              className="m-rule flex flex-col gap-1.5 rounded-md border border-[var(--color-neutral-200)] p-4 transition hover:border-[var(--color-neutral-400)]"
            >
              <span className="text-base font-semibold" style={{ textWrap: "pretty" }}>
                {unit.label}
              </span>
              <span className="m-eyebrow text-[var(--color-neutral-600)]">
                {unitItems.length} sections · {closedCount(unitItems)} closed
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
