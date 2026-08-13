import { DailyData } from "./types";

// Seeded PRNG — deterministic on server and client
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
}

export function generateDailyData(
  startDate: string,
  endDate: string,
  seed: number,
  avgDailyVolume: number,
  startBotRate: number, // 0-100
  endBotRate: number,   // 0-100
  humanResolveRate = 0.97
): DailyData[] {
  const rng = seededRng(seed);
  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  const totalDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const result: DailyData[] = [];

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    const progress = totalDays > 1 ? i / (totalDays - 1) : 1;
    const botRate = startBotRate + (endBotRate - startBotRate) * progress;
    const dow = d.getUTCDay();
    const dowFactor = dow === 0 || dow === 6 ? 0.5 : 1.0;
    const variance = 0.55 + rng() * 0.9;
    const total = Math.max(1, Math.round(avgDailyVolume * dowFactor * variance));
    const bot = Math.round(total * (botRate / 100));
    const human = total - bot;
    const humanResolved = Math.round(human * humanResolveRate);
    const open = Math.max(0, human - humanResolved);
    const dateStr = d.toISOString().split("T")[0];
    const label = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });

    result.push({
      date: dateStr,
      label,
      total,
      bot,
      human,
      humanResolved,
      open,
      botRate: total > 0 ? Math.round((bot / total) * 1000) / 10 : 0,
    });
  }

  return result;
}
