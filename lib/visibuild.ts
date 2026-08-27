// Visibuild write-back — STUBBED.
//
// The Visibuild connection this app currently has access to (via Claude's MCP
// session) is read-only: list/search/get on projects, visis, tickets, and
// documents. There is no create/upload/close endpoint exposed, so this file
// cannot actually push a photo into Visibuild or close an item yet.
//
// Wire this up for real once ProLine has a Visibuild API key with write
// scope (VISIBUILD_API_BASE_URL / VISIBUILD_API_KEY in .env): replace the
// body of `syncSubmissionToVisibuild` with the real HTTP call, and it will
// be picked up everywhere this function is already called from
// (app/api/submissions/route.ts).

import { createServiceClient } from "./supabase/server";

export interface VisibuildSyncResult {
  status: "synced" | "failed" | "not_configured";
  detail?: string;
}

export async function syncSubmissionToVisibuild(params: {
  submissionId: string;
  itpItemId: string;
  visibuildVisiId: string | null;
  photoPath: string;
}): Promise<VisibuildSyncResult> {
  const baseUrl = process.env.VISIBUILD_API_BASE_URL;
  const apiKey = process.env.VISIBUILD_API_KEY;

  const supabase = createServiceClient();

  if (!baseUrl || !apiKey || !params.visibuildVisiId) {
    await supabase.from("visibuild_sync_log").insert({
      submission_id: params.submissionId,
      itp_item_id: params.itpItemId,
      action: "close_with_photo",
      status: "not_synced",
      detail: "Visibuild write API not configured — closing item stays a manual step for now.",
    });
    return { status: "not_configured" };
  }

  try {
    // TODO: replace with the real Visibuild write endpoint once available, e.g.:
    // await fetch(`${baseUrl}/visis/${params.visibuildVisiId}/close`, {
    //   method: "POST",
    //   headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    //   body: JSON.stringify({ photo_url: signedUrlFor(params.photoPath) }),
    // });
    throw new Error("Visibuild write endpoint not implemented yet");
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await supabase.from("visibuild_sync_log").insert({
      submission_id: params.submissionId,
      itp_item_id: params.itpItemId,
      action: "close_with_photo",
      status: "failed",
      detail,
    });
    return { status: "failed", detail };
  }
}
