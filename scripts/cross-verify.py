#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os, requests, json, time
from datetime import datetime, timezone

TOKEN = os.environ.get("CHATWOOT_API_TOKEN")
if not TOKEN:
    raise RuntimeError("CHATWOOT_API_TOKEN environment variable is not set")
BASE  = "https://desk.freedomwithai.com"
HDR   = {"api_access_token": TOKEN}
SINCE = 1744243200   # Apr 2026
NOW   = int(time.time()) + 86400
IST   = 19800

def ist_date(ts):
    return datetime.fromtimestamp(ts + IST, tz=timezone.utc).strftime('%Y-%m-%d')

def get(path, params=None):
    for i in range(3):
        try:
            r = requests.get(f"{BASE}{path}", headers=HDR, params=params, timeout=30)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            if i == 2: return None
            time.sleep(2)

def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)

test_excl      = load("src/data/test-exclusions.json")
excl_contacts  = load("src/data/excluded-contacts.json")
baseline       = load("src/data/baseline.json")
clients        = load("src/config/clients.json")

def get_test_excl_by_date(acct, inbox):
    return test_excl.get("accounts", {}).get(str(acct), {}).get(str(inbox), {})

def get_tester_convs_by_date(acct, inbox, contact_ids):
    """Returns IST-date -> count of tester conversations."""
    by_date = {}
    for cid in contact_ids:
        d = get(f"/api/v1/accounts/{acct}/contacts/{cid}/conversations")
        raw = (d or {}).get("payload", {})
        if isinstance(raw, list):
            convs = raw
        elif isinstance(raw, dict):
            convs = raw.get("data", {}).get("payload", [])
        else:
            convs = []
        for c in convs:
            if c.get("inbox_id") == inbox and c.get("created_at", 0) >= SINCE:
                dt = ist_date(c["created_at"])
                by_date[dt] = by_date.get(dt, 0) + 1
    return by_date

def apply_excl_to_daily(v2_daily, test_by_date, tester_by_date):
    """Per-date max(0) subtraction — mirrors what dashboard TypeScript does."""
    total = 0
    test_removed = tester_removed = 0
    for row in v2_daily:
        dt = ist_date(row["timestamp"])  # IST date from V2 timestamp
        val = row["value"]
        te = test_by_date.get(dt, {}).get("total", 0)
        after_test = max(0, val - te)
        test_removed += (val - after_test)
        tc = tester_by_date.get(dt, 0)
        after_tester = max(0, after_test - tc)
        tester_removed += (after_test - after_tester)
        total += after_tester
    return total, test_removed, tester_removed

