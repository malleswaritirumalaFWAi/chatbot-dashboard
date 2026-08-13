import { AllTimeMetrics, WeeklyMetrics } from "./types";

function funnelRow(label: string, icon: string, text: string, pct: number, count: number | string, color: string, countColor = "#374151") {
  const isSmall = pct < 5;
  return `
  <div style="display:flex;align-items:center;gap:16px;margin:6px 0">
    <div style="width:150px;text-align:right;font-size:13px;font-weight:500;color:#6b7280;display:flex;align-items:center;justify-content:flex-end;gap:6px;flex-shrink:0">
      <span>${icon}</span><span>${label}</span>
    </div>
    <div style="flex:1;background:#f3f4f6;border-radius:8px;height:44px;overflow:hidden;position:relative">
      <div style="width:${Math.max(pct, isSmall ? 3 : 0)}%;min-width:${isSmall ? "3rem" : "0"};height:100%;background:${color};display:flex;align-items:center;justify-content:space-between;padding:0 12px;border-radius:8px;box-sizing:border-box">
        ${!isSmall ? `<span style="color:white;font-weight:500;font-size:13px;white-space:nowrap;overflow:hidden">${text}</span><span style="color:white;font-weight:700;font-size:13px;margin-left:8px;flex-shrink:0">${pct.toFixed(1)}%</span>` : ""}
      </div>
    </div>
    <div style="width:48px;text-align:right;font-size:13px;font-weight:600;color:${countColor};flex-shrink:0">${typeof count === "number" && count > 100 ? count.toLocaleString() : `~${count}`}</div>
  </div>`;
}

function summaryCard(label: string, value: string, color: string, sub: string) {
  return `
  <div style="background:white;border-radius:12px;border:1px solid #f3f4f6;box-shadow:0 1px 3px rgba(0,0,0,0.06);padding:20px;flex:1;min-width:140px">
    <p style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:#9ca3af;text-transform:uppercase;margin:0 0 12px 0">${label}</p>
    <p style="font-size:28px;font-weight:700;color:${color};margin:0 0 4px 0">${value}</p>
    <p style="font-size:11px;color:#9ca3af;margin:0">${sub}</p>
  </div>`;
}

function journeyCard(value: string, label: string, borderColor: string, valueColor: string) {
  return `
  <div style="border:2px solid ${borderColor};border-radius:12px;padding:16px 20px;flex:1;text-align:center;min-width:120px">
    <p style="font-size:22px;font-weight:700;color:${valueColor};margin:0 0 4px 0">${value}</p>
    <p style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;margin:0">${label}</p>
  </div>`;
}

function badge(value: string, bg: string) {
  return `<span style="display:inline-block;padding:2px 10px;border-radius:9999px;font-size:11px;font-weight:700;color:white;background:${bg}">${value}</span>`;
}

function sectionHeader(icon: string, title: string) {
  return `
  <div style="display:flex;align-items:center;gap:10px;margin:0 0 20px 0">
    <div style="width:4px;height:24px;background:#7c3aed;border-radius:4px;flex-shrink:0"></div>
    <span style="font-size:18px;line-height:1">${icon}</span>
    <h2 style="font-size:17px;font-weight:600;color:#1f2937;margin:0">${title}</h2>
  </div>`;
}

function darkBanner(icon: string, title: string, subtitle: string) {
  return `
  <div style="background:#0d1b2e;border-radius:12px;padding:20px 24px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <span style="font-size:18px">${icon}</span>
      <h2 style="font-size:18px;font-weight:600;color:white;margin:0">${title}</h2>
    </div>
    <p style="font-size:13px;color:#9ca3af;margin:0">${subtitle}</p>
  </div>`;
}

