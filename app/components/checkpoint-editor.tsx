"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Checkpoint } from "@/lib/types";

async function callCheckpointsApi(method: "POST" | "PATCH" | "DELETE", body: unknown) {
  const res = await fetch("/api/checkpoints", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "Request failed");
}

export function CheckpointEditor({
  projectId,
  projectName,
  checkpoints,
}: {
  projectId: string;
  projectName: string;
  checkpoints: Checkpoint[];
}) {
  const router = useRouter();
  const [newLabel, setNewLabel] = useState("");
  const [newTime, setNewTime] = useState("08:30");
  const [newTarget, setNewTarget] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateTarget(id: string, targetCount: number) {
    setBusy(true);
    setError(null);
    try {
      await callCheckpointsApi("PATCH", { id, targetCount });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update target");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      await callCheckpointsApi("DELETE", { id });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove checkpoint");
    } finally {
      setBusy(false);
    }
  }

  async function addCheckpoint() {
    if (!newLabel) return;
    setBusy(true);
    setError(null);
    try {
      await callCheckpointsApi("POST", {
        projectId,
        label: newLabel,
        timeOfDay: `${newTime}:00`,
        targetCount: newTarget,
      });
      setNewLabel("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add checkpoint");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="font-medium text-zinc-900">{projectName}</p>
      <ul className="mt-2 space-y-1">
        {checkpoints.map((cp) => (
          <li key={cp.id} className="flex items-center gap-2 text-sm">
            <span className="w-24 text-zinc-600">{cp.label}</span>
            <span className="w-16 text-xs text-zinc-400">{cp.time_of_day.slice(0, 5)}</span>
            <input
              type="number"
              min={1}
              defaultValue={cp.target_count}
              disabled={busy}
              onBlur={(e) => updateTarget(cp.id, Number(e.target.value))}
              className="w-16 rounded border border-zinc-300 px-2 py-0.5 text-sm"
            />
            <button
              onClick={() => remove(cp.id)}
              disabled={busy}
              className="text-xs text-red-500 hover:underline disabled:opacity-50"
            >
              Remove
            </button>
          </li>
        ))}
        {checkpoints.length === 0 && (
          <li className="text-sm text-zinc-400">No checkpoints configured.</li>
        )}
      </ul>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
        <input
          placeholder="Label (e.g. Morning)"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          className="w-32 rounded border border-zinc-300 px-2 py-1 text-xs"
        />
        <input
          type="time"
          value={newTime}
          onChange={(e) => setNewTime(e.target.value)}
          className="rounded border border-zinc-300 px-2 py-1 text-xs"
        />
        <input
          type="number"
          min={1}
          value={newTarget}
          onChange={(e) => setNewTarget(Number(e.target.value))}
          className="w-16 rounded border border-zinc-300 px-2 py-1 text-xs"
        />
        <button
          onClick={addCheckpoint}
          disabled={busy || !newLabel}
          className="rounded bg-zinc-900 px-2 py-1 text-xs text-white disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}
