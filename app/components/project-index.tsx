"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export interface ProjectRow {
  id: string;
  name: string;
  company: string;
  done: number;
  total: number;
  lastActivity: string | null;
}

const FILTERS = ["Live", "Not started", "All"] as const;
type Filter = (typeof FILTERS)[number];

function relativeTime(iso: string | null) {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24)
    return `Today ${new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return `${Math.round(days / 7)}w ago`;
}

export function ProjectIndex({ rows }: { rows: ProjectRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("Live");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !`${r.name} ${r.company}`.toLowerCase().includes(q)) return false;
      if (filter === "Live") return r.total > 0;
      if (filter === "Not started") return r.total === 0;
      return true;
    });
  }, [rows, query, filter]);

  return (
    <>
      <div className="m-pad m-rule sticky top-[47px] z-20 flex flex-wrap items-center gap-3 bg-[var(--color-bg)] py-3.5">
        <input
          type="search"
          placeholder="Search site or builder…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="m-input min-w-[160px] max-w-[400px] flex-[1_1_220px]"
          aria-label="Search projects"
        />
        <div className="m-seg">
          {FILTERS.map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
        <div className="ml-auto whitespace-nowrap text-xs text-[var(--color-neutral-700)]">
          {visible.length} of {rows.length} sites
        </div>
      </div>

      <div className="m-row m-row-head m-rule-strong border-b-2 py-2.5 !text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-neutral-700)]">
        <div>Site</div>
        <div>Builder</div>
        <div>ITP progress</div>
        <div>Last activity</div>
        <div />
      </div>

      {visible.map((r) => {
        const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
        const complete = r.total > 0 && r.done === r.total;
        const barColor = r.total === 0 ? "var(--color-neutral-300)" : complete ? "var(--color-text)" : "var(--color-accent)";

        return (
          <Link key={r.id} href={`/projects/${r.id}`} className="m-row">
            <div className="flex min-w-0 items-center gap-3.5">
              <span className="h-7 w-1 flex-none" style={{ background: barColor }} />
              <span className="text-lg font-bold tracking-tight" style={{ textWrap: "pretty" }}>
                {r.name}
              </span>
            </div>
            <div className="min-w-0 truncate text-[13px] text-[var(--color-neutral-700)]">{r.company}</div>
            <div>
              <div className="m-meter">
                <span style={{ width: `${pct}%`, background: barColor }} />
              </div>
              <div className="mt-1.5 text-[11px] font-semibold text-[var(--color-neutral-700)]">
                {r.total === 0 ? "No ITP items loaded" : `${r.done} / ${r.total} closed · ${pct}%`}
              </div>
            </div>
            <div className="text-xs text-[var(--color-neutral-600)]">{relativeTime(r.lastActivity)}</div>
            <div className="text-right text-[19px] font-bold text-[var(--color-accent)]">→</div>
          </Link>
        );
      })}

      {visible.length === 0 && (
        <div className="m-pad py-14 text-sm text-[var(--color-neutral-600)]">
          No sites match “{query}”.
        </div>
      )}
    </>
  );
}