function hBar(label: string, value: number, max: number, color: string) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return `
  <div style="display:flex;align-items:center;gap:10px;margin:6px 0">
    <span style="font-size:11px;color:#6b7280;width:150px;text-align:right;flex-shrink:0">${label}</span>
    <div style="flex:1;background:#f3f4f6;border-radius:6px;height:28px;overflow:hidden">
      <div style="width:${Math.max(w, value > 0 ? 5 : 0)}%;height:100%;background:${color};display:flex;align-items:center;padding:0 8px;box-sizing:border-box;border-radius:6px">
        <span style="color:white;font-size:11px;font-weight:700">${value}</span>
      </div>
    </div>
    <span style="font-size:11px;font-weight:600;color:#374151;width:36px;text-align:right;flex-shrink:0">${value}</span>
  </div>`;
}

export function generateHTMLReport(
  clientName: string,
  subtitle: string,
  at: AllTimeMetrics,
  wk: WeeklyMetrics,
  rangeLabel: string,
  weekLabel: string
): string {
  const now = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // Monthly chart data
  const monthLabels = JSON.stringify(at.monthlyData.map((m) => m.month));
  const monthBot = JSON.stringify(at.monthlyData.map((m) => m.bot));
  const monthHuman = JSON.stringify(at.monthlyData.map((m) => m.human));
  const monthRate = JSON.stringify(at.monthlyData.map((m) => m.botRate));

  // Daily chart data
  const dayLabels = JSON.stringify(wk.dailyData.map((d) => d.label));
  const dayBot = JSON.stringify(wk.dailyData.map((d) => d.bot));
  const dayHuman = JSON.stringify(wk.dailyData.map((d) => d.human));
  const dayRate = JSON.stringify(wk.dailyData.map((d) => d.botRate));

  const maxMonthlyBar = Math.max(...at.monthlyData.flatMap((m) => [m.bot, m.human]));
  const maxDailyBot = Math.max(...wk.dailyData.map((d) => d.bot));

  // Breakdown table rows
  const tableRows = wk.dailyData.map((d) => {
    const rateColor = d.botRate >= 70 ? "#22c55e" : d.botRate >= 50 ? "#f59e0b" : "#ef4444";
    return `
    <tr style="border-top:1px solid #f1f5f9">
      <td style="padding:10px 16px;font-weight:600;font-size:13px;color:#1f2937">${d.date}</td>
      <td style="padding:10px 12px;font-size:13px;color:#374151">${d.total}</td>
      <td style="padding:10px 12px">${badge(String(d.bot), "#22c55e")}</td>
      <td style="padding:10px 12px">${badge(String(d.human), "#f59e0b")}</td>
      <td style="padding:10px 12px">${badge(String(d.humanResolved), "#60a5fa")}</td>
      <td style="padding:10px 12px">${badge(Math.round(d.botRate) + "%", rateColor)}</td>
    </tr>`;
  }).join("");

  const totals = wk.dailyData.reduce((a, d) => ({ total: a.total + d.total, bot: a.bot + d.bot, human: a.human + d.human, hr: a.hr + d.humanResolved }), { total: 0, bot: 0, human: 0, hr: 0 });
  const totalRate = totals.total > 0 ? Math.round((totals.bot / totals.total) * 100) : 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${clientName} — Chatbot Impact Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f1f5f9; color: #1f2937; }
    .page { max-width: 1100px; margin: 0 auto; padding: 24px 16px; }
    .section { margin-bottom: 24px; }
    .card { background: white; border-radius: 12px; border: 1px solid #f3f4f6; box-shadow: 0 1px 3px rgba(0,0,0,0.06); padding: 24px; }
    .cards-row { display: flex; gap: 12px; flex-wrap: wrap; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: #9ca3af; text-transform: uppercase; padding: 8px 12px; background: #f8fafc; }
    .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    @media print { body { background: white; } .page { padding: 0; } }
    canvas { max-width: 100%; }
  </style>
</head>
<body>

<!-- HEADER -->
<div style="background:#0d1b2e;padding:24px 32px 28px">
  <div style="max-width:1100px;margin:0 auto">
    <h1 style="font-size:24px;font-weight:700;color:white;margin-bottom:4px">${clientName} — Chatbot Impact Report</h1>
    <p style="font-size:13px;color:#9ca3af;margin-bottom:16px">${subtitle}</p>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.1);color:#e5e7eb;font-size:12px;padding:6px 14px;border-radius:9999px">📅 Report: ${rangeLabel} · ${at.total.toLocaleString()} conversations</span>
      <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.1);color:#e5e7eb;font-size:12px;padding:6px 14px;border-radius:9999px">📅 Last 7 days: ${weekLabel} · ${wk.total.toLocaleString()} conversations</span>
      <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.1);color:#e5e7eb;font-size:12px;padding:6px 14px;border-radius:9999px">🕐 Generated: ${now}</span>
    </div>
  </div>
