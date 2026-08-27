"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Despite the filename, this handles ANY ITP evidence: a camera photo taken
// on-site, a gallery photo, or a document (PDF/Word/etc — e.g. a supplier
// datasheet or signed form). Mobile gets the camera by default via
// capture="environment" but the native file picker still lets a site worker
// choose "Photo Library" or "Browse" for a document instead.
export function SubmitPhotoButton({ itpItemId }: { itpItemId: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 active:bg-zinc-800 sm:w-auto sm:px-3 sm:py-1.5 sm:text-xs"
      >
        + Add photo / document
      </button>
    );
  }

  return (
    <div className="w-full rounded-md border border-zinc-200 bg-white p-3 shadow-sm sm:w-72">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
        capture="environment"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full text-xs"
      />
      {file && <p className="mt-1 truncate text-xs text-zinc-500">{file.name}</p>}
      <textarea
        placeholder="Optional note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mt-2 w-full rounded border border-zinc-300 p-1.5 text-sm sm:text-xs"
        rows={2}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 sm:py-1 sm:text-xs"
        >
          {submitting ? "Uploading..." : "Submit"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-600 sm:py-1 sm:text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
