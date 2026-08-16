import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";

export const maxDuration = 300;

import {
  fetchDailyConversationCounts,
  fetchEscalatedConversations,
  fetchHourlyConversationCounts,
  fetchTesterConversations,
  type CWConversation,
} from "@/lib/chatwoot";
import type { DailyData } from "@/lib/types";
import clientsConfig from "@/config/clients.json";
import baseline from "@/data/baseline.json";
import testExclusions from "@/data/test-exclusions.json";
import excludedContactsConfig from "@/data/excluded-contacts.json";

// ── Live window: only fetch this many days from Chatwoot on each request ────
// Historical data (older than LIVE_WINDOW_DAYS) comes from the static baseline.
// This keeps page counts low enough for Vercel Hobby (~42 pages for EPH vs 133).
const LIVE_WINDOW_DAYS = 30;

// ── Module-level daily report cache ──────────────────────────────────────────
// Stores the last successful V2 daily report response per inbox.
// If Chatwoot rate-limits a fresh fetch (returns []), we serve stale cache
// rather than producing total=0 rows that corrupt bot-rate calculations.
interface DailyCacheEntry {
  reports: { timestamp: number; value: number }[];
  fetchedAt: number;
}
const dailyCache = new Map<string, DailyCacheEntry>();

function dailyKey(accountId: number, inboxId: number): string {
  return `${accountId}:${inboxId}`;
}

async function fetchDailyWithCache(
  accountId: number,
  inboxId: number
): Promise<{ timestamp: number; value: number }[]> {
  const key = dailyKey(accountId, inboxId);
  try {
    const fresh = await fetchDailyConversationCounts(accountId, inboxId);
    // Only cache non-empty responses — an empty response likely means rate-limiting
    if (fresh.length > 0) {
      dailyCache.set(key, { reports: fresh, fetchedAt: Date.now() });
      return fresh;
    }
    // fresh is empty: fall through to cache
  } catch {
    // fetch threw: fall through to cache
  }
  const cached = dailyCache.get(key);
  if (cached) {
    console.warn(`[daily-cache] serving stale data for ${key} (fresh fetch returned empty)`);
    return cached.reports;
  }
  return []; // truly no data
}

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

// ── Module-level tester conversation cache ────────────────────────────────────
// Stores per-date tester conversation counts per inbox for total subtraction.
interface TesterCacheEntry {
  byDate: Map<string, number>; // IST date → number of tester conversations
  fetchedAt: number;
}
const testerCache = new Map<string, TesterCacheEntry | "loading">();
const TESTER_TTL_MS = 60 * 60 * 1000; // 1 hour — tester counts change rarely
const HISTORICAL_SINCE = 1735689600; // Jan 1, 2025 — matches V2 daily report range

function testerKey(accountId: number, inboxId: number): string {
  return `${accountId}:${inboxId}`;
}

function getExcludedContactIds(accountId: number): number[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (excludedContactsConfig as any).accounts?.[String(accountId)] ?? [];
}

function getTesterConvsByDate(
  accountId: number,
  inboxId: number,
  contactIds: number[]
): Map<string, number> {
  if (!contactIds.length) return new Map();
  const key = testerKey(accountId, inboxId);
  const cached = testerCache.get(key);

  if (cached && cached !== "loading" && Date.now() - cached.fetchedAt < TESTER_TTL_MS) {
    return cached.byDate;
  }
  if (cached === "loading") return new Map();

  const IST_OFFSET_S = 19800;
  testerCache.set(key, "loading");
  waitUntil((async () => {
    try {
      const convs = await fetchTesterConversations(accountId, contactIds, inboxId, HISTORICAL_SINCE);
      const byDate = new Map<string, number>();
      for (const conv of convs) {
        const date = toDateStr(conv.created_at + IST_OFFSET_S);
        byDate.set(date, (byDate.get(date) ?? 0) + 1);
      }
      testerCache.set(key, { byDate, fetchedAt: Date.now() });
      console.log(`[tester-cache] warmed ${key} (${convs.length} tester convos)`);
    } catch {
      testerCache.delete(key);
    }
  })());

  return new Map();
}