</div>

<div class="page">

<!-- ALL TIME BANNER -->
<div class="section">
  ${darkBanner("📅", `Report — ${at.startDate} to ${at.endDate}`, "Complete chatbot performance for selected period")}
</div>

<!-- SUMMARY -->
<div class="section">
  ${sectionHeader("📊", "Summary")}
  <div class="cards-row">
    ${summaryCard("Total Conversations", at.total.toLocaleString(), "#3b82f6", `${at.startDate} – ${at.endDate}`)}
    ${summaryCard("Bot Auto-Resolved", at.botResolved.toLocaleString(), "#22c55e", `${at.botResolvedPct}% of all queries`)}
    ${summaryCard("Escalated to Human", at.escalated.toLocaleString(), "#f87171", `${at.escalatedPct}% of all queries`)}
    ${summaryCard("Human Resolved", at.humanResolved.toLocaleString(), "#14b8a6", `${at.humanResolvedPct}% of escalated`)}
    ${summaryCard("Bot Rate Trend", `${at.botRateTrend.from}→${at.botRateTrend.to}%`, "#a855f7", `${at.botRateTrend.fromMonth} → ${at.botRateTrend.toMonth} improvement`)}
    ${summaryCard("Hours Saved", `~${at.hoursSaved} hrs`, "#f59e0b", `≈ ${at.workingDaysSaved} workdays saved`)}
  </div>
</div>

<!-- FUNNEL -->
<div class="section">
  ${sectionHeader("🔽", "Query Resolution Funnel")}
  <div class="card">
    <p style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:#9ca3af;text-transform:uppercase;margin-bottom:16px">How all ${at.total.toLocaleString()} queries were handled</p>
    ${funnelRow("Total Inbound", "", `${at.total.toLocaleString()} Conversations`, 100, at.total, "#3b82f6")}
    ${funnelRow("Bot Resolved", "✅", `${at.botResolved.toLocaleString()} Auto-resolved by AI`, at.botResolvedPct, at.botResolved, "#22c55e")}
    ${funnelRow("Escalated", "⚠️", `${at.escalated.toLocaleString()} → Human Agent`, at.escalatedPct, at.escalated, "#f59e0b")}
    ${funnelRow("Human Resolved", "✅", `${at.humanResolved.toLocaleString()} Resolved by Agents`, at.humanResolvedOfTotalPct, at.humanResolved, "#14b8a6")}
    ${funnelRow("Currently Open", "⏳", "", at.openPct, at.open, "#9ca3af", "#9ca3af")}
  </div>
</div>

