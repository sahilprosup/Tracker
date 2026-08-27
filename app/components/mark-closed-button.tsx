"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Visibuild write-back is stubbed (lib/visibuild.ts), so a submitted item
// never auto-closes. This lets a coordinator who has verified the close-out
// directly in Visibuild reflect that here too, instead of items sitting at
// "submitted" forever.
export function MarkClosedButton({ itemId, status }: { itemId: string; status: "submitted" | "closed" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function setStatus(next: "submitted" | "closed") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/itp-items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: itemId, status: next }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to update status");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {status === "closed" ? (
        <button
          onClick={() => setStatus("submitted")}
          disabled={busy}
          className="whitespace-nowrap text-xs text-zinc-400 underline decoration-dotted hover:text-zinc-600 disabled:opacity-50"
        >
          {busy ? "Reopening..." : "Reopen"}
        </button>
      ) : (
        <button
          onClick={() => setStatus("closed")}
          disabled={busy}
          className="whitespace-nowrap rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
        >
          {busy ? "Closing..." : "Mark closed"}
        </button>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
