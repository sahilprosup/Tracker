"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VisiType } from "@/lib/types";

export function AddItpItemForm({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [locationPath, setLocationPath] = useState("");
  const [alias, setAlias] = useState("");
  const [visiType, setVisiType] = useState<VisiType>("task");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit() {
    if (!description) {
      setError("Description is required.");
      return;
    }
    setBusy(true);
    setError(null);

    const res = await fetch("/api/itp-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, description, locationPath, alias, visiType }),
    });

    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Failed to add item");
      return;
    }

    setDescription("");
    setLocationPath("");
    setAlias("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
      >
        + Add ITP item manually
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-sm font-medium text-zinc-800">Add ITP item</p>
      <p className="mt-0.5 text-xs text-zinc-400">
        For items not yet synced from Visibuild.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <input
          placeholder="Location (e.g. Facade / Level 2 / Zone A)"
          value={locationPath}
          onChange={(e) => setLocationPath(e.target.value)}
          className="col-span-2 rounded border border-zinc-300 px-2 py-1.5 text-sm"
        />
        <input
          placeholder="Alias (e.g. MHCOB-123)"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
        />
        <select
          value={visiType}
          onChange={(e) => setVisiType(e.target.value as VisiType)}
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
        >
          <option value="task">Task</option>
          <option value="inspection">Inspection</option>
          <option value="hold_point">Hold point</option>
        </select>
        <textarea
          placeholder="Description (e.g. Cladding installed with correct orientation and fixings)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="col-span-2 rounded border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={busy}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {busy ? "Adding..." : "Add item"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
