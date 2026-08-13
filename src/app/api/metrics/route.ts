import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";

// Extend Vercel function timeout to 300s (Pro) / max allowed on Hobby
export const maxDuration = 300;
import {
  fetchDailyConversationCounts,
  fetchEscalatedConversations,
  fetchHourlyConversationCounts,
  type CWConversation,
} from "@/lib/chatwoot";
import type { DailyData } from "@/lib/types";
import clientsConfig from "@/config/clients.json";

// ── Module-level escalation cache ─────────────────────────────────────────────
// Persists across requests in the long-running Next.js dev/prod process.
// key = "accountId:inboxId:label1,label2" → cached per-date escalation map
interface EscCacheEntry {
  byDate: Map<string, { human: number; humanResolved: number }>;
  fetchedAt: number;
}
const escCache = new Map<string, EscCacheEntry | "loading">();
const ESC_TTL_MS = 10 * 60 * 1000; // 10 minutes

function escKey(accountId: number, inboxId: number, labels: string[]): string {
  return `${accountId}:${inboxId}:${[...labels].sort().join(",")}`;
}

function buildByDate(convs: CWConversation[]): Map<string, { human: number; humanResolved: number }> {
  const byDate = new Map<string, { human: number; humanResolved: number }>();
  for (const conv of convs) {
    const date = toDateStr(conv.created_at);
    if (!byDate.has(date)) byDate.set(date, { human: 0, humanResolved: 0 });
    const e = byDate.get(date)!;
    e.human++;
    if (conv.status === "resolved") e.humanResolved++;
  }
  return byDate;
}

// Returns cached escalation map if available; otherwise kicks off a background fetch and returns empty map.
function getEscalation(
  accountId: number,
  inboxId: number,
  labels: string[]
): Map<string, { human: number; humanResolved: number }> {
  const key = escKey(accountId, inboxId, labels);
  const cached = escCache.get(key);

  // Fresh cache — use it
  if (cached && cached !== "loading" && Date.now() - cached.fetchedAt < ESC_TTL_MS) {
    return cached.byDate;
  }

  // Already loading — don't start another fetch; return empty for now
  if (cached === "loading") return new Map();

  // Stale or missing — kick off background fetch via waitUntil() so Vercel keeps the Lambda alive
  escCache.set(key, "loading");
  waitUntil((async () => {
    try {
      const convs = await fetchEscalatedConversations(accountId, inboxId, labels);
      escCache.set(key, { byDate: buildByDate(convs), fetchedAt: Date.now() });
      console.log(`[cache] warmed ${key} (${convs.length} escalated convos)`);
    } catch {
      escCache.delete(key); // allow retry next time
    }
  })());

  return new Map(); // return empty for this request; next refresh will have data
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function toDateStr(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().split("T")[0];
}

function dateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// Build DailyData[] for a single inbox — uses cached escalation so response is fast.
function buildDailyData(
  dailyReports: { timestamp: number; value: number }[],
  escalatedByDate: Map<string, { human: number; humanResolved: number }>
): DailyData[] {
  const totalByDate = new Map<string, number>();
  for (const row of dailyReports) {
    if (row.value > 0) totalByDate.set(toDateStr(row.timestamp), row.value);
  }

  const allDates = new Set([
    ...Array.from(totalByDate.keys()),
    ...Array.from(escalatedByDate.keys()),
  ]);

  return Array.from(allDates)
    .sort()
    .map((date) => {
      const total = totalByDate.get(date) ?? 0;
      const { human = 0, humanResolved = 0 } = escalatedByDate.get(date) ?? {};
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

// Aggregate multiple DailyData[] arrays by summing per date
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

// Build 7×24 heatmap matrix in IST (UTC+5:30). Rows: Mon=0…Sun=6.
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

    // ── Fetch V2 daily + hourly data for all channels in parallel (fast) ────
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

    // ── Escalation data from cache (non-blocking) ────────────────────────────
    const channelEscalation = channelDefs.map((ch) =>
      getEscalation(config.accountId, ch.inboxId, config.escalationLabels)
    );

    // ── Build per-channel DailyData[] ────────────────────────────────────────
    const channelDailyArrays = channelDefs.map((_, i) =>
      buildDailyData(allDailyReports[i], channelEscalation[i])
    );

    // ── Aggregate all channels into main dailyData ────────────────────────────
    const dailyData = aggregateDailyData(channelDailyArrays);

    // ── Heatmap from all channels combined ────────────────────────────────────
    const heatmap = buildHeatmap(allHourlyReports.flat());

    // ── Per-channel data for breakdown panel ──────────────────────────────────
    const hasMultipleChannels = config.channels && config.channels.length > 0;
    const channelDailyData = hasMultipleChannels
      ? channelDefs.map((ch, i) => ({
          name: ch.name,
          icon: ch.icon,
          inboxId: ch.inboxId,
          dailyData: channelDailyArrays[i],
        }))
      : [];

    // ── Indicate whether escalation data is from cache or still loading ───────
    const escalationReady = channelDefs.every((ch) => {
      const key = escKey(config.accountId, ch.inboxId, config.escalationLabels);
      const c = escCache.get(key);
      return c && c !== "loading";
    });

    const today = new Date().toISOString().split("T")[0];
    return NextResponse.json({
      dailyData,
      startDate: dailyData[0]?.date ?? today,
      endDate: today,
      heatmap,
      channelDailyData,
      escalationReady, // frontend can show a banner if false
    });
  } catch (err) {
    console.error("Chatwoot fetch error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch data" },
      { status: 500 }
    );
  }
}
