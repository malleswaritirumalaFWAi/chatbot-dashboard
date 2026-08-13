"use client";

interface Props {
  icon: string;
  title: string;
}

export default function SectionHeader({ icon, title }: Props) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-1 h-6 bg-purple-600 rounded-full shrink-0" />
      <span className="text-lg leading-none">{icon}</span>
      <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
    </div>
  );
}
