"use client";

interface Props {
  icon: string;
  title: string;
  subtitle: string;
}

export default function DarkBanner({ icon, title, subtitle }: Props) {
  return (
    <div className="bg-[#0d1b2e] rounded-xl px-6 py-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{icon}</span>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
      </div>
      <p className="text-gray-400 text-sm">{subtitle}</p>
    </div>
  );
}
