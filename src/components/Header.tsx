"use client";

import { RefreshCw, Download } from "lucide-react";

export type DatePreset = "all-time" | "this-month" | "last-30" | "last-7" | "custom";

interface ClientOption {
  id: string;
  name: string;
}

interface Props {
  clients: ClientOption[];
  selectedClientId: string;
  onClientChange: (id: string) => void;
  clientName: string;
  clientSubtitle: string;
  activePreset: DatePreset;
  onPresetChange: (p: DatePreset) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (v: string) => void;
  onCustomToChange: (v: string) => void;
  minDate: string;
  maxDate: string;
  allTimeLabel: string;
  allTimeCount: number;
  weeklyLabel: string;
  weeklyCount: number;
  onDownload: () => void;
}

const PRESETS: { label: string; value: DatePreset }[] = [
  { label: "All Time", value: "all-time" },
  { label: "This Month", value: "this-month" },
  { label: "Last 30 Days", value: "last-30" },
  { label: "Last 7 Days", value: "last-7" },
  { label: "Custom Range", value: "custom" },
];

export default function Header({
  clients,
  selectedClientId,
  onClientChange,
  clientName,
  clientSubtitle,
  activePreset,
  onPresetChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  minDate,
  maxDate,
  allTimeLabel,
  allTimeCount,
  weeklyLabel,
  weeklyCount,
  onDownload,
}: Props) {
  return (
    <div className="bg-[#0d1b2e] px-8 py-6">
      <div className="max-w-[1200px] mx-auto space-y-4">
        {/* Row 1: Title + client selector */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">
              {clientName} — Chatbot Impact Report
            </h1>
            <p className="text-gray-400 text-sm">{clientSubtitle}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs font-medium">Client</label>
              <select
                value={selectedClientId}
                onChange={(e) => onClientChange(e.target.value)}
                className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[200px]"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#0d1b2e] text-white">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="mt-5 flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg px-3 py-2 text-sm transition-colors"
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={14} />
              Refresh
            </button>
            <button
              className="mt-5 flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              onClick={onDownload}
            >
              <Download size={14} />
              Download Report
            </button>
          </div>
        </div>

        {/* Row 2: Date range presets */}
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => onPresetChange(p.value)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activePreset === p.value
                  ? "bg-white text-[#0d1b2e] font-semibold"
                  : "bg-white/10 text-gray-300 hover:bg-white/20"
              }`}
            >
              {p.label}
            </button>
          ))}

          {/* Custom date inputs */}
          {activePreset === "custom" && (
            <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 ml-1">
              <span className="text-gray-400 text-xs font-medium">From</span>
              <input
                type="date"
                value={customFrom}
                min={minDate}
                max={customTo || maxDate}
                onChange={(e) => onCustomFromChange(e.target.value)}
                className="bg-transparent text-white text-sm border-none outline-none cursor-pointer"
                style={{ colorScheme: "dark" }}
              />
              <span className="text-gray-400 text-sm">→</span>
              <span className="text-gray-400 text-xs font-medium">To</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || minDate}
                max={maxDate}
                onChange={(e) => onCustomToChange(e.target.value)}
                className="bg-transparent text-white text-sm border-none outline-none cursor-pointer"
                style={{ colorScheme: "dark" }}
              />
            </div>
          )}
        </div>

        {/* Row 3: Active range summary pills */}
        <div className="flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-2 bg-white/10 text-gray-200 text-sm px-3 py-1.5 rounded-full">
            <span>📅</span>
            <span>Report: {allTimeLabel} · {allTimeCount.toLocaleString()} conversations</span>
          </span>
          <span className="inline-flex items-center gap-2 bg-white/10 text-gray-200 text-sm px-3 py-1.5 rounded-full">
            <span>📅</span>
            <span>Last 7 days: {weeklyLabel} · {weeklyCount.toLocaleString()} conversations</span>
          </span>
        </div>
      </div>
    </div>
  );
}