<!-- RESOLUTION FLOW -->
<div class="section">
  ${sectionHeader("🔄", "Resolution Flow & Hours Saved")}
  <div class="card">
    <p style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:#9ca3af;text-transform:uppercase;margin-bottom:16px">Journey of a Query — All Time</p>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:28px">
      ${journeyCard(at.total.toLocaleString(), "Total Queries", "#e5e7eb", "#1f2937")}
      <span style="color:#9ca3af;font-size:20px">→</span>
      ${journeyCard(at.botResolved.toLocaleString(), "Bot Resolved ✅", "#86efac", "#22c55e")}
      <span style="color:#9ca3af;font-size:20px">→</span>
      ${journeyCard(at.escalated.toLocaleString(), "Escalated to Human", "#c4b5fd", "#a855f7")}
      <span style="color:#9ca3af;font-size:20px">→</span>
      ${journeyCard(at.humanResolved.toLocaleString(), "Human Resolved ✅", "#93c5fd", "#3b82f6")}
      <span style="color:#9ca3af;font-size:20px">→</span>
      ${journeyCard(`~${at.hoursSaved} hrs`, "Team Time Saved", "#fcd34d", "#f59e0b")}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px">
      <div>
        <p style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;margin-bottom:12px">Bot vs Human Performance</p>
        <table>
          <thead><tr><th>Metric</th><th style="text-align:center">Bot</th><th style="text-align:center">Human</th></tr></thead>
          <tbody>
            <tr style="border-top:1px solid #f1f5f9"><td style="padding:10px 12px;font-size:13px;color:#4b5563">Queries handled</td><td style="padding:10px 12px;text-align:center">${badge(at.botHandled.toLocaleString(), "#22c55e")}</td><td style="padding:10px 12px;text-align:center">${badge(at.escalated.toLocaleString(), "#3b82f6")}</td></tr>
            <tr style="border-top:1px solid #f1f5f9"><td style="padding:10px 12px;font-size:13px;color:#4b5563">Resolved</td><td style="padding:10px 12px;text-align:center">${badge(at.botResolved.toLocaleString(), "#22c55e")}</td><td style="padding:10px 12px;text-align:center">${badge(at.humanResolved.toLocaleString(), "#3b82f6")}</td></tr>
            <tr style="border-top:1px solid #f1f5f9"><td style="padding:10px 12px;font-size:13px;color:#4b5563">Resolution rate</td><td style="padding:10px 12px;text-align:center">${badge(((at.botResolved / at.botHandled) * 100).toFixed(1) + "%", "#22c55e")}</td><td style="padding:10px 12px;text-align:center">${badge(at.humanResolvedPct + "%", "#22c55e")}</td></tr>
            <tr style="border-top:1px solid #f1f5f9"><td style="padding:10px 12px;font-size:13px;color:#4b5563">Response speed</td><td style="padding:10px 12px;text-align:center">${badge("~10s auto", "#60a5fa")}</td><td style="padding:10px 12px;text-align:center">${badge("Manual", "#fbbf24")}</td></tr>
            <tr style="border-top:1px solid #f1f5f9"><td style="padding:10px 12px;font-size:13px;color:#4b5563">Still open</td><td style="padding:10px 12px;text-align:center">${badge("0", "#9ca3af")}</td><td style="padding:10px 12px;text-align:center">${badge("~" + at.open, "#f87171")}</td></tr>
          </tbody>
        </table>
      </div>
      <div>
        <p style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;margin-bottom:12px">⏱ Hours Saved Calculation</p>
        <table>
          <thead><tr><th>Component</th><th style="text-align:right">Value</th></tr></thead>
          <tbody>
            <tr style="border-top:1px solid #f1f5f9"><td style="padding:10px 12px;font-size:13px;color:#4b5563">Bot-handled queries</td><td style="padding:10px 12px;text-align:right">${badge(at.botHandled.toLocaleString(), "#22c55e")}</td></tr>
            <tr style="border-top:1px solid #f1f5f9"><td style="padding:10px 12px;font-size:13px;color:#4b5563">Avg handling time / query</td><td style="padding:10px 12px;text-align:right">${badge(at.avgHandlingTimeMinutes + " minutes", "#3b82f6")}</td></tr>
            <tr style="border-top:1px solid #f1f5f9"><td style="padding:10px 12px;font-size:13px;color:#4b5563">Total minutes saved</td><td style="padding:10px 12px;text-align:right">${badge(at.minutesSaved.toLocaleString() + " min", "#fbbf24")}</td></tr>
            <tr style="border-top:1px solid #f1f5f9"><td style="padding:10px 12px;font-size:13px;color:#4b5563;font-weight:600">Hours saved</td><td style="padding:10px 12px;text-align:right">${badge("~" + at.hoursSaved + " hours", "#22c55e")}</td></tr>
            <tr style="border-top:1px solid #f1f5f9"><td style="padding:10px 12px;font-size:13px;color:#4b5563">Working days saved (8hr)</td><td style="padding:10px 12px;text-align:right">${badge("~" + at.workingDaysSaved + " days", "#22c55e")}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<!-- MONTHLY TRENDS -->