function subtractTesterFromDaily(
  dailyReports: { timestamp: number; value: number }[],
  testerByDate: Map<string, number>
): { timestamp: number; value: number }[] {
  if (!testerByDate.size) return dailyReports;
  return dailyReports.map((row) => {
    const date = toDateStr(row.timestamp); // V2 daily timestamps are midnight UTC = same IST date
    const offset = testerByDate.get(date) ?? 0;
    return offset > 0 ? { ...row, value: Math.max(0, row.value - offset) } : row;
  });
}

function subtractTesterFromISTDaily(
  istDaily: Map<string, number>,
  testerByDate: Map<string, number>
): Map<string, number> {
  if (!testerByDate.size) return istDaily;
  const result = new Map(istDaily);
  for (const [date, count] of Array.from(testerByDate.entries())) {
    const existing = result.get(date);
    if (existing === undefined) continue;
    const adjusted = Math.max(0, existing - count);
    if (adjusted > 0) result.set(date, adjusted);
    else result.delete(date);
  }
  return result;
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
    const existing = result.get(date);
    if (!existing) continue; // don't create phantom entries for dates outside the live window
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
  labels: string[],
  botAgentId?: number,
  excludedContactIds?: number[]
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
      const convs = await fetchEscalatedConversations(accountId, inboxId, labels, liveSince, botAgentId, excludedContactIds);
      escCache.set(key, { byDate: buildByDate(convs, liveSince), fetchedAt: Date.now() });
      console.log(`[cache] warmed ${key} (${convs.length} convos, last ${LIVE_WINDOW_DAYS}d)`);
    } catch {
      escCache.delete(key);
    }
  })());

  return new Map();
}

// ── Date helpers ──────────────────────────────────────────────────────────────
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