def get_live_human(acct, inbox, bot_id, excl_cids, labels):
    live_since = int(time.time()) - 30 * 86400
    seen = {}
    pg = 1
    while True:
        d = get(f"/api/v1/accounts/{acct}/conversations",
                {"inbox_id": inbox, "assignee_type": "assigned", "status": "all",
                 "created_after": live_since, "page": pg})
        if not d: break
        payload = d.get("data", {}).get("payload", [])
        if not payload: break
        for c in payload:
            if c.get("created_at", 0) < live_since: continue
            aid = (c.get("meta") or {}).get("assignee", {}).get("id")
            sid = (c.get("meta") or {}).get("sender",   {}).get("id")
            if aid == bot_id:      continue
            if sid in excl_cids:   continue
            seen[c["id"]] = c
        cnt = d.get("data", {}).get("meta", {}).get("assigned_count", 0)
        if pg >= max(1, (cnt + 24) // 25): break
        pg += 1
        time.sleep(0.1)
    for label in labels:
        pg = 1
        while True:
            d = get(f"/api/v1/accounts/{acct}/conversations",
                    {"inbox_id": inbox, "labels[]": label, "status": "all",
                     "created_after": live_since, "page": pg})
            if not d: break
            payload = d.get("data", {}).get("payload", [])
            if not payload: break
            for c in payload:
                if c.get("created_at", 0) < live_since: continue
                if c["id"] in seen: continue
                aid = (c.get("meta") or {}).get("assignee", {}).get("id")
                sid = (c.get("meta") or {}).get("sender",   {}).get("id")
                if aid == bot_id:    continue
                if sid in excl_cids: continue
                seen[c["id"]] = c
            cnt = d.get("data", {}).get("meta", {}).get("all_count", 0)
            if pg >= max(1, (cnt + 24) // 25): break
            pg += 1
            time.sleep(0.1)
    return len(seen)

print("Cross-verifying all clients...\n")

rows = []
for client in clients:
    acct      = client["accountId"]
    bot_id    = client["botAgentId"]
    labels    = client.get("escalationLabels", [])
    excl_cids = set(excl_contacts.get("accounts", {}).get(str(acct), []))
    ch_defs   = client.get("channels") or [{"inboxId": client["inboxId"]}]

    client_raw = client_test = client_tester = client_baseline_h = 0
    client_dash_total = 0

    for ch in ch_defs:
        inbox = ch["inboxId"]
        # V2 daily data
        v2 = get(f"/api/v2/accounts/{acct}/reports",
                 {"type": "inbox", "metric": "conversations_count", "group_by": "day",
                  "id": inbox, "since": SINCE, "until": NOW}) or []
        raw = sum(r["value"] for r in v2)
        test_bd   = get_test_excl_by_date(acct, inbox)
        print(f"  {client['id']} inbox {inbox}: raw={raw}, test_dates={len(test_bd)}, fetching tester convos...", end=" ", flush=True)
        tester_bd = get_tester_convs_by_date(acct, inbox, excl_cids)
        print(f"tester_dates={len(tester_bd)} ({sum(tester_bd.values())} convos)")
        dash, te_actual, tc_actual = apply_excl_to_daily(v2, test_bd, tester_bd)
        bh = sum(v["human"] for v in
                 baseline.get("accounts", {}).get(str(acct), {}).get(str(inbox), {}).values())
        client_raw        += raw
        client_test       += te_actual
        client_tester     += tc_actual
        client_baseline_h += bh
        client_dash_total += dash

    print(f"  {client['id']}: fetching live human (last 30d)...", end=" ", flush=True)
    live_h = sum(get_live_human(acct, ch["inboxId"], bot_id, excl_cids, labels)
                 for ch in ch_defs)
    print(f"{live_h}")

    dash_total = client_dash_total
    dash_human = client_baseline_h + live_h
    dash_bot   = max(0, dash_total - dash_human)
    bot_pct    = round(dash_bot / dash_total * 100, 1) if dash_total else 0

    rows.append({
        "client":       client["id"],
        "raw":          client_raw,
        "test_excl":    client_test,
        "tester_excl":  client_tester,
        "dash_total":   dash_total,
        "baseline_h":   client_baseline_h,
        "live_h":       live_h,
        "dash_human":   dash_human,
        "dash_bot":     dash_bot,
        "bot_pct":      bot_pct,
    })
    print()

SEP = "=" * 108
print("\n" + SEP)
print(f"{'Client':<16} {'CW Raw':>8} {'- Tests':>7} {'- Testers':>9} {'= Total':>8} {'Human':>8} {'Bot':>8} {'Bot%':>6}  {'Excl Reason'}")
print(SEP)
for r in rows:
    reasons = []
    if r["test_excl"]:   reasons.append(f"{r['test_excl']} test-inbox")
    if r["tester_excl"]: reasons.append(f"{r['tester_excl']} tester-contact")
    note = ", ".join(reasons) if reasons else "none"
    overlap = (r["raw"] - r["test_excl"] - r["tester_excl"] - r["dash_total"])
    overlap_note = f" [overlap={overlap}]" if overlap > 0 else ""
    print(f"{r['client']:<16} {r['raw']:>8,} {r['test_excl']:>7,} {r['tester_excl']:>9,} {r['dash_total']:>8,} {r['dash_human']:>8,} {r['dash_bot']:>8,} {r['bot_pct']:>5.1f}%  {note}{overlap_note}")

print(SEP)
tr = sum(r["raw"] for r in rows)
tt = sum(r["test_excl"] for r in rows)
tc = sum(r["tester_excl"] for r in rows)
td = sum(r["dash_total"] for r in rows)
th = sum(r["dash_human"] for r in rows)
tb = sum(r["dash_bot"] for r in rows)
print(f"{'TOTAL':<16} {tr:>8,} {tt:>7,} {tc:>9,} {td:>8,} {th:>8,} {tb:>8,} {round(tb/td*100,1) if td else 0:>5.1f}%")
print(SEP)
