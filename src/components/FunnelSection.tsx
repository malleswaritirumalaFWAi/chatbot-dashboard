"use client";

interface FunnelRow {
  icon: string;
  label: string;
  text: string;
  pct: number;
  count: number | string;
  color: string;
  textColor?: string;
  countColor?: string;
  minWidth?: boolean;
}

interface Props {
  title: string;
  subtitle: string;
  rows: FunnelRow[];
}

function FunnelBar({ icon, label, text, pct, count, color, textColor = "text-white", countColor = "text-gray-700", minWidth = false }: FunnelRow) {
  const isSmall = pct < 5;

  return (
    <div className="flex items-center gap-4 py-1.5">
      <div className="w-36 text-right text-sm font-medium text-gray-600 flex items-center justify-end gap-1.5 shrink-0">
        <span className="text-base">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="flex-1 relative h-11 bg-gray-100 rounded-lg overflow-hidden">
        <div
          className="h-full flex items-center justify-between px-3 rounded-lg transition-all duration-500"
          style={{
            width: `${Math.max(pct, isSmall ? 3 : 0)}%`,
            backgroundColor: color,
            minWidth: isSmall ? "3rem" : undefined,
          }}
        >
          {!isSmall && (
            <>
              <span className={`font-medium text-sm ${textColor} truncate`}>{text}</span>
              <span className={`font-bold text-sm ${textColor} shrink-0 ml-2`}>{pct.toFixed(1)}%</span>
            </>
          )}
        </div>
      </div>
      <div className={`w-14 text-right text-sm font-semibold shrink-0 ${countColor}`}>
        {typeof count === "number" ? (count > 100 ? count.toLocaleString() : `~${count}`) : count}
      </div>
    </div>
  );
}

export default function FunnelSection({ title, subtitle, rows }: Props) {
  return (
    <div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-6 pt-5 pb-2">
          <p className="text-[11px] font-semibold tracking-widest text-gray-400 uppercase mb-4">{subtitle}</p>
          <div className="space-y-1">
            {rows.map((row, i) => (
              <FunnelBar key={i} {...row} />
            ))}
          </div>
        </div>
        <div className="h-4" />
      </div>
    </div>
  );
}
