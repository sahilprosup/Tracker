"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Handles ANY ITP evidence: a camera photo taken on-site, a gallery photo, or
// a document (PDF/Word/etc). Mobile gets the camera by default via
// capture="environment"; the native picker still allows Photo Library / Browse.
const MAX_FILE_BYTES = 20 * 1024 * 1024;

export function SubmitPhotoButton({
  itpItemId,
  itemLabel,
}: {
  itpItemId: string;
  itemLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function pickFile(capture: boolean) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,application/pdf,.doc,.docx,.xls,.xlsx";
    if (capture) input.setAttribute("capture", "environment");
    input.onchange = () => {
      const picked = input.files?.[0] ?? null;
      if (picked && picked.size > MAX_FILE_BYTES) {
        setError(
          `That file is ${(picked.size / 1024 / 1024).toFixed(0)}MB — 20MB max. Try a smaller photo or a compressed file.`,
        );
        setFile(null);
        return;
      }
      setError(null);
      setFile(picked);
    };
    input.click();
  }

  async function handleSubmit() {
    if (!file) {
      setError("Add a photo or document first.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");

      const path = `${itpItemId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("itp-photos")
        .upload(path, file, { contentType: file.type || undefined });
      if (uploadError) throw uploadError;

      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itpItemId,
          photoPath: path,
          note,
          fileName: file.name,
          mimeType: file.type || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Submission failed");

      setOpen(false);
      setFile(null);
      setNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function close() {
    setOpen(false);
    setFile(null);
    setNote("");
    setError(null);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="m-btn m-btn--primary m-btn--touch">
        + Add evidence
      </button>
    );
  }

  return (
    <div className="m-backdrop" role="dialog" aria-modal="true" aria-label="Add evidence">
      <div className="m-dialog">
        <div className="m-rule-strong flex items-start justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <div className="m-kicker">Add evidence</div>
            <div className="mt-1.5 text-xl font-extrabold leading-tight tracking-tight" style={{ textWrap: "pretty" }}>
              {itemLabel ?? "ITP item"}
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="m-btn h-[34px] min-h-0 flex-none justify-center px-0 text-[15px]"
            style={{ width: 34 }}
          >
            ✕
          </button>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => pickFile(true)}
              className="min-h-[92px] cursor-pointer border-2 border-[var(--color-divider)] bg-[var(--color-text)] px-4 py-3.5 text-left text-[var(--color-bg)]"
            >
              <div className="text-[22px] leading-none">◉</div>
              <div className="m-eyebrow mt-2.5 tracking-[0.08em]">Take photo</div>
            </button>
            <button
              type="button"
              onClick={() => pickFile(false)}
              className="min-h-[92px] cursor-pointer border-2 border-[var(--color-divider)] px-4 py-3.5 text-left hover:bg-[var(--color-neutral-200)]"
            >
              <div className="text-[22px] leading-none">▤</div>
              <div className="m-eyebrow mt-2.5 tracking-[0.08em]">Photo library or document</div>
            </button>
          </div>

          {file && (
            <div className="mt-3.5 flex items-center gap-3.5 border-2 border-[var(--color-divider)] bg-[var(--color-neutral-200)] px-3.5 py-3">
              <div className="grayscale h-[46px] w-[46px] flex-none bg-[var(--color-neutral-400)]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold">{file.name}</div>
                <div className="text-[11px] text-[var(--color-neutral-700)]">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="m-eyebrow cursor-pointer text-[var(--color-accent-700)]"
              >
                Remove
              </button>
            </div>
          )}

          <div className="mt-4">
            <label htmlFor="note" className="m-label mb-2 block">
              Note (optional)
            </label>
            <textarea
              id="note"
              rows={2}
              placeholder="e.g. Bolts torqued to 180Nm, witness point signed"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="m-input h-auto resize-y py-2.5 text-sm"
            />
          </div>

          {error && (
            <div
              className="mt-3.5 border-l-4 px-3.5 py-3 text-[13px] font-semibold leading-snug"
              style={{
                background: "var(--color-accent-200)",
                borderColor: "var(--color-accent)",
                color: "var(--color-accent-800)",
              }}
            >
              {error}
            </div>
          )}

          <div className="m-rule mt-4 flex items-center justify-between gap-3 border bg-[var(--color-neutral-200)] px-3.5 py-2.5">
            <div className="text-xs text-[var(--color-neutral-700)]">
              Counted against today&apos;s checkpoint · pushes to Visibuild on save
            </div>
            <span className="m-eyebrow text-[var(--color-accent-700)]">Auto</span>
          </div>
        </div>

        <div className="m-rule-strong flex gap-2.5 border-b-0 border-t-2 px-5 py-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !file}
            className="m-btn m-btn--primary m-btn--lg flex-1"
          >
            {submitting ? "Uploading…" : file ? "Submit evidence" : "Attach something first"}
          </button>
          <button type="button" onClick={close} className="m-btn m-btn--lg">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
