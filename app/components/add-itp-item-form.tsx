"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VisiType } from "@/lib/types";

type Mode = "single" | "bulk";

function parseBulkLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      // location | alias | description  (only description is required;
      // a single-column line is treated as just the description)
      if (parts.length >= 3) {
        return { locationPath: parts[0], alias: parts[1], description: parts.slice(2).join(" | ") };
      }
      if (parts.length === 2) {
        return { locationPath: parts[0], description: parts[1] };
      }
      return { description: parts[0] };
    });
}

export function AddItpItemForm({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("single");
  const [description, setDescription] = useState("");
  const [locationPath, setLocationPath] = useState("");
  const [alias, setAlias] = useState("");
  const [visiType, setVisiType] = useState<VisiType>("task");
  const [bulkText, setBulkText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState<number | null>(null);
  const router = useRouter();

  async function handleSubmitSingle() {
    if (!description) {
      setError("Description is required.");
      return;
    }
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/itp-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, description, locationPath, alias, visiType }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to add item");

      setDescription("");
      setLocationPath("");
      setAlias("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitBulk() {
    const items = parseBulkLines(bulkText);
    if (items.length === 0) {
      setError("Paste at least one line.");
      return;
    }
    setBusy(true);
    setError(null);
    setAddedCount(null);

    try {
      const res = await fetch("/api/itp-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, items }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to add items");

      const { count } = await res.json();
      setAddedCount(count);
      setBulkText("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
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
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-800">Add ITP items</p>
        <div className="flex rounded-md border border-zinc-200 p-0.5 text-xs">
          <button
            onClick={() => setMode("single")}
            className={`rounded px-2 py-1 ${mode === "single" ? "bg-zinc-900 text-white" : "text-zinc-500"}`}
          >
            One at a time
          </button>
          <button
            onClick={() => setMode("bulk")}
            className={`rounded px-2 py-1 ${mode === "bulk" ? "bg-zinc-900 text-white" : "text-zinc-500"}`}
          >
            Paste a list
          </button>
        </div>
      </div>
      <p className="mt-0.5 text-xs text-zinc-400">
        For items not yet synced from Visibuild.
      </p>

      {mode === "single" ? (
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
      ) : (
        <div className="mt-3">
          <textarea
            placeholder={
              "One item per line. Optional fields separated by | :\n" +
              "Facade / Level 2 / Zone A | MHCOB-101 | Cladding installed with correct fixings\n" +
              "Facade / Level 3 | Flashing installed to shop drawing\n" +
              "Waterproofing membrane inspection"
            }
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={6}
            className="w-full rounded border border-zinc-300 px-2 py-1.5 font-mono text-xs"
          />
          <p className="mt-1 text-xs text-zinc-400">
            Format: <code className="font-mono">location | alias | description</code> — earlier
            columns are optional, so a plain line is just a description.{" "}
            {bulkText.trim() && (
              <span>{parseBulkLines(bulkText).length} item(s) ready.</span>
            )}
          </p>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {addedCount !== null && (
        <p className="mt-2 text-xs text-emerald-600">Added {addedCount} item(s).</p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={mode === "single" ? handleSubmitSingle : handleSubmitBulk}
          disabled={busy}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {busy ? "Adding..." : mode === "single" ? "Add item" : "Add all"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600"
        >
          Close
        </button>
      </div>
    </div>
  );
}
