import { createServiceClient } from "./supabase/server";
import {
  fetchChannelHistory,
  fetchUserEmail,
  fetchUserDisplayName,
  downloadSlackFile,
  reactToMessage,
  type SlackMessage,
} from "./slack";

interface IngestResult {
  project: string;
  channelId: string;
  messagesSeen: number;
  submissionsCreated: number;
  unmatched: number;
}

function findAliasMatch(text: string, items: { id: string; alias: string | null }[]) {
  const upperText = text.toUpperCase();
  return items.find((item) => item.alias && upperText.includes(item.alias.toUpperCase()));
}

function isImageOrDocument(mimetype: string) {
  return (
    mimetype.startsWith("image/") ||
    mimetype === "application/pdf" ||
    mimetype.includes("word") ||
    mimetype.includes("excel") ||
    mimetype.includes("spreadsheet")
  );
}

// Pulls new messages with attached files from each project's mapped Slack
// channel, matches the message text against that project's ITP item aliases
// (e.g. "MHCOB-30824"), and logs a match as a real submission - identical in
// effect to submitting through the app. A message with a file but no
// resolvable item alias gets a ❓ reaction instead of a guess.
export async function ingestSlackChannel(project: {
  id: string;
  name: string;
  slack_channel_id: string;
  slack_last_synced_ts: string | null;
}): Promise<IngestResult> {
  const supabase = createServiceClient();
  const result: IngestResult = {
    project: project.name,
    channelId: project.slack_channel_id,
    messagesSeen: 0,
    submissionsCreated: 0,
    unmatched: 0,
  };

  const messages = await fetchChannelHistory(project.slack_channel_id, project.slack_last_synced_ts ?? undefined);
  result.messagesSeen = messages.length;
  if (messages.length === 0) return result;

  const { data: items } = await supabase
    .from("itp_items")
    .select("id, alias")
    .eq("project_id", project.id)
    .not("alias", "is", null);

  const { data: checkpoints } = await supabase
    .from("checkpoints")
    .select("id, time_of_day")
    .eq("project_id", project.id);

  // Slack returns newest-first; process oldest-first so ordering within a
  // batch reads naturally and the cursor advances monotonically.
  const ordered = [...messages].reverse();

  for (const message of ordered as SlackMessage[]) {
    if (message.bot_id || message.subtype || !message.files?.length || !message.user) continue;

    const imageFiles = message.files.filter((f) => isImageOrDocument(f.mimetype));
    if (imageFiles.length === 0) continue;

    const matchedItem = findAliasMatch(message.text ?? "", items ?? []);
    if (!matchedItem) {
      await reactToMessage(project.slack_channel_id, message.ts, "question");
      result.unmatched++;
      continue;
    }

    const email = await fetchUserEmail(message.user);
    const displayName = await fetchUserDisplayName(message.user);

    let submittedBy: string | null = null;
    if (email) {
      const { data: profile } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
      submittedBy = profile?.id ?? null;
    }

    const submittedAtMs = Number(message.ts.split(".")[0]) * 1000;
    const submittedAt = new Date(submittedAtMs);
    const nowTimeOfDay = submittedAt.toTimeString().slice(0, 8);
    const checkpoint = (checkpoints ?? [])
      .filter((cp) => cp.time_of_day <= nowTimeOfDay)
      .sort((a, b) => (a.time_of_day < b.time_of_day ? 1 : -1))[0];

    for (const file of imageFiles) {
      try {
        const bytes = await downloadSlackFile(file);
        const path = `slack-import/${project.id}/${message.ts}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("itp-photos")
          .upload(path, Buffer.from(bytes), { contentType: file.mimetype });
        if (uploadError) throw uploadError;

        await supabase.from("submissions").insert({
          itp_item_id: matchedItem.id,
          submitted_by: submittedBy,
          photo_path: path,
          file_name: file.name,
          mime_type: file.mimetype,
          note: `Posted in Slack: "${message.text}"`,
          submitted_at: submittedAt.toISOString(),
          checkpoint_id: checkpoint?.id ?? null,
          submitted_via: "slack",
          slack_user_id: message.user,
          slack_display_name: displayName,
        });

        // itp_items.status flips open -> submitted automatically via the
        // on_submission_created trigger - no need to duplicate that here.
        result.submissionsCreated++;
      } catch (err) {
        console.error(`Failed to ingest Slack file ${file.id} for ${project.name}:`, err);
      }
    }

    await reactToMessage(project.slack_channel_id, message.ts, "white_check_mark");
  }

  const latestTs = ordered[ordered.length - 1]?.ts;
  if (latestTs) {
    await supabase.from("projects").update({ slack_last_synced_ts: latestTs }).eq("id", project.id);
  }

  return result;
}
