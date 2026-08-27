// Slack client: posts via either a Bot Token (chat.postMessage) or an
// Incoming Webhook (SLACK_WEBHOOK_URL) - bot token is preferred when set
// since it also unlocks reading channel history (see slack-ingest.ts).

const SLACK_API = "https://slack.com/api";

async function slackApi<T = unknown>(method: string, params: Record<string, unknown>): Promise<T> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN not set");

  const res = await fetch(`${SLACK_API}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(`Slack API ${method} failed: ${data.error}`);
  return data as T;
}

export async function postToSlack(text: string, channelId?: string) {
  const botToken = process.env.SLACK_BOT_TOKEN;
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (botToken && channelId) {
    await slackApi("chat.postMessage", { channel: channelId, text });
    return { skipped: false };
  }

  if (!webhookUrl) {
    console.warn("Neither SLACK_BOT_TOKEN+channel nor SLACK_WEBHOOK_URL configured — skipping Slack post:", text);
    return { skipped: true };
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    throw new Error(`Slack webhook failed: ${res.status} ${await res.text()}`);
  }

  return { skipped: false };
}

export interface SlackFile {
  id: string;
  name: string;
  mimetype: string;
  url_private: string;
}

export interface SlackMessage {
  ts: string;
  user?: string;
  text: string;
  subtype?: string;
  bot_id?: string;
  files?: SlackFile[];
}

export async function fetchChannelHistory(channelId: string, oldestTs?: string): Promise<SlackMessage[]> {
  const data = await slackApi<{ messages: SlackMessage[] }>("conversations.history", {
    channel: channelId,
    oldest: oldestTs,
    limit: 200,
  });
  return data.messages ?? [];
}

export async function fetchUserEmail(userId: string): Promise<string | null> {
  try {
    const data = await slackApi<{ user: { profile?: { email?: string } } }>("users.info", { user: userId });
    return data.user.profile?.email ?? null;
  } catch {
    return null;
  }
}

export async function fetchUserDisplayName(userId: string): Promise<string> {
  try {
    const data = await slackApi<{ user: { profile?: { real_name?: string; display_name?: string }; name: string } }>(
      "users.info",
      { user: userId },
    );
    return data.user.profile?.real_name || data.user.profile?.display_name || data.user.name;
  } catch {
    return "Unknown Slack user";
  }
}

export async function downloadSlackFile(file: SlackFile): Promise<ArrayBuffer> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN not set");

  const res = await fetch(file.url_private, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Failed to download Slack file ${file.id}: ${res.status}`);
  return res.arrayBuffer();
}

export async function reactToMessage(channelId: string, ts: string, emoji: string) {
  try {
    await slackApi("reactions.add", { channel: channelId, timestamp: ts, name: emoji });
  } catch (err) {
    // Non-fatal - e.g. reaction already present. Never let this break ingestion.
    console.warn("Failed to react to Slack message:", err);
  }
}

export function formatCheckpointNudge(params: {
  projectName: string;
  checkpointLabel: string;
  target: number;
  actual: number;
}) {
  const { projectName, checkpointLabel, target, actual } = params;
  if (actual >= target) {
    return `✅ *${projectName}* — ${checkpointLabel} checkpoint hit: ${actual}/${target} ITP photos submitted.`;
  }
  return (
    `⚠️ *${projectName}* — ${checkpointLabel} checkpoint (${target} expected): ` +
    `only ${actual}/${target} ITP photos submitted so far. Chase the crew.`
  );
}

export function formatConsolidatedDailyReport(params: {
  reportDate: string;
  projects: {
    name: string;
    submissionCount: number;
    checkpointsMet: number;
    checkpointsTotal: number;
  }[];
}) {
  const { reportDate, projects } = params;
  const totalSubmissions = projects.reduce((sum, p) => sum + p.submissionCount, 0);
  const activeProjects = projects.filter((p) => p.submissionCount > 0 || p.checkpointsTotal > 0);

  if (activeProjects.length === 0) {
    return `📋 *End of Day Report — ${reportDate}*\n\nNo ITP activity recorded across any project today.`;
  }

  const lines = activeProjects
    .sort((a, b) => b.submissionCount - a.submissionCount)
    .map((p) => {
      const flag = p.checkpointsTotal > 0 && p.checkpointsMet < p.checkpointsTotal ? "⚠️" : "✅";
      const checkpointNote = p.checkpointsTotal > 0 ? ` (${p.checkpointsMet}/${p.checkpointsTotal} checkpoints hit)` : "";
      return `${flag} *${p.name}*: ${p.submissionCount} submitted${checkpointNote}`;
    })
    .join("\n");

  return (
    `📋 *End of Day Report — ${reportDate}*\n\n` +
    `*${totalSubmissions} ITP photos submitted across ${activeProjects.length} active project${activeProjects.length === 1 ? "" : "s"}:*\n\n` +
    lines
  );
}

export function formatDailyReport(params: {
  projectName: string;
  reportDate: string;
  submissionCount: number;
  checkpointSummary: Record<string, { target: number; actual: number }>;
  bySubmitter: { name: string; count: number }[];
}) {
  const { projectName, reportDate, submissionCount, checkpointSummary, bySubmitter } = params;

  const checkpointLines = Object.entries(checkpointSummary)
    .map(([label, { target, actual }]) => `  • ${label}: ${actual}/${target}`)
    .join("\n");

  const submitterLines = bySubmitter.length
    ? bySubmitter.map((s) => `  • ${s.name}: ${s.count} submitted`).join("\n")
    : "  • No submissions today";

  return (
    `📋 *Daily ITP Report — ${projectName} (${reportDate})*\n\n` +
    `*Total submitted:* ${submissionCount}\n\n` +
    `*By checkpoint:*\n${checkpointLines || "  • No checkpoints configured"}\n\n` +
    `*By person:*\n${submitterLines}`
  );
}
