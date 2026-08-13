# Chatbot Performance Dashboard — Project Status

## What This Project Is
A dynamic, multi-client chatbot performance dashboard connected live to Chatwoot (desk.freedomwithai.com). Built with Next.js 14, Tailwind CSS, and Recharts. Shows real-time chatbot impact metrics per client — conversations handled, bot auto-resolutions, escalations, hours saved, daily/monthly trends.

---

## Current State: LIVE — Connected to Chatwoot API

The dashboard is fully built and pulling live data from Chatwoot. All 6 clients are connected. Data auto-refreshes every 60 seconds in the background.

---

## How to Run

```bash
cd C:\Users\DELL\chatbot-dashboard
npm run dev
# Open http://localhost:3000
```

---

## File Structure

```
C:\Users\DELL\chatbot-dashboard\
├── .env.local                        # Chatwoot API token (never commit this)
├── PROJECT_STATUS.md                 # This file
└── src/
    ├── app/
    │   ├── page.tsx                  # Main dashboard — state, data fetching, metric computation
    │   ├── layout.tsx                # Root layout
    │   ├── globals.css               # Base styles
    │   └── api/
    │       └── metrics/
    │           └── route.ts          # GET /api/metrics?clientId=... — server-side Chatwoot fetcher
    ├── components/
    │   ├── Header.tsx                # Dark navy header — client dropdown, date presets, download button
    │   ├── DarkBanner.tsx            # Section banners (Report / Last 7 Days)
    │   ├── SectionHeader.tsx         # Purple accent bar + icon + title
    │   ├── SummaryCards.tsx          # 6 metric cards (Total, Bot, Escalated, Human, Trend, Hours)
    │   ├── FunnelSection.tsx         # Horizontal bar funnel (Total → Bot → Escalated → Human → Open)
    │   ├── ResolutionFlow.tsx        # Journey cards + Bot vs Human table + Hours Saved
    │   ├── MonthlyTrends.tsx         # Stacked bar + area line + donut + monthly breakdown bars
    │   ├── DailyTrends.tsx           # Same 4-chart layout for daily data
    │   └── BreakdownTable.tsx        # Full daily breakdown table with colored badges
    ├── config/
    │   └── clients.json              # Per-client Chatwoot config (account ID, inbox ID, label, handling time)
    └── lib/
        ├── types.ts                  # TypeScript interfaces (DailyData, AllTimeMetrics, WeeklyMetrics, etc.)
        ├── chatwoot.ts               # Chatwoot API functions (V2 Reports + label-filtered conversations)
        ├── metrics.ts                # Aggregation: filter, compute all-time/weekly metrics, format dates
        ├── mockData.ts               # Old mock data (kept, no longer used by dashboard)
        ├── dataGen.ts                # Old seeded PRNG data generator (kept, no longer used)
        └── generateReport.ts         # HTML report generator + Blob download
```

---

## Live Chatwoot Integration

### Authentication
- Token stored in `.env.local` as `CHATWOOT_API_TOKEN`
- All API calls are server-side only — token never exposed to browser
- Token: admin token with access to all 6 accounts

### How Data Is Fetched (Per Client Load)

**Step 1 — V2 Reports API** (1 API call):
```
GET /api/v2/accounts/{accountId}/reports
    ?type=inbox&metric=conversations_count&group_by=day
    &id={inboxId}&since=1700000000&until={tomorrow}
```
Returns daily conversation counts grouped by creation date. Fast, pre-aggregated by Chatwoot.

**Step 2 — Escalated Conversations** (1–2 API calls):
```
GET /api/v1/accounts/{accountId}/conversations
    ?inbox_id={inboxId}&labels[]=bot-handoff&status=all&page=1
```
Fetches only conversations with the escalation label (always a small subset). Paginates if needed (25 per page).

**Step 3 — Merge & Classify** (server-side, no API call):
```
For each date:
  total     = from Step 1 (V2 reports)
  human     = escalated conversations created that date (Step 2)
  humanResolved = escalated + status=resolved
  bot       = total - human
  open      = human - humanResolved
  botRate   = bot / total × 100
```

**Why this approach:**
- Old approach: paginated ALL conversations (Flute Gandharvas = 32 API calls)
- New approach: 2 API calls per client regardless of total conversation count
- Accurate: totals verified against Chatwoot summary API for all 6 clients

### Auto-Refresh
- Data re-fetched every **60 seconds** silently in the background (no spinner, no flicker)
- Switching clients triggers immediate fresh fetch with loading spinner
- Manual Refresh button in header forces a page reload

---

## Client Configuration (`src/config/clients.json`)

| Client | Account ID | Inbox ID | Inbox Type | Avg Handling | Escalation Label |
|---|---|---|---|---|---|
| Easy Parenting Hub | 1 | 11 | Web Widget | 5 min | bot-handoff |
| Energy Queens Hub | 3 | 14 | Web Widget | 5 min | bot-handoff |
| GoNature | 4 | 17 | Web Widget | 5 min | bot-handoff |
| Dipti Vartak Academy | 5 | 20 | WhatsApp API | 7 min | bot-handoff |
| Fwai | 7 | 24 | WhatsApp API | 5 min | bot-handoff |
| Flute Gandharvas | 2 | 7 | WhatsApp API | 5 min | bot-handoff |

To add a new client: add an entry to `clients.json`. No code changes needed.

---