<div class="section">
  ${sectionHeader("📈", "Monthly Trends")}
  <div class="card">
    <div class="charts-grid">
      <div>
        <p style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;margin-bottom:12px">Monthly Volume (Bot vs Human)</p>
        <canvas id="monthlyBar" height="220"></canvas>
      </div>
      <div>
        <p style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;margin-bottom:12px">Bot Resolution Rate % — Monthly Improvement</p>
        <canvas id="monthlyLine" height="220"></canvas>
      </div>
      <div>
        <p style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;margin-bottom:12px">Overall Split (All ${at.total.toLocaleString()} Conversations)</p>
        <div style="display:flex;justify-content:center"><canvas id="overallDonut" width="220" height="220"></canvas></div>
        <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:8px">
          <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#4b5563"><span style="width:12px;height:12px;background:#22c55e;border-radius:2px;display:inline-block"></span>Bot Resolved (${at.botResolvedPct}%)</div>
          <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#4b5563"><span style="width:12px;height:12px;background:#3b82f6;border-radius:2px;display:inline-block"></span>Human Handled (${at.escalatedPct}%)</div>
          <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#4b5563"><span style="width:12px;height:12px;background:#d1d5db;border-radius:2px;display:inline-block"></span>Unclassified</div>
        </div>
      </div>
      <div>
        <p style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;margin-bottom:12px">Monthly Breakdown</p>
        ${at.monthlyData.flatMap((m) => [
          hBar(`${m.month} (Bot)`, m.bot, maxMonthlyBar, "#22c55e"),
          hBar(`${m.month} (Human)`, m.human, maxMonthlyBar, "#3b82f6"),
        ]).join("")}
      </div>
    </div>
  </div>
</div>

<!-- WEEKLY BANNER -->
<div class="section">
  ${darkBanner("📅", `Last 7 Days — ${wk.startDate} to ${wk.endDate}`, "7-day performance snapshot")}
</div>

<!-- WEEKLY SUMMARY -->
<div class="section">
  ${sectionHeader("📊", "Weekly Summary")}
  <div class="cards-row">
    ${summaryCard("Total Conversations", wk.total.toLocaleString(), "#3b82f6", `${wk.startDate} – ${wk.endDate}`)}
    ${summaryCard("Bot Auto-Resolved", wk.botResolved.toLocaleString(), "#22c55e", `${wk.botResolvedPct}% of queries`)}
    ${summaryCard("Escalated to Human", wk.escalated.toLocaleString(), "#f87171", `${wk.escalatedPct}% of queries`)}
    ${summaryCard("Human Resolved", wk.humanResolved.toLocaleString(), "#14b8a6", `${wk.humanResolvedPct}% of escalated`)}
    ${summaryCard("Peak Day", wk.peakDay.label, "#a855f7", `${wk.peakDay.count} conversations`)}
    ${summaryCard("Hours Saved", `~${wk.hoursSaved} hrs`, "#f59e0b", `${wk.botResolved} queries × ${wk.avgHandlingTimeMinutes} min`)}
  </div>
</div>

