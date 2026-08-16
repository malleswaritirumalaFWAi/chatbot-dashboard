#!/usr/bin/env python3
"""
Rebuilds baseline.json with:
 - Bot agent filter (assignee.id != botAgentId)
 - Tester contact filter (sender.id not in excludedContactIds)
Cutoff: 2026-07-17 00:00:00 UTC (= live window start for today 2026-08-16)
"""
import requests, json, time
from datetime import datetime, timezone

import os
TOKEN = os.environ.get("CHATWOOT_API_TOKEN", "RAFSebhEj84TTxSPjfzU5f6d")
BASE_URL = "https://desk.freedomwithai.com"
HEADERS = {"api_access_token": TOKEN}

SINCE   = 1744243200  # 2026-04-09 approx — start of client usage
CUTOFF  = 1784246400  # 2026-07-17 00:00:00 UTC — live window start (today - 30d)
IST_OFF = 19800        # 5.5 * 3600

CLIENTS = [
    {
        "id": "eph",
        "accountId": 1,
        "botAgentId": 4,
        "excludedContactIds": [4011, 192, 2, 132, 134, 576, 2179, 7856, 635, 3675, 7862, 6831],
        "inboxes": [3, 4],
        "labels": ["bot-handoff", "needs-human"],
    },
    {
        "id": "energy-queens",
        "accountId": 3,
        "botAgentId": 24,
        "excludedContactIds": [1161, 1189, 1124, 1545, 7707],
        "inboxes": [12, 14],
        "labels": ["bot-handoff"],
    },
    {
        "id": "gonature",
        "accountId": 4,
        "botAgentId": 29,
        "excludedContactIds": [2156, 2196, 2027, 3220, 2894],
        "inboxes": [17, 16, 18, 22],
        "labels": ["bot-handoff"],
    },
    {
        "id": "dva",
        "accountId": 5,
        "botAgentId": 34,
        "excludedContactIds": [3082, 2489, 3239],
        "inboxes": [20, 21],
        "labels": ["bot-handoff"],
    },
    {
        "id": "fwai",
        "accountId": 7,
        "botAgentId": 41,
        "excludedContactIds": [],
        "inboxes": [24],
        "labels": ["bot-handoff"],
    },
    {
        "id": "flute",
        "accountId": 2,
        "botAgentId": 17,
        "excludedContactIds": [888, 652, 2036, 3303, 2884, 4546],
        "inboxes": [7, 6],
        "labels": ["bot-handoff", "needs-human"],
    },
]

def ist_date(ts):
    return datetime.fromtimestamp(ts + IST_OFF, tz=timezone.utc).strftime('%Y-%m-%d')

def get_convs(path, params, count_key="assigned_count"):
    all_convs = []
    page = 1
    while True:
        for attempt in range(3):
            try:
                r = requests.get(f"{BASE_URL}{path}", headers=HEADERS,
                                 params={**params, "page": page}, timeout=45)
                r.raise_for_status()
                data = r.json()
                break
            except Exception as e:
                if attempt == 2:
                    print(f"    FAILED page {page}: {e}")
                    return all_convs
                time.sleep(3)
        payload = data.get("data", {}).get("payload", [])
        meta    = data.get("data", {}).get("meta", {})
        if not payload:
            break
        # only keep conversations created before cutoff
        filtered = [c for c in payload if c.get("created_at", 0) < CUTOFF]
        all_convs.extend(filtered)
        total_count = meta.get(count_key, 0)
        total_pages = max(1, (total_count + 24) // 25)
        sys.stdout.write(f"\r    page {page}/{total_pages} (+{len(filtered)}) total={len(all_convs)}   ")
        sys.stdout.flush()
        if page >= total_pages:
            break
        page += 1
        time.sleep(0.15)
    print()
    return all_convs

import sys

result = {
    "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "cutoffDate": "2026-07-17",
    "cutoffTs": CUTOFF,
    "accounts": {}
}

for client in CLIENTS:
    acct      = client["accountId"]
    bot_id    = client["botAgentId"]
    excluded  = set(client["excludedContactIds"])
    print(f"\n=== {client['id']} (account {acct}) ===")
    if str(acct) not in result["accounts"]:
        result["accounts"][str(acct)] = {}

    for inbox_id in client["inboxes"]:
        print(f"\n  Inbox {inbox_id}:")
        seen = {}  # conv_id -> conv

        # 1. Assigned conversations
        print("  Fetching assigned...")
        assigned = get_convs(
            f"/api/v1/accounts/{acct}/conversations",
            {"inbox_id": inbox_id, "assignee_type": "assigned", "status": "all", "created_after": SINCE},
            count_key="assigned_count"
        )
        for c in assigned:
            assignee_id = (c.get("meta") or {}).get("assignee", {}).get("id")
            sender_id   = (c.get("meta") or {}).get("sender",   {}).get("id")
            if assignee_id == bot_id:    continue
            if sender_id in excluded:    continue
            seen[c["id"]] = c

        # 2. Label-based
        for label in client["labels"]:
            print(f"  Fetching label={label}...")
            labeled = get_convs(
                f"/api/v1/accounts/{acct}/conversations",
                {"inbox_id": inbox_id, "labels[]": label, "status": "all", "created_after": SINCE},
                count_key="all_count"
            )
            for c in labeled:
                if c["id"] in seen:      continue
                assignee_id = (c.get("meta") or {}).get("assignee", {}).get("id")
                sender_id   = (c.get("meta") or {}).get("sender",   {}).get("id")
                if assignee_id == bot_id: continue
                if sender_id in excluded: continue
                seen[c["id"]] = c

        # Group by IST date
        by_date = {}
        for c in seen.values():
            d = ist_date(c["created_at"])
            if d not in by_date:
                by_date[d] = {"human": 0, "humanResolved": 0}
            by_date[d]["human"] += 1
            if c.get("status") == "resolved":
                by_date[d]["humanResolved"] += 1

        result["accounts"][str(acct)][str(inbox_id)] = by_date
        print(f"  => {len(seen)} human convs across {len(by_date)} dates")

print("\n\n=== Summary ===")
for acct, inboxes in result["accounts"].items():
    for inbox_id, dates in inboxes.items():
        total = sum(d["human"] for d in dates.values())
        print(f"  Account {acct}, Inbox {inbox_id}: {total} human convs")

out = "src/data/baseline.json"
with open(out, "w") as f:
    json.dump(result, f, indent=2)
print(f"\nSaved to {out}")
