"use client";

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import clientsConfig from "@/config/clients.json";
import type { DailyData } from "@/lib/types";
import {
  filterByDateRange,
  computeAllTimeMetrics,
  computeWeeklyMetrics,
  formatDisplayDate,
  addDays,
  startOfMonth,
  groupByWeek,
} from "@/lib/metrics";
import Header, { DatePreset } from "@/components/Header";
import { generateHTMLReport, downloadReport } from "@/lib/generateReport";
import ReportHero from "@/components/ReportHero";
import KpiStrip from "@/components/KpiStrip";
import DonutCard from "@/components/DonutCard";
import TimeSavedCard from "@/components/TimeSavedCard";
import ImpactBoxes from "@/components/ImpactBoxes";
import WeeklyPerfTable from "@/components/WeeklyPerfTable";
import HoursSavedBand from "@/components/HoursSavedBand";
import AiVsTeam from "@/components/AiVsTeam";
import ChannelBreakdown from "@/components/ChannelBreakdown";
import ConversationLog from "@/components/ConversationLog";

const WeeklyCharts = dynamic(() => import("@/components/WeeklyCharts"), { ssr: false });
const ActivityHeatmap = dynamic(() => import("@/components/ActivityHeatmap"), { ssr: false });

interface ChannelDailyData {
  name: string;
  icon: string;
  inboxId: number;
  dailyData: DailyData[];
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
      letterSpacing: ".8px", color: "#94a3b8", margin: "44px 0 18px",
    }}>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const [selectedClientId, setSelectedClientId] = useState("gonature");
  const [datePreset, setDatePreset] = useState<DatePreset>("all-time");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [allDailyData, setAllDailyData] = useState<DailyData[]>([]);
  const [dataStartDate, setDataStartDate] = useState("");
  const [dataEndDate, setDataEndDate] = useState("");
  const [heatmap, setHeatmap] = useState<number[][]>([]);
  const [channelDailyData, setChannelDailyData] = useState<ChannelDailyData[]>([]);
  const [escalationReady, setEscalationReady] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const config = clientsConfig.find((c) => c.id === selectedClientId)!;

  useEffect(() => {
    let cancelled = false;
    const fetchData = (showSpinner = false) => {
      if (showSpinner) { setIsLoading(true); setAllDailyData([]); setHeatmap([]); setChannelDailyData([]); setEscalationReady(true); }
      setError("");
      fetch(`/api/metrics?clientId=${selectedClientId}`)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          if (data.error) { setError(data.error); return; }
          setAllDailyData(data.dailyData ?? []);
          setDataStartDate(data.startDate ?? "");
          setDataEndDate(data.endDate ?? new Date().toISOString().split("T")[0]);
          setHeatmap(data.heatmap ?? []);
          setChannelDailyData(data.channelDailyData ?? []);
          setEscalationReady(data.escalationReady ?? true);
        })
        .catch((e: Error) => { if (!cancelled) setError(e.message); })
        .finally(() => { if (!cancelled) setIsLoading(false); });
    };
    fetchData(true);
    const interval = setInterval(() => fetchData(false), 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [selectedClientId]);

  const handleClientChange = (id: string) => {
    setSelectedClientId(id);
    setDatePreset("all-time");
    setCustomFrom("");
    setCustomTo("");
  };

  const today = new Date().toISOString().split("T")[0];

  const effectiveRange = useMemo(() => {
    const start = dataStartDate || today;
    const end = dataEndDate || today;
    switch (datePreset) {
      case "all-time": return { from: start, to: today };
      case "this-month": return { from: startOfMonth(today), to: today };
      case "last-30": return { from: addDays(today, -29), to: today };
      case "last-7": return { from: addDays(today, -6), to: today };
      case "custom": return {
        from: customFrom && customFrom >= start ? customFrom : start,
        to: customTo && customTo <= end ? customTo : end,
      };
    }
  }, [dataStartDate, dataEndDate, datePreset, customFrom, customTo, today]);

  const filteredData = useMemo(
    () => filterByDateRange(allDailyData, effectiveRange.from, effectiveRange.to),
    [allDailyData, effectiveRange]
  );

  const atBase = useMemo(
    () => computeAllTimeMetrics(filteredData, config.avgHandlingTimeMinutes),
    [filteredData, config.avgHandlingTimeMinutes]
  );
  const at = useMemo(() => ({
    ...atBase,
    startDate: filteredData.length > 0 ? formatDisplayDate(filteredData[0].date) : "",
    endDate: filteredData.length > 0 ? formatDisplayDate(filteredData[filteredData.length - 1].date) : "",
  }), [atBase, filteredData]);

  const weekGroups = useMemo(() => groupByWeek(filteredData), [filteredData]);

  const bestWeek = useMemo(() => {
    if (!weekGroups.length) return { botRate: 0, label: "" };
    return weekGroups.reduce((best, w) => (w.botRate > best.botRate ? w : best), weekGroups[0]);
  }, [weekGroups]);

  const rangeLabel = `${at.startDate} – ${at.endDate}`;

  // Whether this client has multi-channel config
  const hasChannels = channelDailyData.length > 0;

  const handleDownload = () => {
    const weeklyData = filteredData.slice(-7);
    const wkBase = computeWeeklyMetrics(weeklyData, config.avgHandlingTimeMinutes);
    const wk = {
      ...wkBase,
      startDate: weeklyData.length > 0 ? formatDisplayDate(weeklyData[0].date) : "",
      endDate: weeklyData.length > 0 ? formatDisplayDate(weeklyData[weeklyData.length - 1].date) : "",
    };
    const html = generateHTMLReport(config.name, config.subtitle, at, wk, rangeLabel, `${wk.startDate} – ${wk.endDate}`);
    downloadReport(html, config.name, rangeLabel);
  };

  return (
    <div className="min-h-screen" style={{ background: "#f5f7fa", color: "#1a2332", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <Header
        clients={clientsConfig.map((c) => ({ id: c.id, name: c.name }))}
        selectedClientId={selectedClientId}
        onClientChange={handleClientChange}
        clientName={config.name}
        clientSubtitle={config.subtitle}
        activePreset={datePreset}
        onPresetChange={setDatePreset}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFromChange={setCustomFrom}
        onCustomToChange={setCustomTo}
        minDate={dataStartDate || today}
        maxDate={today}
        allTimeLabel={rangeLabel}
        allTimeCount={at.total}
        weeklyLabel=""
        weeklyCount={0}
        onDownload={handleDownload}
      />

      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 32px 80px" }}>
        {/* Loading */}
        {isLoading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "96px 0" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: 40, height: 40, border: "4px solid #1e3a5f", borderTopColor: "transparent",
                borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto",
              }} />
              <p style={{ color: "#94a3b8", fontSize: "14px", marginTop: "12px" }}>Fetching live data from Chatwoot…</p>
            </div>
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "12px",
            padding: "20px 24px", color: "#dc2626", marginTop: "24px",
          }}>
            <p style={{ fontWeight: 600 }}>Failed to load data</p>
            <p style={{ fontSize: "13px", marginTop: "4px" }}>{error}</p>
          </div>
        )}

        {/* Escalation loading banner */}
        {!isLoading && !error && !escalationReady && (
          <div style={{
            background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px",
            padding: "12px 18px", marginTop: "20px", fontSize: "12.5px", color: "#92400e",
            display: "flex", alignItems: "center", gap: "10px",
          }}>
            <div style={{
              width: 14, height: 14, border: "2px solid #d97706", borderTopColor: "transparent",
              borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0,
            }} />
            <span>
              <strong>Escalation data is loading in the background.</strong>{" "}
              Bot vs. human split will appear on the next auto-refresh (within 60s).
              Total conversation counts are accurate.
            </span>
          </div>
        )}

        {/* Dashboard */}
        {!isLoading && !error && (
          <>
            {/* Report Hero */}
            <ReportHero
              clientName={config.name}
              subtitle={config.subtitle}
              startDate={at.startDate}
              endDate={at.endDate}
              total={at.total}
              botRate={at.botResolvedPct}
            />

            {/* KPI Strip */}
            <SectionLabel>Key numbers — {rangeLabel}</SectionLabel>
            <KpiStrip
              total={at.total}
              botResolved={at.botResolved}
              botResolvedPct={at.botResolvedPct}
              hoursSaved={at.hoursSaved}
              workingDaysSaved={at.workingDaysSaved}
              bestWeekRate={bestWeek.botRate}
              bestWeekLabel={bestWeek.label}
            />

            {/* Donut + Time Saved */}
            <SectionLabel>How every customer query was handled</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
              <DonutCard
                bot={at.botResolved}
                human={at.escalated}
                total={at.total}
                botResolvedPct={at.botResolvedPct}
              />
              <TimeSavedCard
                hoursSaved={at.hoursSaved}
                workingDaysSaved={at.workingDaysSaved}
                botResolved={at.botResolved}
                avgHandlingTimeMinutes={at.avgHandlingTimeMinutes}
                totalDays={filteredData.length}
              />
            </div>

            {/* Channel Breakdown (only for multi-channel clients) */}
            {hasChannels && (
              <>
                <SectionLabel>Performance by channel</SectionLabel>
                <ChannelBreakdown
                  channels={channelDailyData}
                  from={effectiveRange.from}
                  to={effectiveRange.to}
                  avgHandlingTimeMinutes={config.avgHandlingTimeMinutes}
                />
              </>
            )}

            {/* Weekly Charts (only if we have enough weeks) */}
            {weekGroups.length >= 2 && (
              <>
                <SectionLabel>Week-by-week — volume and AI performance</SectionLabel>
                <WeeklyCharts weekGroups={weekGroups} />
              </>
            )}

            {/* Impact Boxes */}
            <SectionLabel>What this means for the business</SectionLabel>
            <ImpactBoxes
              botResolved={at.botResolved}
              hoursSaved={at.hoursSaved}
              botRateTrend={at.botRateTrend}
            />

            {/* AI vs Team */}
            <SectionLabel>How AI and your team work together</SectionLabel>
            <AiVsTeam
              botResolved={at.botResolved}
              human={at.escalated}
              humanResolved={at.humanResolved}
              open={at.open}
            />

            {/* Weekly Performance Table */}
            {weekGroups.length > 0 && (
              <>
                <SectionLabel>Week-by-week: AI vs Team effort — and how performance grew</SectionLabel>
                <div style={{
                  background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px",
                  padding: "14px 18px", marginBottom: "12px", fontSize: "12px", color: "#475569", lineHeight: 1.7,
                }}>
                  <strong style={{ color: "#1e3a5f" }}>How performance improved:</strong> Each week, when the team answered an escalated query, that answer was added to the AI knowledge base. Next week, the bot handled the same question on its own — no human needed. This is why bot rate improves over time.
                </div>
                <WeeklyPerfTable
                  weekGroups={weekGroups}
                  avgHandlingTimeMinutes={config.avgHandlingTimeMinutes}
                />
              </>
            )}

            {/* Hours Saved Band */}
            <SectionLabel>Time saved for your team</SectionLabel>
            <HoursSavedBand
              hoursSaved={at.hoursSaved}
              botResolved={at.botResolved}
              avgHandlingTimeMinutes={at.avgHandlingTimeMinutes}
              workingDaysSaved={at.workingDaysSaved}
            />

            {/* Activity Heatmap (all clients) */}
            {heatmap.length > 0 && (
              <>
                <SectionLabel>When your customers reach out</SectionLabel>
                <ActivityHeatmap heatmap={heatmap} />
              </>
            )}

            {/* Conversation Validation Log */}
            <SectionLabel>Validate: real conversations from Chatwoot</SectionLabel>
            <div style={{
              background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px",
              padding: "10px 16px", marginBottom: "16px", fontSize: "12px", color: "#92400e",
            }}>
              This table fetches real conversations from Chatwoot and classifies them as AI-resolved vs human-handled.
              Use it to verify the accuracy of the metrics above. Conversations marked <strong>Needs review</strong> have a human assignee but no escalation label — check these manually.
            </div>
            <ConversationLog clientId={selectedClientId} />
          </>
        )}
      {/* Footer */}
      <div style={{
        textAlign: "center", fontSize: "11px", color: "#94a3b8",
        padding: "20px 24px 40px", borderTop: "1px solid #e5e9f0", marginTop: "20px",
      }}>
        {config.name} Chatbot Performance Report · desk.freedomwithai.com · Auto-refreshes every 60s · Prepared by FWAI
      </div>

      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 700px) {
          .two-col { grid-template-columns: 1fr !important; }
          .three-col { grid-template-columns: 1fr !important; }
          .four-col { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
