// Visibuild write-back.
//
// Confirmed against Visibuild's own docs (help.visibuild.com, "Uploading
// attachments via API"): a two-step upload (request a presigned S3 URL, PUT
// the file to it) followed by referencing the returned key when creating a
// record. The only "create a record with attachmentKeys" example Visibuild
// gave us is POST /api/core/v1/tickets - there is no confirmed endpoint for
// attaching a photo directly to an existing *visi* (an ITP checklist item)
// or marking one closed. So today this creates a new Visibuild ticket
// referencing the project, with the ITP item's details in the title/
// description and the photo attached - it does NOT close the original visi
// in Visibuild. If Visibuild's API has a "visis" resource that accepts
// attachmentKeys (or a dedicated close/complete endpoint), swap the call in
// createVisibuildRecord() for that instead - everything else here already
// does the real upload.

import { createServiceClient } from "./supabase/server";
import crypto from "node:crypto";

const DEFAULT_BASE_URL = "https://app.apac.visibuild.com";

export interface VisibuildSyncResult {
  status: "synced" | "failed" | "not_configured";
  detail?: string;
}

function apiBase() {
  return process.env.VISIBUILD_API_BASE_URL || DEFAULT_BASE_URL;
}

function authHeaders() {
  const token = process.env.VISIBUILD_ACCESS_TOKEN;
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

interface PresignedUpload {
  key: string;
  filename: string;
  url: string;
  headers: Record<string, string>;
}

async function requestPresignedUpload(params: {
  filename: string;
  contentType: string;
  fileBytes: Buffer;
}): Promise<PresignedUpload> {
  const checksum = crypto.createHash("md5").update(params.fileBytes).digest("base64");

  const res = await fetch(`${apiBase()}/api/core/v1/attachments`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      filename: params.filename,
      contentType: params.contentType,
      fileSize: params.fileBytes.length,
      checksum,
    }),
  });

  if (!res.ok) {
    throw new Error(`Visibuild presigned-upload request failed: ${res.status} ${await res.text()}`);
  }

  const { data } = await res.json();
  return { ...data.upload, headers: { ...data.upload.headers, "Content-MD5": checksum } };
}

async function uploadToPresignedUrl(upload: PresignedUpload, fileBytes: Buffer) {
  const res = await fetch(upload.url, {
    method: "PUT",
    headers: upload.headers,
    body: new Uint8Array(fileBytes),
  });
  if (!res.ok) {
    throw new Error(`Visibuild S3 upload failed: ${res.status} ${await res.text()}`);
  }
}

// See the file-level comment: this creates a ticket, not a visi close-out,
// because that's the only documented "record with attachments" endpoint.
async function createVisibuildRecord(params: {
  visibuildProjectId: string;
  title: string;
  description: string;
  attachmentKey: string;
}) {
  const res = await fetch(`${apiBase()}/api/core/v1/tickets`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      title: params.title,
      projectId: params.visibuildProjectId,
      description: params.description,
      priority: "medium",
      attachmentKeys: [params.attachmentKey],
    }),
  });

  if (!res.ok) {
    throw new Error(`Visibuild ticket creation failed: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

export async function syncSubmissionToVisibuild(params: {
  submissionId: string;
  itpItemId: string;
  visibuildVisiId: string | null;
  visibuildProjectId: string | null;
  itemAlias: string | null;
  itemDescription: string;
  photoPath: string;
}): Promise<VisibuildSyncResult> {
  const supabase = createServiceClient();
  const configured = process.env.VISIBUILD_API_BASE_URL && process.env.VISIBUILD_ACCESS_TOKEN;

  if (!configured || !params.visibuildProjectId) {
    await supabase.from("visibuild_sync_log").insert({
      submission_id: params.submissionId,
      itp_item_id: params.itpItemId,
      action: "close_with_photo",
      status: "not_synced",
      detail: !configured
        ? "VISIBUILD_API_BASE_URL / VISIBUILD_ACCESS_TOKEN not set — closing item stays a manual step for now."
        : "This project has no visibuild_project_id — can't attribute the ticket to a Visibuild project.",
    });
    return { status: "not_configured" };
  }

  try {
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("itp-photos")
      .download(params.photoPath);
    if (downloadError || !fileData) {
      throw new Error(`Could not read ${params.photoPath} from storage: ${downloadError?.message}`);
    }
    const fileBytes = Buffer.from(await fileData.arrayBuffer());
    const filename = params.photoPath.split("/").pop() || "attachment";

    const upload = await requestPresignedUpload({
      filename,
      contentType: fileData.type || "application/octet-stream",
      fileBytes,
    });
    await uploadToPresignedUrl(upload, fileBytes);

    await createVisibuildRecord({
      visibuildProjectId: params.visibuildProjectId,
      title: `ITP submission: ${params.itemAlias ?? params.itpItemId}`,
      description: params.itemDescription,
      attachmentKey: upload.key,
    });

    await supabase.from("visibuild_sync_log").insert({
      submission_id: params.submissionId,
      itp_item_id: params.itpItemId,
      action: "close_with_photo",
      status: "synced",
      detail: `Created Visibuild ticket with attachment key ${upload.key}. Note: this creates a new ticket - it does not close visi ${params.visibuildVisiId ?? "(none)"} directly, since no such endpoint is confirmed yet.`,
    });

    return { status: "synced" };
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
