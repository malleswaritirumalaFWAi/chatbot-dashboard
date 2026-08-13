"use client";

import { AllTimeMetrics } from "@/lib/types";

function JourneyCard({
  value,
  label,
  borderColor,
  valueColor,
}: {
  value: string;
  label: string;
  borderColor: string;
  valueColor: string;
}) {
  return (
    <div className={`border-2 ${borderColor} rounded-xl px-5 py-4 flex-1 min-w-0 text-center`}>
      <p className={`text-2xl font-bold ${valueColor} mb-1`}>{value}</p>
      <p className="text-[11px] font-semibold tracking-widest text-gray-500 uppercase">{label}</p>
    </div>
  );
}

function Arrow() {
  return <span className="text-gray-400 text-xl font-light shrink-0">→</span>;
}

function Badge({ value, color }: { value: string; color: string }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold text-white ${color}`}>
      {value}
    </span>
  );
}

function TableRow({ label, bot, human }: { label: string; bot: React.ReactNode; human: React.ReactNode }) {
  return (
    <tr className="border-t border-gray-100">
      <td className="py-3 text-sm text-gray-600">{label}</td>
      <td className="py-3 text-center">{bot}</td>
      <td className="py-3 text-center">{human}</td>
    </tr>
  );
}

function CalcRow({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <tr className="border-t border-gray-100">
      <td className={`py-3 text-sm ${bold ? "font-semibold text-gray-800" : "text-gray-600"}`}>{label}</td>
      <td className="py-3 text-right">{value}</td>
    </tr>
  );
}

interface Props {
  metrics: AllTimeMetrics;
  label: string;
}

export default function ResolutionFlow({ metrics, label }: Props) {
  const { total, botResolved, escalated, humanResolved, hoursSaved, botHandled, minutesSaved, workingDaysSaved, open, avgHandlingTimeMinutes } = metrics;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
      {/* Journey cards */}
      <div>
        <p className="text-[11px] font-semibold tracking-widest text-gray-400 uppercase mb-4">
          Journey of a Query — {label}
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <JourneyCard value={total.toLocaleString()} label="Total Queries" borderColor="border-gray-200" valueColor="text-gray-800" />
          <Arrow />
          <JourneyCard value={botResolved.toLocaleString()} label="Bot Resolved ✅" borderColor="border-green-400" valueColor="text-green-500" />
          <Arrow />
          <JourneyCard value={escalated.toLocaleString()} label="Escalated to Human" borderColor="border-purple-400" valueColor="text-purple-500" />
          <Arrow />
          <JourneyCard value={humanResolved.toLocaleString()} label="Human Resolved ✅" borderColor="border-blue-400" valueColor="text-blue-500" />
          <Arrow />
          <JourneyCard value={`~${hoursSaved} hrs`} label="Team Time Saved" borderColor="border-amber-400" valueColor="text-amber-500" />
        </div>
      </div>

      {/* Two tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bot vs Human Performance */}
        <div>
          <p className="text-[11px] font-semibold tracking-widest text-gray-400 uppercase mb-3">
            Bot vs Human Performance
          </p>
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-[11px] font-semibold tracking-widest text-gray-400 uppercase py-2">Metric</th>
                <th className="text-center text-[11px] font-semibold tracking-widest text-gray-400 uppercase py-2">Bot</th>
                <th className="text-center text-[11px] font-semibold tracking-widest text-gray-400 uppercase py-2">Human</th>
              </tr>
            </thead>
            <tbody>
              <TableRow
                label="Queries handled"
                bot={<Badge value={botHandled.toLocaleString()} color="bg-green-500" />}
                human={<Badge value={escalated.toLocaleString()} color="bg-blue-500" />}
              />
              <TableRow
                label="Resolved"
                bot={<Badge value={botResolved.toLocaleString()} color="bg-green-500" />}
                human={<Badge value={humanResolved.toLocaleString()} color="bg-blue-500" />}
              />
              <TableRow
                label="Resolution rate"
                bot={<Badge value={`${((botResolved / botHandled) * 100).toFixed(1)}%`} color="bg-green-500" />}
                human={<Badge value={`${((humanResolved / escalated) * 100).toFixed(1)}%`} color="bg-green-500" />}
              />
              <TableRow
                label="Response speed"
                bot={<Badge value="~10s auto" color="bg-blue-400" />}
                human={<Badge value="Manual" color="bg-amber-400" />}
              />
              <TableRow
                label="Still open"
                bot={<Badge value="0" color="bg-gray-400" />}
                human={<Badge value={`~${open}`} color="bg-red-400" />}
              />
            </tbody>
          </table>
        </div>

        {/* Hours Saved Calculation */}
        <div>
          <p className="text-[11px] font-semibold tracking-widest text-gray-400 uppercase mb-3">
            ⏱ Hours Saved Calculation
          </p>
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-[11px] font-semibold tracking-widest text-gray-400 uppercase py-2">Component</th>
                <th className="text-right text-[11px] font-semibold tracking-widest text-gray-400 uppercase py-2">Value</th>
              </tr>
            </thead>
            <tbody>
              <CalcRow label="Bot-handled queries" value={<Badge value={botHandled.toLocaleString()} color="bg-green-500" />} />
              <CalcRow label="Avg handling time / query" value={<Badge value={`${avgHandlingTimeMinutes} minutes`} color="bg-blue-500" />} />
              <CalcRow label="Total minutes saved" value={<Badge value={`${minutesSaved.toLocaleString()} min`} color="bg-amber-400" />} />
              <CalcRow label="Hours saved" bold value={<Badge value={`~${hoursSaved} hours`} color="bg-green-500" />} />
              <CalcRow label="Working days saved (8hr)" value={<Badge value={`~${workingDaysSaved} days`} color="bg-green-500" />} />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
