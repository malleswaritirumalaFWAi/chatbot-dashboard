import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";

export const maxDuration = 300;

import {
  fetchDailyConversationCounts,
  fetchEscalatedConversations,
  fetchHourlyConversationCounts,
  fetchInboxSummary,
  type CWConversation,
} from "@/lib/chatwoot";
import type { DailyData } from "@/lib/types";
import clientsConfig from "@/config/clients.json";
import baseline from "@/data/baseline.json";
import testExclusions from "@/data/test-exclusions.json";

// ── Live window: only fetch this many days from Chatwoot on each request ────
// Historical data (older than LIVE_WINDOW_DAYS) comes from the static baseline.
// This keeps page counts low enough for Vercel Hobby (~42 pages for EPH vs 133).
const LIVE_WINDOW_DAYS = 30;

// ── Module-level escalation cache (live window only) ─────────────────────────
interface EscCacheEntry {
  byDate: Map<string, { human: number; humanResolved: number }>;
  fetchedAt: number;
}
const escCache = new Map<string, EscCacheEntry | "loading">();
const ESC_TTL_MS = 30 * 60 * 1000; // 30 minutes

function escKey(accountId: number, inboxId: number, labels: string[]): string {
  return `${accountId}:${inboxId}:${[...labels].sort().join(",")}`;
}

// ── Test conversation exclusion ────────────────────────────────────────────────
// Returns pre-computed test conversation offsets (total + escalated) per date for an inbox.
function getTestByDate(
  accountId: number,
  inboxId: number
): Record<string, { total: number; escalated: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accounts = (testExclusions as any).accounts ?? {};
  return (accounts[String(accountId)] ?? {})[String(inboxId)] ?? {};
}

// Subtract test conversation totals from V2 daily reports before building DailyData.
function subtractTestFromDaily(
  dailyReports: { timestamp: number; value: number }[],
  testByDate: Record<string, { total: number; escalated: number }>
): { timestamp: number; value: number }[] {
  if (Object.keys(testByDate).length === 0) return dailyReports;
  return dailyReports.map((row) => {
    const date = toDateStr(row.timestamp);
    const offset = testByDate[date]?.total ?? 0;
    return offset > 0 ? { ...row, value: Math.max(0, row.value - offset) } : row;
  });
}

// Subtract test escalated counts from a live escalation Map (last 30 days).
function subtractTestFromEscMap(
  escMap: Map<string, { human: number; humanResolved: number }>,
  testByDate: Record<string, { total: number; escalated: number }>
): Map<string, { human: number; humanResolved: number }> {
  if (Object.keys(testByDate).length === 0) return escMap;
  const result = new Map(escMap);
  for (const [date, testCounts] of Object.entries(testByDate)) {
    if (!testCounts.escalated) continue;
    const existing = result.get(date) ?? { human: 0, humanResolved: 0 };
    result.set(date, {
      human: Math.max(0, existing.human - testCounts.escalated),
      humanResolved: existing.humanResolved,
    });
  }
  return result;
}

// Subtract test escalated counts from a baseline map (historical dates).
function subtractTestFromBaseline(
  baselineMap: Record<string, { human: number; humanResolved: number }>,
  testByDate: Record<string, { total: number; escalated: number }>
): Record<string, { human: number; humanResolved: number }> {
  if (Object.keys(testByDate).length === 0) return baselineMap;
  const result: Record<string, { human: number; humanResolved: number }> = { ...baselineMap };
  for (const [date, testCounts] of Object.entries(testByDate)) {
    if (!testCounts.escalated) continue;
    const existing = result[date];
    if (existing) {
      result[date] = {
        human: Math.max(0, existing.human - testCounts.escalated),
        humanResolved: existing.humanResolved,
      };
    }
  }
  return result;
}

