-- Submissions can now originate from Slack (a photo posted directly into a
-- project's ITP channel) instead of only the app. submitted_by stays a hard
-- link to a known profile when we can match the Slack poster's email; when
-- we can't, the submission still needs to exist, so submitted_by becomes
-- nullable and we keep the raw Slack identity for display/audit.
alter table submissions alter column submitted_by drop not null;
alter table submissions add column if not exists submitted_via text not null default 'app'
  check (submitted_via in ('app', 'slack'));
alter table submissions add column if not exists slack_user_id text;
alter table submissions add column if not exists slack_display_name text;

-- Tracks per-project ingest progress so re-running the cron job doesn't
-- reprocess the same Slack history every time.
alter table projects add column if not exists slack_last_synced_ts text;

comment on column submissions.submitted_via is 'app: submitted through the tracker UI. slack: ingested from a project Slack channel.';
comment on column projects.slack_last_synced_ts is 'Slack message ts cursor - conversations.history messages newer than this are unprocessed.';
