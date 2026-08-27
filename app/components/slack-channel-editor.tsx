"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SlackChannelEditor({ projectId, initialChannelId }: { projectId: string; initialChannelId: string | null }) {
  const [value, setValue] = useState(initialChannelId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId, slackChannelId: value.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        placeholder="Channel ID (e.g. C0123ABC456)"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        className="w-44 rounded border border-zinc-300 px-2 py-1 font-mono text-xs"
      />
      <button
        onClick={save}
        disabled={busy}
        className="rounded bg-zinc-900 px-2 py-1 text-xs text-white disabled:opacity-50"
      >
        {busy ? "Saving..." : "Save"}
      </button>
      {saved && <span className="text-xs text-emerald-600">Saved</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
