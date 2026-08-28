"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MarkClosedButton({ itemId, status }: { itemId: string; status: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  if (status === "closed") {
    return <span className="m-eyebrow whitespace-nowrap text-[var(--color-neutral-600)]">Closed ✓</span>;
  }

  async function markClosed() {
    setBusy(true);
    await fetch(`/api/itp-items`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: itemId, status: "closed" }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <button type="button" onClick={markClosed} disabled={busy} className="m-btn m-btn--touch">
      {busy ? "Closing…" : "Mark closed"}
    </button>
  );
}