// liveSince: only count conversations created on or after this timestamp.
// Chatwoot V1 API sorts by last_activity_at and `created_after` doesn't filter the payload —
// conversations created before the live window can appear in results if they had recent activity.
// We must filter by created_at here to prevent old conversations from overriding the baseline.
function buildByDate(convs: CWConversation[], liveSince: number): Map<string, { human: number; humanResolved: number }> {
  const byDate = new Map<string, { human: number; humanResolved: number }>();
  for (const conv of convs) {
    if (conv.created_at < liveSince) continue; // skip conversations outside the live window
    const date = toDateStr(conv.created_at);
    if (!byDate.has(date)) byDate.set(date, { human: 0, humanResolved: 0 });
    const e = byDate.get(date)!;
    e.human++;
    if (conv.status === "resolved") e.humanResolved++;
  }
  return byDate;
}

function getEscalation(
  accountId: number,
  inboxId: number,
  labels: string[]
): Map<string, { human: number; humanResolved: number }> {
  const key = escKey(accountId, inboxId, labels);
  const cached = escCache.get(key);

  if (cached && cached !== "loading" && Date.now() - cached.fetchedAt < ESC_TTL_MS) {
    return cached.byDate;
  }
  if (cached === "loading") return new Map();

  // Kick off background fetch — only the live window (last LIVE_WINDOW_DAYS days)
  const liveSince = Math.floor(Date.now() / 1000) - LIVE_WINDOW_DAYS * 86400;
  escCache.set(key, "loading");
  waitUntil((async () => {
    try {
      const convs = await fetchEscalatedConversations(accountId, inboxId, labels, liveSince);
      escCache.set(key, { byDate: buildByDate(convs, liveSince), fetchedAt: Date.now() });
      console.log(`[cache] warmed ${key} (${convs.length} convos, last ${LIVE_WINDOW_DAYS}d)`);
    } catch {
      escCache.delete(key);
    }
  })());

  return new Map();
}

// ── IST boundary helpers ──────────────────────────────────────────────────────
// Chatwoot's reports UI sends IST midnight as since/until for date range filters.
// IST = UTC+5:30, so IST midnight 00:00 = UTC midnight of that date minus 5.5 hours.
// Example: Aug 8 00:00 IST = Aug 7 18:30:00 UTC = unix 1786107600

function istMidnightUnix(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.floor((Date.UTC(y, m - 1, d, 0, 0, 0) - 5.5 * 3600 * 1000) / 1000);
}

function istEndOfDayUnix(dateStr: string): number {
  // End of IST day = IST midnight of the next day minus 1 second
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.floor((Date.UTC(y, m - 1, d + 1, 0, 0, 0) - 5.5 * 3600 * 1000) / 1000) - 1;
}

function getTodayIST(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().split("T")[0];
}

function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().split("T")[0];
}

function startOfMonthStr(dateStr: string): string {
  return dateStr.substring(0, 7) + "-01";
}

