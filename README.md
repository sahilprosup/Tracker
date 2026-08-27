# ProLine ITP Tracker

A site tracker for ProLine's ITP (Inspection & Test Plan) work: site crews submit
a photo against a specific ITP checklist item instead of chasing 150+ Visibuild
comments by hand, coordinators get a live progress dashboard and a printable
daily report, and Slack gets automatic checkpoint nudges + an end-of-day summary.

## How it's wired up

- **Next.js (App Router) + Tailwind** — `app/`
- **Supabase** (Postgres + Auth + Storage) — project `proline-tracker`
  (`hgoinurzxpylbornukqx`, ap-southeast-2). Schema: `projects`, `checkpoints`,
  `itp_items`, `submissions`, `daily_reports`, `visibuild_sync_log`, `profiles`.
  Row-level security is on everywhere; `is_coordinator_or_admin()` gates writes
  to projects/ITP items/reports.
- **Auth** — Supabase magic-link email sign-in. Anyone with a `@prolinegroup.au`
  (or any) email can sign in as a `site_worker`; emails listed in
  `COORDINATOR_EMAILS` get the `coordinator` role on first login.
- **Storage** — private `itp-photos` bucket, one object per submission. Accepts
  photos (camera or gallery) *and* documents (PDF/Word/Excel) — the report
  page renders images inline and documents as a clickable file icon.
- **Mobile** — installable as a home-screen app (manifest.json, standalone
  display, iOS "Add to Home Screen" support) so it opens full-screen without
  browser chrome, like a native app.
- **Slack** — an Incoming Webhook (`SLACK_WEBHOOK_URL`). Two endpoints drive it:
  - `POST /api/cron/checkpoint?secret=...` — call this at 08:30 / 11:30 / 14:30.
    It finds any checkpoint due in the last 15 minutes, tallies today's
    submissions per project against `target_count`, and posts a ✅/⚠️ line per
    project.
  - `POST /api/cron/daily-report?secret=...` — call once at end of day. Builds
    a per-project summary (total submitted, checkpoint hit/miss, who submitted
    what), saves each to `daily_reports`, then posts **one consolidated
    message** across every active project — "X photos submitted across N
    projects today" with a per-project breakdown — matching "rip me a report
    across all 43 projects" rather than 43 separate Slack messages. The same
    data is browsable in-app at `/admin/summary`.
  Trigger both from any external scheduler (cron-job.org, GitHub Actions
  `schedule:`, Vercel Cron, etc.) — nothing here runs on its own.
- **Visibuild** — reading is live (project/ITP seed data below came from the
  real account). **Writing back is stubbed** — see "What's not real yet" below.

## Admin (coordinators)

`/admin` (visible to anyone with `coordinator`/`admin` role) has:
- **Checkpoints** — add/edit/remove the per-project 08:30/11:30/14:30 targets
  that drive both the Slack nudges and the daily report's checkpoint columns.
- **Sync log** — every attempt (or non-attempt) to push a submission back into
  Visibuild, with status and error detail.
- **Cross-project summary** (`/admin/summary`) — today's submissions and
  checkpoint hits across every active project, the same data the end-of-day
  Slack report is built from.

Coordinators can also add ITP items to a project by hand from the checklist
page (`+ Add ITP item manually`) — useful for any project not yet imported
from Visibuild, since bulk import needs write-scoped API credentials (see
below).

## Automating the Slack posts

Nothing in this repo runs on a schedule by itself — `/api/cron/checkpoint` and
`/api/cron/daily-report` are plain endpoints that need something external to
call them. `.github/workflows/cron.yml` does this via GitHub Actions native
cron (no third-party scheduler, no Vercel Cron needed): set two repo secrets
once the app is deployed —

- `APP_URL` — the deployed app's base URL
- `CRON_SECRET` — must match the app's `CRON_SECRET` env var

and it fires the checkpoint endpoint at 08:30/11:30/14:30 AEST and the daily
report once at the end of the day. `workflow_dispatch` is enabled too, so you
can trigger a run manually to test.

