const BASE_URL = "https://desk.freedomwithai.com";

function getToken(): string {
  const token = process.env.CHATWOOT_API_TOKEN;
  if (!token) throw new Error("CHATWOOT_API_TOKEN is not set in environment");
  return token;
}

async function chatwootFetch(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { api_access_token: getToken() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Chatwoot API error ${res.status}: ${path}`);
  return res.json();
}

// ── V2 Reports API ─────────────────────────────────────────────────────────
// Returns daily { timestamp (seconds), value } pairs for the given inbox metric.
export interface DailyReport {
  timestamp: number; // seconds
  value: number;
}

export async function fetchDailyConversationCounts(
  accountId: number,
  inboxId: number
): Promise<DailyReport[]> {
  const since = 1735689600; // Jan 1, 2025 — all clients started in 2026; buffer for future clients
  const until = Math.floor(Date.now() / 1000) + 86400; // tomorrow
  return chatwootFetch(
    `/api/v2/accounts/${accountId}/reports?type=inbox&metric=conversations_count&group_by=day&id=${inboxId}&since=${since}&until=${until}`
  );
}

export async function fetchHourlyConversationCounts(
  accountId: number,
  inboxId: number
): Promise<DailyReport[]> {
  // Last 90 days — enough for heatmap patterns (57k rows from 2020 would be too slow)
  const since = Math.floor(Date.now() / 1000) - 90 * 86400;
  const until = Math.floor(Date.now() / 1000) + 86400;
  return chatwootFetch(
    `/api/v2/accounts/${accountId}/reports?type=inbox&metric=conversations_count&group_by=hour&id=${inboxId}&since=${since}&until=${until}`
  );
}

// ── V1 Conversations API (label-filtered) ──────────────────────────────────
// Fetches only conversations that carry the escalation label.
// Escalated conversations are always a small fraction of total, so pagination
// is fast even for large accounts.
export interface CWConversation {
  id: number;
  status: "open" | "resolved" | "pending" | "snoozed";
  created_at: number; // Unix timestamp in seconds
  labels: string[];
}

const PAGE_BATCH = 3; // fetch this many pages in parallel per label

async function fetchConversationsByLabel(
  accountId: number,
  inboxId: number,
  label: string
): Promise<CWConversation[]> {
  const url = (p: number) =>
    `/api/v1/accounts/${accountId}/conversations?inbox_id=${inboxId}&labels[]=${label}&status=all&page=${p}`;

  // Page 1: get first batch + total count from metadata
  const page1 = await chatwootFetch(url(1));
  const allCount: number = page1?.data?.meta?.all_count ?? 0;
  const first: CWConversation[] = page1?.data?.payload ?? [];
  if (first.length === 0) return [];

  const totalPages = Math.ceil(allCount / 25);
  if (totalPages <= 1) return first;

  // Remaining pages fetched in small parallel batches to stay within Chatwoot limits.
  // Individual page failures are tolerated — we skip those 25 convos rather than failing the whole label.
  const all: CWConversation[] = [...first];
  for (let start = 2; start <= totalPages; start += PAGE_BATCH) {
    const end = Math.min(start + PAGE_BATCH - 1, totalPages);
    const batch = await Promise.all(
      Array.from({ length: end - start + 1 }, (_, i) =>
        chatwootFetch(url(start + i))
          .then((d) => (d?.data?.payload ?? []) as CWConversation[])
          .catch(() => [] as CWConversation[]) // skip failed pages rather than failing the whole label
      )
    );
    for (const convs of batch) all.push(...convs);
  }

  return all;
}

// Fetches conversations matching ANY of the given escalation labels, deduplicated by ID.
// Labels are fetched SEQUENTIALLY to avoid rate-limiting / timeouts on Chatwoot.
// If a label doesn't exist (Chatwoot returns 500/404), it is silently skipped.
export async function fetchEscalatedConversations(
  accountId: number,
  inboxId: number,
  escalationLabels: string[]
): Promise<CWConversation[]> {
  const seen = new Map<number, CWConversation>();

  for (const label of escalationLabels) {
    try {
      const convs = await fetchConversationsByLabel(accountId, inboxId, label);
      for (const conv of convs) {
        if (!seen.has(conv.id)) seen.set(conv.id, conv);
      }
    } catch {
      // Label doesn't exist in this account/inbox — skip it
    }
  }

  return Array.from(seen.values());
}