// Fetch exact totals for each preset using the V2 summary API (IST boundaries).
// Presets run sequentially to avoid Chatwoot rate limits; inboxes run in parallel within each preset.
// testByDatePerInbox: pre-computed test conversation offsets per inbox (to subtract from raw totals).
async function fetchSummaryTotals(
  accountId: number,
  inboxIds: number[],
  presets: Record<string, { from: string; to: string }>,
  testByDatePerInbox: Record<string, { total: number; escalated: number }>[]
): Promise<Record<string, number>> {
  const summaryTotals: Record<string, number> = {};
  let first = true;
  for (const [preset, { from, to }] of Object.entries(presets)) {
    // Small delay between presets to avoid Chatwoot rate limiting
    if (!first) await new Promise((r) => setTimeout(r, 400));
    first = false;
    const since = istMidnightUnix(from);
    const until = istEndOfDayUnix(to);
    const counts = await Promise.all(
      inboxIds.map((id) =>
        fetchInboxSummary(accountId, id, since, until)
          .then((r) => r.conversations_count ?? 0)
          .catch(() => 0)
      )
    );
    const rawTotal = counts.reduce((s, n) => s + n, 0);
    // Subtract test conversations that fall within [from, to]
    const testOffset = inboxIds.reduce((s, _id, i) => {
      const testByDate = testByDatePerInbox[i] ?? {};
      return s + Object.entries(testByDate)
        .filter(([date]) => date >= from && date <= to)
        .reduce((acc, [, v]) => acc + v.total, 0);
    }, 0);
    summaryTotals[preset] = Math.max(0, rawTotal - testOffset);
  }
  return summaryTotals;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function toDateStr(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().split("T")[0];
}

function dateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// Build DailyData[] for one inbox.
// liveByDate  = live-fetched escalations (last 30 days, from cache)
// baselineMap = pre-computed historical escalations (from baseline.json, older than 30 days)
// For each date: live takes priority; baseline fills older dates.
function buildDailyData(
  dailyReports: { timestamp: number; value: number }[],
  liveByDate: Map<string, { human: number; humanResolved: number }>,
  baselineMap: Record<string, { human: number; humanResolved: number }>
): DailyData[] {
  const totalByDate = new Map<string, number>();
  for (const row of dailyReports) {
    if (row.value > 0) totalByDate.set(toDateStr(row.timestamp), row.value);
  }

  // Only include dates that have V2 total data OR live escalation data.
  // Baseline fills human counts for those dates but never adds baseline-only rows
  // (which would show total=0 if V2 is temporarily unavailable).
  const allDates = new Set([
    ...Array.from(totalByDate.keys()),
    ...Array.from(liveByDate.keys()),
  ]);

  return Array.from(allDates)
    .sort()
    .map((date) => {
      const total = totalByDate.get(date) ?? 0;
      // Live data takes priority over baseline for the same date
      const esc = liveByDate.has(date)
        ? liveByDate.get(date)!
        : (baselineMap[date] ?? { human: 0, humanResolved: 0 });
      const { human, humanResolved } = esc;
      const bot = Math.max(0, total - human);
      const open = Math.max(0, human - humanResolved);
      return {
        date,
        label: dateLabel(date),
        total,
        bot,
        human,
        humanResolved,
        open,
        botRate: total > 0 ? Math.round((bot / total) * 1000) / 10 : 0,
      };
    });
}

function aggregateDailyData(arrays: DailyData[][]): DailyData[] {
  const byDate = new Map<string, { total: number; human: number; humanResolved: number }>();
  for (const arr of arrays) {
    for (const row of arr) {
      if (!byDate.has(row.date)) byDate.set(row.date, { total: 0, human: 0, humanResolved: 0 });
      const agg = byDate.get(row.date)!;
      agg.total += row.total;
      agg.human += row.human;
      agg.humanResolved += row.humanResolved;
    }
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { total, human, humanResolved }]) => {
      const bot = Math.max(0, total - human);
      const open = Math.max(0, human - humanResolved);
      return {
        date,
        label: dateLabel(date),
        total,
        bot,
        human,
        humanResolved,
        open,
        botRate: total > 0 ? Math.round((bot / total) * 1000) / 10 : 0,
      };
    });
}

