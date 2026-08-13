import type { AllTimeMetrics } from "./types";

interface WeekGroup {
  label: string;
  startDate: string;
  endDate: string;
  total: number;
  bot: number;
  human: number;
  humanResolved: number;
  open: number;
  botRate: number;
}

export function generateHTMLReport(
  clientName: string,
  subtitle: string,
  at: AllTimeMetrics,
  weekGroups: WeekGroup[],
  rangeLabel: string,
): string {
  const now = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const wkLabels = JSON.stringify(weekGroups.map((w) => w.label.split(" – ")[0]));
  const wkBot = JSON.stringify(weekGroups.map((w) => w.bot));
  const wkHuman = JSON.stringify(weekGroups.map((w) => w.human));
  const wkRate = JSON.stringify(weekGroups.map((w) => w.botRate));
  const bestWeek = weekGroups.length > 0
    ? weekGroups.reduce((best, w) => (w.botRate > best.botRate ? w : best), weekGroups[0])
    : null;

  const tableRows = weekGroups.map((w, i) => {
    const prev = i > 0 ? weekGroups[i - 1].botRate : null;
    const trend = prev !== null ? (w.botRate > prev ? "▲" : w.botRate < prev ? "▼" : "—") : "—";
    const trendColor = prev !== null ? (w.botRate > prev ? "#22c55e" : w.botRate < prev ? "#ef4444" : "#94a3b8") : "#94a3b8";
    const rateColor = w.botRate >= 70 ? "#22c55e" : w.botRate >= 50 ? "#f59e0b" : "#ef4444";
    const hrPct = w.human > 0 ? Math.round((w.humanResolved / w.human) * 100) : 0;
    return `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 10px 14px; font-size: 12px; color: #475569;">${w.label}</td>
      <td style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #1e3a5f; text-align: right;">${w.total.toLocaleString()}</td>
      <td style="padding: 10px 14px; text-align: right;">
        <span style="background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 600;">${w.bot.toLocaleString()}</span>
      </td>
      <td style="padding: 10px 14px; text-align: right;">
        <span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 600;">${w.human.toLocaleString()}</span>
      </td>
      <td style="padding: 10px 14px; text-align: right;">
        <span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 600;">${w.humanResolved} <span style="font-size: 10px; opacity: 0.7;">(${hrPct}%)</span></span>
      </td>
      <td style="padding: 10px 14px; text-align: right; font-weight: 700; color: ${rateColor}; font-size: 13px;">
        ${w.botRate}% <span style="font-size: 11px; color: ${trendColor};">${trend}</span>
      </td>
    </tr>`;
  }).join("");

  const weeklySectionHtml = weekGroups.length >= 2 ? `
  <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8; margin: 40px 0 16px;">Week-by-week — volume and AI performance</div>
  <div style="background: white; border-radius: 14px; border: 1px solid #e5e9f0; box-shadow: 0 2px 8px rgba(30,58,95,0.07); padding: 24px; margin-bottom: 20px;">
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px;">
      <div>
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8; margin-bottom: 14px;">Weekly Volume — AI vs Human</div>
        <canvas id="wkBar" height="200"></canvas>
      </div>
      <div>
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8; margin-bottom: 14px;">AI Resolution Rate % — Week by Week</div>
        <canvas id="wkLine" height="200"></canvas>
      </div>
    </div>
  </div>` : "";

  const weeklyScriptHtml = weekGroups.length >= 2 ? `
  new Chart(document.getElementById('wkBar'), {
    type: 'bar',
    data: {
      labels: ${wkLabels},
      datasets: [
        { label: 'AI Resolved', data: ${wkBot}, backgroundColor: '#22c55e', stack: 'a' },
        { label: 'Human Handled', data: ${wkHuman}, backgroundColor: '#ef4444', stack: 'a', borderRadius: { topLeft: 4, topRight: 4 } }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 10 } } }, y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } } } }
  });
  new Chart(document.getElementById('wkLine'), {
    type: 'line',
    data: {
      labels: ${wkLabels},
      datasets: [{
        label: 'AI Rate %',
        data: ${wkRate},
        borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.08)',
        fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: '#22c55e',
        pointBorderColor: '#fff', pointBorderWidth: 2, borderWidth: 2.5
      }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 10 } } }, y: { min: 0, max: 100, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, callback: v => v + '%' } } } }
  });` : "";

  const weekTableHtml = weekGroups.length > 0 ? `
  <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8; margin: 40px 0 16px;">Week-by-week performance</div>
  <div style="background: white; border-radius: 14px; border: 1px solid #e5e9f0; box-shadow: 0 2px 8px rgba(30,58,95,0.07); overflow: hidden; margin-bottom: 20px;">
    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
      <thead>
        <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
          <th style="padding: 10px 14px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8;">Week</th>
          <th style="padding: 10px 14px; text-align: right; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8;">Total</th>
          <th style="padding: 10px 14px; text-align: right; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8;">AI Resolved</th>
          <th style="padding: 10px 14px; text-align: right; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8;">Human Handled</th>
          <th style="padding: 10px 14px; text-align: right; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8;">Human Resolved</th>
          <th style="padding: 10px 14px; text-align: right; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8;">AI Rate</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${clientName} — AI Performance Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f5f7fa; color: #1a2332; }
    .page { max-width: 1100px; margin: 0 auto; padding: 0 32px 80px; }
    .card { background: white; border-radius: 14px; border: 1px solid #e5e9f0; box-shadow: 0 2px 8px rgba(30,58,95,0.07); padding: 24px; }
    @media print { body { background: white; } }
    canvas { max-width: 100%; }
  </style>
</head>
<body>

<!-- HEADER -->
<div style="background: linear-gradient(135deg, #1e3a5f 0%, #0f2540 100%); padding: 32px;">
  <div style="max-width: 1100px; margin: 0 auto; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
    <div>
      <div style="font-size: 10px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: #60a5fa; margin-bottom: 8px;">AI Performance Report</div>
      <h1 style="font-size: 26px; font-weight: 800; color: white; margin-bottom: 6px;">${clientName}</h1>
      <p style="font-size: 13px; color: #94a3b8;">${subtitle}</p>
    </div>
    <div style="text-align: right;">
      <div style="background: rgba(255,255,255,0.1); border-radius: 10px; padding: 12px 20px; display: inline-block; margin-bottom: 8px;">
        <div style="font-size: 10px; color: #94a3b8; margin-bottom: 4px; text-transform: uppercase; letter-spacing: .8px;">Period</div>
        <div style="font-size: 15px; font-weight: 700; color: white;">${rangeLabel}</div>
      </div>
      <div style="font-size: 11px; color: #64748b;">Generated ${now} &middot; desk.freedomwithai.com</div>
    </div>
  </div>
</div>

<div class="page">

  <!-- KPI STRIP -->
  <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8; margin: 40px 0 16px;">Key numbers &mdash; ${rangeLabel}</div>
  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 8px;">
    <div class="card" style="text-align: center; border-top: 3px solid #1e3a5f;">
      <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8; margin-bottom: 10px;">Total Conversations</div>
      <div style="font-size: 34px; font-weight: 800; color: #1e3a5f; line-height: 1;">${at.total.toLocaleString()}</div>
      <div style="font-size: 11px; color: #64748b; margin-top: 6px;">${at.startDate} &ndash; ${at.endDate}</div>
    </div>
    <div class="card" style="text-align: center; border-top: 3px solid #22c55e;">
      <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8; margin-bottom: 10px;">AI Auto-Resolved</div>
      <div style="font-size: 34px; font-weight: 800; color: #22c55e; line-height: 1;">${at.botResolvedPct}%</div>
      <div style="font-size: 11px; color: #64748b; margin-top: 6px;">${at.botResolved.toLocaleString()} conversations</div>
    </div>
    <div class="card" style="text-align: center; border-top: 3px solid #f59e0b;">
      <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8; margin-bottom: 10px;">Hours Saved</div>
      <div style="font-size: 34px; font-weight: 800; color: #f59e0b; line-height: 1;">~${at.hoursSaved}</div>
      <div style="font-size: 11px; color: #64748b; margin-top: 6px;">&asymp; ${at.workingDaysSaved} working days</div>
    </div>
    <div class="card" style="text-align: center; border-top: 3px solid #ef4444;">
      <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8; margin-bottom: 10px;">Human Handled</div>
      <div style="font-size: 34px; font-weight: 800; color: #ef4444; line-height: 1;">${at.escalatedPct}%</div>
      <div style="font-size: 11px; color: #64748b; margin-top: 6px;">${at.escalated.toLocaleString()} conversations</div>
    </div>
  </div>
  ${bestWeek ? `<div style="font-size: 11px; color: #64748b; text-align: right; margin-bottom: 0;">Best week: <strong style="color: #1e3a5f;">${bestWeek.label}</strong> &mdash; ${bestWeek.botRate}% AI rate</div>` : ""}

  <!-- DONUT + TIME SAVED -->
  <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8; margin: 40px 0 16px;">How every customer query was handled</div>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 4px;">
    <!-- Donut card -->
    <div class="card" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px;">
      <div style="font-size: 13px; font-weight: 600; color: #1e3a5f; align-self: flex-start;">Overall Query Split</div>
      <canvas id="donutChart" width="220" height="220"></canvas>
      <div style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center;">
        <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #475569;">
          <span style="width: 12px; height: 12px; background: #22c55e; border-radius: 3px; flex-shrink: 0; display: inline-block;"></span>
          AI Resolved &mdash; ${at.botResolvedPct}% (${at.botResolved.toLocaleString()})
        </div>
        <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #475569;">
          <span style="width: 12px; height: 12px; background: #ef4444; border-radius: 3px; flex-shrink: 0; display: inline-block;"></span>
          Human Handled &mdash; ${at.escalatedPct}% (${at.escalated.toLocaleString()})
        </div>
      </div>
    </div>
    <!-- Time saved card -->
    <div class="card">
      <div style="font-size: 13px; font-weight: 600; color: #1e3a5f; margin-bottom: 20px;">Time Saved for Your Team</div>
      <div style="background: linear-gradient(135deg, #fef3c7, #fffbeb); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 20px;">
        <div style="font-size: 52px; font-weight: 800; color: #d97706; line-height: 1;">~${at.hoursSaved}</div>
        <div style="font-size: 14px; color: #92400e; font-weight: 700; margin-top: 4px;">hours saved</div>
        <div style="font-size: 11px; color: #b45309; margin-top: 4px;">&asymp; ${at.workingDaysSaved} full working days (8h/day)</div>
      </div>
      <div style="font-size: 12px; color: #64748b; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9;">
          <span>AI-handled conversations</span>
          <strong style="color: #1e3a5f;">${at.botResolved.toLocaleString()}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9;">
          <span>Avg handling time / query</span>
          <strong style="color: #1e3a5f;">${at.avgHandlingTimeMinutes} min</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Total time saved</span>
          <strong style="color: #1e3a5f;">${at.minutesSaved.toLocaleString()} min &asymp; ~${at.hoursSaved} hrs</strong>
        </div>
      </div>
    </div>
  </div>

  ${weeklySectionHtml}

  <!-- AI VS TEAM -->
  <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8; margin: 40px 0 16px;">How AI and your team work together</div>
  <div class="card">
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; text-align: center;">
      <div style="padding: 16px; border-right: 1px solid #f1f5f9;">
        <div style="font-size: 30px; font-weight: 800; color: #1e3a5f;">${at.total.toLocaleString()}</div>
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8; margin-top: 6px;">Total Queries</div>
      </div>
      <div style="padding: 16px; border-right: 1px solid #f1f5f9;">
        <div style="font-size: 30px; font-weight: 800; color: #22c55e;">${at.botResolved.toLocaleString()}</div>
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8; margin-top: 6px;">AI Resolved</div>
        <div style="font-size: 11px; color: #22c55e; font-weight: 600; margin-top: 4px;">No human needed</div>
      </div>
      <div style="padding: 16px; border-right: 1px solid #f1f5f9;">
        <div style="font-size: 30px; font-weight: 800; color: #f59e0b;">${at.escalated.toLocaleString()}</div>
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8; margin-top: 6px;">Escalated to Team</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">${at.humanResolved.toLocaleString()} resolved</div>
      </div>
      <div style="padding: 16px;">
        <div style="font-size: 30px; font-weight: 800; color: #ef4444;">${at.open.toLocaleString()}</div>
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8; margin-top: 6px;">Still Open</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Awaiting response</div>
      </div>
    </div>
  </div>

  ${weekTableHtml}

  <!-- FOOTER -->
  <div style="text-align: center; font-size: 11px; color: #94a3b8; padding: 24px 0 40px; border-top: 1px solid #e5e9f0; margin-top: 40px;">
    ${clientName} AI Performance Report &middot; desk.freedomwithai.com &middot; Prepared by FWAI &middot; ${now}
  </div>

</div>

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
<script>
  Chart.defaults.font.family = "'Segoe UI', system-ui, sans-serif";

  new Chart(document.getElementById('donutChart'), {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [${at.botResolvedPct}, ${at.escalatedPct}, ${Math.max(0, parseFloat((100 - at.botResolvedPct - at.escalatedPct).toFixed(1)))}],
        backgroundColor: ['#22c55e', '#ef4444', '#f1f5f9'],
        borderWidth: 3, borderColor: '#fff'
      }]
    },
    options: {
      responsive: false, cutout: '65%',
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }
  });

  ${weeklyScriptHtml}
</script>
</body>
</html>`;
}

export function downloadReport(html: string, clientName: string, rangeLabel: string) {
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
