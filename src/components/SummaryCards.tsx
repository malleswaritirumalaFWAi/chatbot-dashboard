"use client";

interface Card {
  label: string;
  value: string;
  valueColor: string;
  sub: string;
}

interface Props {
  cards: Card[];
}

function MetricCard({ label, value, valueColor, sub }: Card) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex-1 min-w-0">
      <p className="text-[11px] font-semibold tracking-widest text-gray-400 uppercase mb-3">{label}</p>
      <p className={`text-3xl font-bold mb-1 ${valueColor}`}>{value}</p>
      <p className="text-xs text-gray-400">{sub}</p>
    </div>
  );
}

export default function SummaryCards({ cards }: Props) {
  return (
    <div className="flex gap-4 flex-wrap">
      {cards.map((card, i) => (
        <MetricCard key={i} {...card} />
      ))}
    </div>
  );
}