<!-- WEEKLY FUNNEL -->
<div class="section">
  ${sectionHeader("🔽", "Weekly Resolution Funnel")}
  <div class="card">
    <p style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:#9ca3af;text-transform:uppercase;margin-bottom:16px">How all ${wk.total.toLocaleString()} queries were handled this week</p>
    ${funnelRow("Total Inbound", "", `${wk.total.toLocaleString()} Conversations`, 100, wk.total, "#3b82f6")}
    ${funnelRow("Bot Resolved", "✅", `${wk.botResolved} Auto-resolved by AI`, wk.botResolvedPct, wk.botResolved, "#22c55e")}
    ${funnelRow("Escalated", "⚠️", `${wk.escalated} → Human Agent`, wk.escalatedPct, wk.escalated, "#f59e0b")}
    ${funnelRow("Human Resolved", "✅", `${wk.humanResolved} Resolved by Agents`, wk.humanResolvedOfTotalPct, wk.humanResolved, "#14b8a6")}
    ${funnelRow("Still Open", "✕", "", wk.openPct, wk.open, "#ef4444", "#ef4444")}
  </div>
</div>

<!-- DAILY TRENDS -->
<div class="section">
  ${sectionHeader("📝", `Daily Trends — ${wk.startDate} to ${wk.endDate}`)}
  <div class="card">
    <div class="charts-grid">
      <div>
        <p style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;margin-bottom:12px">Daily Conversations (Bot vs Human)</p>
        <canvas id="dailyBar" height="220"></canvas>
      </div>
      <div>
        <p style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;margin-bottom:12px">Bot Resolution Rate % (Daily)</p>
        <canvas id="dailyLine" height="220"></canvas>
      </div>
      <div>
        <p style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;margin-bottom:12px">Weekly Split (All ${wk.total.toLocaleString()} Conversations)</p>
        <div style="display:flex;justify-content:center"><canvas id="weeklyDonut" width="220" height="220"></canvas></div>
        <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:8px">
          <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#4b5563"><span style="width:12px;height:12px;background:#22c55e;border-radius:2px;display:inline-block"></span>Bot Resolved (${wk.botResolvedPct}%)</div>
          <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#4b5563"><span style="width:12px;height:12px;background:#3b82f6;border-radius:2px;display:inline-block"></span>Human Handled (${wk.escalatedPct}%)</div>
        </div>
      </div>
      <div>
        <p style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;margin-bottom:12px">Daily Volume Bars</p>
        ${wk.dailyData.map((d) => hBar(`${d.label} (Bot)`, d.bot, maxDailyBot, "#22c55e")).join("")}
      </div>
    </div>
  </div>
</div>

<!-- BREAKDOWN TABLE -->
<div class="section">
  ${sectionHeader("📅", `Full Daily Breakdown — ${wk.startDate} to ${wk.endDate}`)}
  <div class="card" style="padding:0;overflow:hidden">
    <table>
      <thead>
        <tr style="background:#f8fafc;border-bottom:1px solid #f1f5f9">
          <th style="padding:10px 16px">Date</th>
          <th style="padding:10px 12px">Total</th>
          <th style="padding:10px 12px">Bot Resolved</th>
          <th style="padding:10px 12px">Human Handled</th>
          <th style="padding:10px 12px">Human Resolved</th>
          <th style="padding:10px 12px">Bot Rate</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
      <tfoot>
        <tr style="border-top:2px solid #e5e7eb;background:#f8fafc">
          <td style="padding:10px 16px;font-weight:700;font-size:13px">TOTAL</td>
          <td style="padding:10px 12px;font-weight:700;font-size:13px">${totals.total}</td>
          <td style="padding:10px 12px">${badge(String(totals.bot), "#22c55e")}</td>
          <td style="padding:10px 12px">${badge(String(totals.human), "#f59e0b")}</td>
          <td style="padding:10px 12px">${badge(String(totals.hr), "#60a5fa")}</td>
          <td style="padding:10px 12px">${badge(totalRate + "%", "#22c55e")}</td>
        </tr>
      </tfoot>
    </table>
    <div style="padding:12px 16px;border-top:1px solid #f1f5f9;text-align:center;font-size:11px;color:#9ca3af">
      Generated by Claude Code · ${clientName} Chatbot Analytics · Source: Chatwoot API · As of ${now}
    </div>
  </div>
</div>

