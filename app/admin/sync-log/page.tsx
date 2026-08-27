import Link from "next/link";
import { requireCoordinator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

interface SyncLogRow {
  id: string;
  action: string;
  status: string;
  detail: string | null;
  created_at: string;
  itp_items: {
    alias: string | null;
    description: string;
    projects: { name: string } | null;
  } | null;
}

const STATUS_STYLES: Record<string, string> = {
  not_synced: "bg-zinc-100 text-zinc-600",
  pending: "bg-amber-100 text-amber-700",
  synced: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

export default async function SyncLogPage() {
  await requireCoordinator();
  const supabase = await createClient();

  const { data: logs } = await supabase
    .from("visibuild_sync_log")
    .select("id, action, status, detail, created_at, itp_items(alias, description, projects(name))")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/admin" className="text-xs text-zinc-400 hover:text-zinc-600">
        ← Admin
      </Link>
      <h1 className="mt-1 text-2xl font-semibold text-zinc-900">Visibuild sync log</h1>
      <p className="text-sm text-zinc-500">
        Every attempt to close an ITP item in Visibuild after a photo submission. Currently
        everything logs as <span className="font-mono text-xs">not_synced</span> because Visibuild
        write access isn&apos;t wired up yet — see README.
      </p>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-400">
            <th className="py-2">Time</th>
            <th className="py-2">Project</th>
            <th className="py-2">Item</th>
            <th className="py-2">Status</th>
            <th className="py-2">Detail</th>
          </tr>
        </thead>
        <tbody>
          {((logs ?? []) as unknown as SyncLogRow[]).map((log) => (
            <tr key={log.id} className="border-b border-zinc-100">
              <td className="py-2 text-zinc-500 whitespace-nowrap">
                {new Date(log.created_at).toLocaleString()}
              </td>
              <td className="py-2">{log.itp_items?.projects?.name}</td>
              <td className="py-2">
                {log.itp_items?.alias} — {log.itp_items?.description}
              </td>
              <td className="py-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${STATUS_STYLES[log.status]}`}>
                  {log.status}
                </span>
              </td>
              <td className="py-2 text-zinc-500">{log.detail}</td>
            </tr>
          ))}
          {(logs ?? []).length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-zinc-400">
                No sync attempts yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