## Bot Detection System

The bot detection is **label-based**, consistent across all clients:

- **Bot resolved** = conversation has NO `bot-handoff` / `needs-human` label → counted in `bot`
- **Escalated** = conversation has `bot-handoff` AND/OR `needs-human` label → counted in `human`
- **Human resolved** = escalated conversation with `status = resolved`
- **Still open** = escalated conversation with `status = open`

### Bot Detection Accuracy Per Client

| Client | Accuracy | Notes |
|---|---|---|
| GoNature | Accurate | Labels applied correctly by bot workflow |
| Energy Queens | Accurate | Labels applied correctly by bot workflow |
| DVA | Accurate | Labels applied correctly by bot workflow |
| Fwai | Accurate | Labels applied correctly by bot workflow |
| EPH | Partial | Only 4 test conversations; labeling inconsistent on web widget |
| Flute Gandharvas | Limited | Has bot-handoff label in account but bot workflow never applies it. Shows 0% escalated. Will auto-correct once n8n workflow is configured to apply the label on escalation. |

---

## Live Data Summary (as of July 31, 2026)

| Client | Total Conversations | Bot Resolved | Escalated | Human Resolved | Date Range |
|---|---|---|---|---|---|
| Easy Parenting Hub | 4 | 3 | 1 | 1 | Jun 17, 2026 |
| Energy Queens Hub | 32 | 15 | 17 | 3 | Jun 18 – Jul 23, 2026 |
| GoNature | 17 | 14 | 3 | 0 | Jun 26 – Jul 31, 2026 |
| Dipti Vartak Academy | 10 | 9 | 1 | 0 | Jun 27 – Jul 2, 2026 |
| Fwai | 48 | 39 | 9 | 2 | Jul 14–15, 2026 |
| Flute Gandharvas | 781 | 781 | 0 | 0 | Jun 3 – Jul 31, 2026 |

---

## Features Working

- **6 live clients** — all pulling from Chatwoot via server-side API
- **Date range presets** — All Time, This Month, Last 30 Days, Last 7 Days, Custom Range
  - "All Time" always shows from first conversation date → today
- **Custom date range picker** — From/To inputs with min/max bounds
- **Auto-refresh every 60 seconds** — silent background refresh, no flicker
- **All sections update dynamically** on client switch or date change
- **Summary cards** — Total, Bot Auto-Resolved, Escalated, Human Resolved, Bot Rate Trend, Hours Saved
- **Query Resolution Funnel** — proportional horizontal bars
- **Resolution Flow** — journey cards + Bot vs Human table + Hours Saved
- **Monthly Trends** — stacked bar, area line chart, donut, monthly breakdown
- **Daily Trends** — same layout for daily granularity
- **Full Daily Breakdown Table** — colored badges, totals row
- **Download Report** — generates self-contained HTML file with Chart.js charts, scoped to selected client + date range
- **"Last 7 Days" section hidden** when "Last 7 Days" preset is active (avoids duplicate display)

---

## Bugs Fixed

1. **`weekLabel` used before defined** — downloaded HTML reports showed `undefined` in the Last 7 Days header. Fixed by moving `weekLabel` definition above `handleDownload`.

2. **"Last 7 Days" section duplicate** — when the "Last 7 Days" date preset was selected, the report section and the weekly section showed identical data. Fixed by hiding the weekly section when `datePreset === "last-7"`.

3. **"All Time" end date was last conversation date, not today** — fixed so "All Time" always sets `to = today`.

---

## API Endpoints Used

Base URL: `https://desk.freedomwithai.com`
Auth: `api_access_token: {token}` header

| Purpose | Endpoint |
|---|---|
| Daily conversation counts | `GET /api/v2/accounts/{id}/reports?type=inbox&metric=conversations_count&group_by=day&id={inbox_id}&since={ts}&until={ts}` |
| Escalated conversations | `GET /api/v1/accounts/{id}/conversations?inbox_id={id}&labels[]=bot-handoff&status=all&page={n}` |
| Summary totals (for verification) | `GET /api/v2/accounts/{id}/reports/summary?type=inbox&id={inbox_id}&since={ts}&until={ts}` |
| All labels in account | `GET /api/v1/accounts/{id}/labels` |
| All agents in account | `GET /api/v1/accounts/{id}/agents` |
| Auth / profile / account list | `GET /api/v1/profile` |

### API Limitations Discovered
- `type=label` in V2 reports API returns 404 — label-based daily aggregation not supported
- `/api/v1/accounts/{id}/conversations` has no date range filter — must use label filter or V2 reports
- `resolutions_count` in V2 reports groups by resolution date, NOT conversation creation date — not used for daily breakdown

---

## Environment Variables

```
# .env.local (never commit)
CHATWOOT_API_TOKEN=RAFSebhEj84TTxSPjfzU5f6d
```

---

## Stack

- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** — styling
- **Recharts** — all charts (BarChart, AreaChart, PieChart/donut)
- **lucide-react** — icons
- **Chart.js 4.4.3** (CDN) — charts inside the downloaded HTML report

---

## Chatwoot Instance

- URL: https://desk.freedomwithai.com
- Account structure: 1 token (SuperAdmin) with access to all 6 accounts
- Each account = 1 client, 1 primary chatbot inbox
- Bot system: n8n-based automation applies `bot-handoff` + `needs-human` labels when escalating to a human agent