function buildHeatmap(hourlyReports: { timestamp: number; value: number }[]): number[][] {
  const IST_OFFSET = 5.5 * 3600;
  const matrix: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
  for (const row of hourlyReports) {
    if (row.value === 0) continue;
    const d = new Date((row.timestamp + IST_OFFSET) * 1000);
    const hour = d.getUTCHours();
    const rawDow = d.getUTCDay();
    const dow = rawDow === 0 ? 6 : rawDow - 1;
    matrix[dow][hour] += row.value;
  }
  return matrix;
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = clientsConfig.find((c) => c.id === clientId) as any;

  if (!config) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  try {
    const channelDefs: { name: string; icon: string; inboxId: number }[] =
      config.channels && Array.isArray(config.channels) && config.channels.length > 0
        ? config.channels
        : [{ name: config.name, icon: "💬", inboxId: config.inboxId }];

    // ── Fetch V2 daily + hourly for all channels in parallel ────────────────
    const [allDailyReports, allHourlyReports] = await Promise.all([
      Promise.all(
        channelDefs.map((ch) =>
          fetchDailyConversationCounts(config.accountId, ch.inboxId).catch(() => [] as { timestamp: number; value: number }[])
        )
      ),
      Promise.all(
        channelDefs.map((ch) =>
          fetchHourlyConversationCounts(config.accountId, ch.inboxId).catch(() => [] as { timestamp: number; value: number }[])
        )
      ),
    ]);

    // ── Test exclusion data per channel ────────────────────────────────────
    const channelTestData = channelDefs.map((ch) =>
      getTestByDate(config.accountId, ch.inboxId)
    );

    // ── Apply test exclusions to V2 daily reports ───────────────────────────
    const adjustedDailyReports = allDailyReports.map((reports, i) =>
      subtractTestFromDaily(reports, channelTestData[i])
    );

    // ── Live escalation from cache (last 30 days only) ──────────────────────
    const channelLiveEscRaw = channelDefs.map((ch) =>
      getEscalation(config.accountId, ch.inboxId, config.escalationLabels)
    );
    const channelLiveEsc = channelLiveEscRaw.map((escMap, i) =>
      subtractTestFromEscMap(escMap, channelTestData[i])
    );

    // ── Baseline historical data for each channel ───────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baselineAccounts = (baseline as any).accounts ?? {};
    const channelBaseline = channelDefs.map((ch, i) => {
      const raw = (baselineAccounts[String(config.accountId)] ?? {})[String(ch.inboxId)] ?? {};
      return subtractTestFromBaseline(raw, channelTestData[i]);
    });

    // ── Build per-channel DailyData[] (live + baseline merged) ─────────────
    const channelDailyArrays = channelDefs.map((_, i) =>
      buildDailyData(adjustedDailyReports[i], channelLiveEsc[i], channelBaseline[i])
    );

    // ── Aggregate all channels ──────────────────────────────────────────────
    const dailyData = aggregateDailyData(channelDailyArrays);

    // ── Heatmap ────────────────────────────────────────────────────────────
    const heatmap = buildHeatmap(allHourlyReports.flat());

    // ── Per-channel breakdown ──────────────────────────────────────────────
    const hasMultipleChannels = config.channels && config.channels.length > 0;
    const channelDailyData = hasMultipleChannels
      ? channelDefs.map((ch, i) => ({
          name: ch.name,
          icon: ch.icon,
          inboxId: ch.inboxId,
          dailyData: channelDailyArrays[i],
        }))
      : [];

    // ── escalationReady: true once all live caches are populated ───────────
    const escalationReady = channelDefs.every((ch) => {
      const key = escKey(config.accountId, ch.inboxId, config.escalationLabels);
      const c = escCache.get(key);
      return c && c !== "loading";
    });

    // ── Summary totals using IST boundaries (matches Chatwoot's reports UI) ────
    const todayIST = getTodayIST();
    const dataStart = dailyData[0]?.date ?? todayIST;
    const inboxIds = channelDefs.map((ch) => ch.inboxId);
    const presets = {
      "all-time":   { from: dataStart,                   to: todayIST },
      "this-month": { from: startOfMonthStr(todayIST),   to: todayIST },
      "last-30":    { from: addDaysStr(todayIST, -29),   to: todayIST },
      "last-7":     { from: addDaysStr(todayIST, -6),    to: todayIST },
    };
    const summaryTotals = await fetchSummaryTotals(config.accountId, inboxIds, presets, channelTestData);

    return NextResponse.json({
      dailyData,
      startDate: dailyData[0]?.date ?? todayIST,
      endDate: todayIST,
      heatmap,
      channelDailyData,
      escalationReady,
      summaryTotals,
    });
  } catch (err) {
    console.error("Chatwoot fetch error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch data" },
      { status: 500 }
    );
  }
}