// Compute preset totals directly from dailyData (test exclusions already applied).
// Avoids extra Chatwoot API calls and is immune to rate limiting.
function computeSummaryTotals(
  dailyData: DailyData[],
  presets: Record<string, { from: string; to: string }>
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const [preset, { from, to }] of Object.entries(presets)) {
    totals[preset] = dailyData
      .filter((d) => d.date >= from && d.date <= to)
      .reduce((s, d) => s + d.total, 0);
  }
  return totals;
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
// istOverrides = IST-aligned daily totals + UTC reductions built from hourly data
// liveByDate   = live-fetched escalations (last 30 days, from cache)
// baselineMap  = pre-computed historical escalations (from baseline.json, older than 30 days)
// For each date: live takes priority over baseline for human counts; IST overrides UTC daily for totals.
function buildDailyData(
  dailyReports: { timestamp: number; value: number }[],
  istOverrides: { istDaily: Map<string, number>; utcReductions: Map<string, number> },
  liveByDate: Map<string, { human: number; humanResolved: number }>,
  baselineMap: Record<string, { human: number; humanResolved: number }>
): DailyData[] {
  const totalByDate = new Map<string, number>();
  // Step 1: historical totals from V2 daily reports (UTC-bucketed)
  for (const row of dailyReports) {
    if (row.value > 0) totalByDate.set(toDateStr(row.timestamp), row.value);
  }
  // Step 2a: subtract the evening-crossing portion from V2 UTC daily entries to prevent
  // double-counting when IST daily (step 2b) adds those same conversations to the next IST date.
  istOverrides.utcReductions.forEach((reduction, utcDate) => {
    const existing = totalByDate.get(utcDate);
    if (existing !== undefined) {
      const adjusted = existing - reduction;
      if (adjusted > 0) totalByDate.set(utcDate, adjusted);
      else totalByDate.delete(utcDate);
    }
  });
  // Step 2b: override with IST-aligned hourly sums (complete replacement for covered dates).
  istOverrides.istDaily.forEach((count, date) => {
    if (count > 0) totalByDate.set(date, count);
    else totalByDate.delete(date);
  });

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

// Build IST-aligned daily totals from hourly V2 data.
//
// Each hourly bucket has a UTC timestamp. Adding the IST offset before extracting the date
// re-attributes the bucket to the correct IST calendar day.
//
// Buckets in the 19:00–23:00 UTC window straddle IST midnight: their UTC date is D but their
// IST date is D+1. If we add IST daily counts on top of V2 UTC daily counts, those buckets
// would be counted twice (once in V2 daily D and once in IST daily D+1). To prevent that,
// we also return `utcReductions`: the amount to subtract from each V2 UTC daily entry for
// the buckets that were re-attributed to the next IST date.
function buildISTDailyFromHourly(hourlyReports: { timestamp: number; value: number }[]): {
  istDaily: Map<string, number>;
  utcReductions: Map<string, number>;
} {
  const IST_OFFSET_S = 19800; // 5.5 * 3600
  const istDaily = new Map<string, number>();
  const utcReductions = new Map<string, number>();
  for (const row of hourlyReports) {
    if (row.value === 0) continue;
    const utcDate = toDateStr(row.timestamp);
    const istDate = toDateStr(row.timestamp + IST_OFFSET_S);
    istDaily.set(istDate, (istDaily.get(istDate) ?? 0) + row.value);
    if (utcDate !== istDate) {
      // This bucket crossed IST midnight: it's in V2 daily for utcDate but IST daily for istDate.
      // Record how much needs to be removed from the V2 daily entry for utcDate.
      utcReductions.set(utcDate, (utcReductions.get(utcDate) ?? 0) + row.value);
    }
  }
  return { istDaily, utcReductions };
}

// Subtract test conversation totals from an IST-aligned daily Map.
function subtractTestFromISTDaily(
  istDaily: Map<string, number>,
  testByDate: Record<string, { total: number; escalated: number }>
): Map<string, number> {
  if (Object.keys(testByDate).length === 0) return istDaily;
  const result = new Map(istDaily);
  for (const [date, testCounts] of Object.entries(testByDate)) {
    if (!testCounts.total) continue;
    const existing = result.get(date);
    if (existing === undefined) continue;
    const adjusted = Math.max(0, existing - testCounts.total);
    if (adjusted > 0) result.set(date, adjusted);
    else result.delete(date);
  }
  return result;
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
          fetchDailyWithCache(config.accountId, ch.inboxId)
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

    // ── Tester contact exclusion ────────────────────────────────────────────
    const excludedContactIds = getExcludedContactIds(config.accountId);
    const channelTesterByDate = channelDefs.map((ch) =>
      getTesterConvsByDate(config.accountId, ch.inboxId, excludedContactIds)
    );

    // ── Apply test + tester exclusions to V2 daily reports ─────────────────
    const adjustedDailyReports = allDailyReports.map((reports, i) => {
      const afterTest = subtractTestFromDaily(reports, channelTestData[i]);
      return subtractTesterFromDaily(afterTest, channelTesterByDate[i]);
    });

    // ── Live escalation from cache (last 30 days only) ──────────────────────
    const channelLiveEscRaw = channelDefs.map((ch) =>
      getEscalation(config.accountId, ch.inboxId, config.escalationLabels, config.botAgentId, excludedContactIds)
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

    // ── IST-aligned daily totals from hourly data (eliminates UTC/IST boundary error) ──
    const channelISTOverrides = allHourlyReports.map((hourly, i) => {
      const { istDaily, utcReductions } = buildISTDailyFromHourly(hourly);
      const afterTest = subtractTestFromISTDaily(istDaily, channelTestData[i]);
      return { istDaily: subtractTesterFromISTDaily(afterTest, channelTesterByDate[i]), utcReductions };
    });

    // ── Build per-channel DailyData[] (live + baseline merged) ─────────────
    const channelDailyArrays = channelDefs.map((_, i) =>
      buildDailyData(adjustedDailyReports[i], channelISTOverrides[i], channelLiveEsc[i], channelBaseline[i])
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

    // ── Summary totals computed from dailyData (test exclusions already applied) ─
    const todayIST = getTodayIST();
    const dataStart = dailyData[0]?.date ?? todayIST;
    const presets = {
      "all-time":   { from: dataStart,                   to: todayIST },
      "this-month": { from: startOfMonthStr(todayIST),   to: todayIST },
      "last-30":    { from: addDaysStr(todayIST, -30),   to: todayIST },
      "last-7":     { from: addDaysStr(todayIST, -7),    to: todayIST },
    };
    const summaryTotals = computeSummaryTotals(dailyData, presets);

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
