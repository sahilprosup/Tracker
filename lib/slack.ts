// Pluggable Slack client. Posts via an Incoming Webhook (SLACK_WEBHOOK_URL).
// Swap this for @slack/web-api + a bot token later if per-channel routing or
// reading channel activity back into the tracker is needed.

export async function postToSlack(text: string, blocks?: unknown[]) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("SLACK_WEBHOOK_URL not set — skipping Slack post:", text);
    return { skipped: true };
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(blocks ? { text, blocks } : { text }),
  });

  if (!res.ok) {
    throw new Error(`Slack webhook failed: ${res.status} ${await res.text()}`);
  }

  return { skipped: false };
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
