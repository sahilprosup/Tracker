import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SubmitPhotoButton } from "@/app/components/submit-photo-button";
import type { ItpItem } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-zinc-100 text-zinc-600",
  submitted: "bg-amber-100 text-amber-700",
  closed: "bg-emerald-100 text-emerald-700",
};

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, company")
    .eq("id", id)
    .single();

  const { data: items } = await supabase
    .from("itp_items")
    .select("*")
    .eq("project_id", id)
    .order("location_path");

  const grouped = new Map<string, ItpItem[]>();
  for (const item of (items ?? []) as ItpItem[]) {
    const key = item.location_path ?? "Unassigned location";
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-xs text-zinc-400 hover:text-zinc-600">
            ← All projects
          </Link>
          <h1 className="text-2xl font-semibold text-zinc-900">{project?.name}</h1>
          <p className="text-sm text-zinc-500">{project?.company}</p>
        </div>
        <Link
          href={`/projects/${id}/report`}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
        >
          View daily report
        </Link>
      </div>

      {grouped.size === 0 && (
        <p className="rounded-md border border-dashed border-zinc-300 p-6 text-sm text-zinc-500">
          No ITP items loaded for this project yet.
        </p>
      )}

      <div className="space-y-6">
        {[...grouped.entries()].map(([location, locationItems]) => (
          <div key={location} className="rounded-lg border border-zinc-200 bg-white">
            <div className="border-b border-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700">
              {location}
            </div>
            <ul className="divide-y divide-zinc-100">
              {locationItems.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-zinc-400">{item.alias}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${STATUS_STYLES[item.status]}`}
                      >
                        {item.status}
                      </span>
                      <span className="text-[10px] uppercase text-zinc-400">{item.visi_type.replace("_", " ")}</span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-800">{item.description}</p>
                    {item.assignee && (
                      <p className="mt-0.5 text-xs text-zinc-400">Assignee: {item.assignee}</p>
                    )}
                  </div>
                  {item.status === "open" ? (
                    <SubmitPhotoButton itpItemId={item.id} />
                  ) : (
                    <span className="whitespace-nowrap text-xs text-zinc-400">
                      Submitted ✓
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