</div><!-- end .page -->

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
<script>
  const GREEN = '#22c55e', BLUE = '#3b82f6', GRAY = '#d1d5db';
  Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  Chart.defaults.font.size = 11;

  // Monthly stacked bar
  new Chart(document.getElementById('monthlyBar'), {
    type: 'bar',
    data: {
      labels: ${monthLabels},
      datasets: [
        { label: 'Bot Resolved', data: ${monthBot}, backgroundColor: GREEN, stack: 'a' },
        { label: 'Human Handled', data: ${monthHuman}, backgroundColor: BLUE, stack: 'a', borderRadius: { topLeft: 4, topRight: 4 } }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }, scales: { x: { grid: { display: false } }, y: { grid: { color: '#f0f0f0' } } } }
  });

  // Monthly line chart
  new Chart(document.getElementById('monthlyLine'), {
    type: 'line',
    data: {
      labels: ${monthLabels},
      datasets: [{
        label: 'Bot Resolution %',
        data: ${monthRate},
        borderColor: GREEN, backgroundColor: 'rgba(34,197,94,0.1)',
        fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: GREEN, pointBorderColor: '#fff', pointBorderWidth: 2, borderWidth: 2.5
      }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }, scales: { x: { grid: { display: false } }, y: { min: 0, max: 100, grid: { color: '#f0f0f0' }, ticks: { callback: v => v + '%' } } } }
  });

  // Overall donut
  new Chart(document.getElementById('overallDonut'), {
    type: 'doughnut',
    data: {
      labels: ['Bot Resolved', 'Human Handled', 'Unclassified'],
      datasets: [{ data: [${at.botResolvedPct}, ${at.escalatedPct}, ${at.unclassifiedPct || (100 - at.botResolvedPct - at.escalatedPct).toFixed(1)}], backgroundColor: [GREEN, BLUE, GRAY], borderWidth: 2, borderColor: '#fff' }]
    },
    options: { responsive: false, cutout: '60%', plugins: { legend: { display: false } } }
  });

  // Daily stacked bar
  new Chart(document.getElementById('dailyBar'), {
    type: 'bar',
    data: {
      labels: ${dayLabels},
      datasets: [
        { label: 'Bot Resolved', data: ${dayBot}, backgroundColor: GREEN, stack: 'a' },
        { label: 'Human Handled', data: ${dayHuman}, backgroundColor: BLUE, stack: 'a', borderRadius: { topLeft: 4, topRight: 4 } }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }, scales: { x: { grid: { display: false } }, y: { grid: { color: '#f0f0f0' } } } }
  });

  // Daily line chart
  new Chart(document.getElementById('dailyLine'), {
    type: 'line',
    data: {
      labels: ${dayLabels},
      datasets: [{
        label: 'Bot Resolution %',
        data: ${dayRate},
        borderColor: GREEN, backgroundColor: 'rgba(34,197,94,0.1)',
        fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: GREEN, pointBorderColor: '#fff', pointBorderWidth: 2, borderWidth: 2.5
      }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }, scales: { x: { grid: { display: false } }, y: { min: 0, max: 100, grid: { color: '#f0f0f0' }, ticks: { callback: v => v + '%' } } } }
  });

  // Weekly donut
  new Chart(document.getElementById('weeklyDonut'), {
    type: 'doughnut',
    data: {
      labels: ['Bot Resolved', 'Human Handled', 'Unclassified'],
      datasets: [{ data: [${wk.botResolvedPct}, ${wk.escalatedPct}, ${Math.max(0, 100 - wk.botResolvedPct - wk.escalatedPct).toFixed(1)}], backgroundColor: [GREEN, BLUE, GRAY], borderWidth: 2, borderColor: '#fff' }]
    },
    options: { responsive: false, cutout: '60%', plugins: { legend: { display: false } } }
  });
</script>
</body>
</html>`;
}

export function downloadReport(html: string, clientName: string, dateRange: string) {
  const slug = clientName.toLowerCase().replace(/\s+/g, "-");
  const date = new Date().toISOString().split("T")[0];
  const filename = `${slug}-report-${date}.html`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