**Slack webhook**: this app posts through a Slack Incoming Webhook
(`SLACK_WEBHOOK_URL`), not a bot token, because generating one requires
workspace-admin access in Slack's own app console — not something available
to automate from here. To create it: api.slack.com/apps → Create New App →
"From scratch" → Incoming Webhooks → toggle on → Add New Webhook to Workspace
→ pick the reporting channel → copy the URL into `SLACK_WEBHOOK_URL`.

## Bulk-importing every project's ITP items

`scripts/import-visibuild.ts` is the real path to loading all 44 projects'
visis (only Melton Hospital's facade/cladding section — 25 items — is seeded
today, pulled by hand as a proof of concept). It expects a real Visibuild REST
API with write-capable credentials (`VISIBUILD_API_BASE_URL`,
`VISIBUILD_API_KEY`) and paginates + upserts into `itp_items`:

```bash
npx tsx scripts/import-visibuild.ts <visibuild_project_id>
npx tsx scripts/import-visibuild.ts --all
```

## What's not real yet

**Visibuild write-back.** The Visibuild connection this was built against only
exposes read tools (list/search/get on projects, visis, tickets). There is no
create/upload/close endpoint to call, so a submitted photo does **not**
currently push into Visibuild or auto-close the item there. `lib/visibuild.ts`
has the integration point already wired into the submission flow
(`app/api/submissions/route.ts` calls `syncSubmissionToVisibuild` on every
submit) — once ProLine has a Visibuild API key with write scope, fill in
`VISIBUILD_API_BASE_URL` / `VISIBUILD_API_KEY` and replace the TODO'd request
in that one function. Every attempt (or non-attempt) is logged to
`visibuild_sync_log` so nothing silently fails.

**Full ITP import.** Only Melton Hospital's facade/cladding section (25 real
items, pulled live from Visibuild) is seeded, as a working example — see
`app/dashboard`. Melton Hospital alone has 1,151 visis across 44 projects, so
bulk-importing everything needs a proper sync script hitting Visibuild's API
directly (not one-off MCP calls). That script is the natural next piece once
Visibuild write access exists, since it can share the same client.

**Slack reminders.** The 8:30/11:30/14:30 reminders in Slack already exist as
your own Slack native reminders — this app doesn't create or manage those. It
independently tracks the same checkpoint times against real submission data
and posts its own progress/nudge messages via the webhook.

## Deploy (get a real URL on your phone/laptop)

This session has no hosting credentials (no Vercel/Netlify access), so I can't
push a live URL myself — but the app deploys in about 2 minutes once you click
through:

1. Go to **vercel.com/new**, sign in, and import `sahilprosup/Tracker`
   (branch `claude/proline-tracker-website-vz1t7y`, or merge to `main` first).
2. When it asks for environment variables, set:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://hgoinurzxpylbornukqx.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the publishable key from Supabase →
     Project Settings → API (already provisioned, just needs copying in)
   - `SUPABASE_SERVICE_ROLE_KEY` = the service role key, same page
   - `COORDINATOR_EMAILS` = `sahil.john@prolinegroup.au`
   - `CRON_SECRET` = any random string (used to authorize the two cron endpoints)
   - `SLACK_WEBHOOK_URL` = leave blank until you create one (see below);
     the app runs fine without it, it just skips the Slack post
3. Click Deploy. You get a `*.vercel.app` URL immediately — open it on your
   phone and tap "Add to Home Screen" (iOS Safari) or "Install app" (Android
   Chrome) and it behaves like a native app icon, not a browser tab.
4. Once deployed, set the `APP_URL` and `CRON_SECRET` GitHub repo secrets
   (Settings → Secrets and variables → Actions) to that URL and the same
   secret from step 2, so `.github/workflows/cron.yml` can drive the Slack
   posts.

Any git push to the connected branch redeploys automatically after that —
including tomorrow's fixes.

## Local development

```bash
cp .env.example .env.local   # fill in the Supabase anon key + Slack webhook
npm install
npm run dev
```

## Data model

```
projects (mirrors Visibuild projects)
  └─ checkpoints (per-project 08:30/11:30/14:30 targets)
  └─ itp_items (mirrors Visibuild visis: inspection / task / hold_point)
       └─ submissions (photo + note + who + when + which checkpoint)
            └─ visibuild_sync_log (audit trail for the write-back attempt)
daily_reports (one row per project per day, generated by the cron job)
profiles (role: site_worker | coordinator | admin)
```
