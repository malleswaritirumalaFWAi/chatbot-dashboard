import { DailyData } from "./types";
import { generateDailyData } from "./dataGen";

export interface ClientConfig {
  id: string;
  name: string;
  subtitle: string;
  avgHandlingTimeMinutes: number;
  startDate: string;
  endDate: string;
  allDailyData: DailyData[];
}

// Use today's date so relative presets (Last 7 Days, This Month, etc.) always reflect real time
const TODAY = new Date().toISOString().split("T")[0]; // e.g. "2026-07-31"

export const CLIENT_CONFIGS: ClientConfig[] = [
  {
    id: "eph",
    name: "Easy Parenting Hub",
    subtitle: "AI Chatbot Impact & Hours Saved",
    avgHandlingTimeMinutes: 5,
    startDate: "2026-05-07",
    endDate: TODAY,
    allDailyData: generateDailyData("2026-05-07", TODAY, 42, 45, 38, 78, 0.999),
  },
  {
    id: "gonature",
    name: "Go Nature",
    subtitle: "AI Chatbot Impact & Hours Saved",
    avgHandlingTimeMinutes: 5,
    startDate: "2026-01-15",
    endDate: TODAY,
    allDailyData: generateDailyData("2026-01-15", TODAY, 43, 15, 52, 85, 0.95),
  },
  {
    id: "dipti",
    name: "Dipti Vartak Academy",
    subtitle: "AI Chatbot Impact & Hours Saved",
    avgHandlingTimeMinutes: 7,
    startDate: "2026-03-01",
    endDate: TODAY,
    allDailyData: generateDailyData("2026-03-01", TODAY, 44, 35, 48, 75, 0.92),
  },
  {
    id: "badrinath",
    name: "Coach Badrinath",
    subtitle: "AI Chatbot Impact & Hours Saved",
    avgHandlingTimeMinutes: 6,
    startDate: "2026-04-01",
    endDate: TODAY,
    allDailyData: generateDailyData("2026-04-01", TODAY, 45, 20, 55, 80, 0.92),
  },
];
