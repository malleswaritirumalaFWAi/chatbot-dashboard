"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";
import { DailyData } from "@/lib/types";

const GREEN = "#22c55e";
const BLUE = "#3b82f6";
const GRAY = "#d1d5db";

interface Props {
  dailyData: DailyData[];
  weeklyTotal: number;
  botResolvedPct: number;
  humanHandledPct: number;
  unclassifiedPct: number;
  weekLabel: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

export default function DailyTrends({ dailyData, weeklyTotal, botResolvedPct, humanHandledPct, unclassifiedPct, weekLabel }: Props) {
  const lineData = dailyData.map((d) => ({ name: d.label, rate: d.botRate }));
  const maxBot = Math.max(...dailyData.map((d) => d.bot));

  const donutData = [
    { name: `Bot Resolved (${botResolvedPct}%)`, value: botResolvedPct, color: GREEN },
    { name: `Human Handled (${humanHandledPct}%)`, value: humanHandledPct, color: BLUE },
    { name: "Unclassified", value: unclassifiedPct, color: GRAY },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily stacked bar */}
        <div>
          <p className="text-[11px] font-semibold tracking-widest text-gray-400 uppercase mb-4">
            Daily Conversations (Bot vs Human)
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dailyData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="bot" name="Bot Resolved" stackId="a" fill={GREEN} />
              <Bar dataKey="human" name="Human Handled" stackId="a" fill={BLUE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Daily bot % line */}
        <div>
          <p className="text-[11px] font-semibold tracking-widest text-gray-400 uppercase mb-4">
            Bot Resolution Rate % (Daily)
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={lineData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="greenGradDaily" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GREEN} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={GREEN} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, "Bot Resolution %"]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="rate"
                name="Bot Resolution %"
                stroke={GREEN}
                strokeWidth={2.5}
                fill="url(#greenGradDaily)"
                dot={{ r: 4, fill: GREEN, strokeWidth: 2, stroke: "#fff" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly split donut */}
        <div>
          <p className="text-[11px] font-semibold tracking-widest text-gray-400 uppercase mb-4">
            Weekly Split (All {weeklyTotal.toLocaleString()} Conversations)
          </p>
          <div className="flex flex-col items-center">
            <PieChart width={220} height={190}>
              <Pie data={donutData} cx={110} cy={90} innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
                {donutData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {donutData.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: d.color }} />
                  {d.name}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Daily Volume Bars */}
        <div>
          <p className="text-[11px] font-semibold tracking-widest text-gray-400 uppercase mb-4">
            Daily Volume Bars
          </p>
          <div className="space-y-2">
            {dailyData.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-20 shrink-0 text-right">{d.label} (Bot)</span>
                <div className="flex-1 bg-gray-100 rounded h-7 overflow-hidden">
                  <div
                    className="h-full flex items-center px-2 rounded"
                    style={{
                      width: `${maxBot > 0 ? (d.bot / maxBot) * 100 : 0}%`,
                      backgroundColor: GREEN,
                      minWidth: d.bot > 0 ? "2rem" : "0",
                    }}
                  >
                    <span className="text-white text-xs font-semibold">{d.bot}</span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-gray-700 w-8 text-right shrink-0">{d.bot}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
