// Central data adapter — imports from the ABM simulation data and normalizes for dashboard use
import {
  timeseriesData as rawTimeseries,
  vulnerabilityData as rawVulnerability,
  scenarioData as rawScenarios,
  aiComparisonData as rawAiComparison,
  calibrationData as rawCalibration,
} from "./simulationData";

// ── Timeseries (already arrays, just re-export) ──────────────────────────
export const timeseriesData = rawTimeseries;
export type TimeseriesKey = keyof typeof timeseriesData;

// ── Vulnerability (re-export as-is) ──────────────────────────────────────
export const vulnerabilityData = rawVulnerability;

// ── Scenarios (convert {"0": val, ...} indexed objects to arrays) ────────
type IndexedObj = Record<string, number>;
type ScenarioMetrics = Record<string, number[]>;

function indexedToArray(obj: IndexedObj): number[] {
  const keys = Object.keys(obj).map(Number).sort((a, b) => a - b);
  return keys.map((k) => obj[String(k)]);
}

function convertScenario(raw: Record<string, IndexedObj>): ScenarioMetrics {
  const result: ScenarioMetrics = {};
  for (const [metric, indexed] of Object.entries(raw)) {
    result[metric] = indexedToArray(indexed);
  }
  return result;
}

export const scenarioData: Record<string, ScenarioMetrics> = {};
for (const [key, value] of Object.entries(rawScenarios)) {
  scenarioData[key] = convertScenario(value as Record<string, IndexedObj>);
}

export const scenarioLabels: Record<string, string> = {
  india_export_ban: "India Export Ban",
  china_lockdown: "China Lockdown",
  hurricane_us: "US Hurricane",
  cyber_attack: "Cyber Attack",
  quality_crisis: "Quality Crisis",
};

export const scenarioColors: Record<string, string> = {
  india_export_ban: "#F59E0B",
  china_lockdown: "#EF4444",
  hurricane_us: "#3B82F6",
  cyber_attack: "#8B5CF6",
  quality_crisis: "#10B981",
};

// ── AI Comparison (arrays, re-export) ────────────────────────────────────
export const aiComparisonData = rawAiComparison;

// ── Calibration (re-export with type) ────────────────────────────────────
export const calibrationData = rawCalibration;

// ── Helpers ──────────────────────────────────────────────────────────────
export const TOTAL_WEEKS = timeseriesData.Total_Inventory.length; // 52

export const last = (arr: number[]) => arr[arr.length - 1];
export const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
export const pctChange = (arr: number[]) => {
  if (arr.length < 8) return 0;
  const recent = arr.slice(-4);
  const prev = arr.slice(-8, -4);
  const rAvg = avg(recent);
  const pAvg = avg(prev);
  return pAvg === 0 ? 0 : ((rAvg - pAvg) / pAvg) * 100;
};

/** Slice every metric in timeseriesData to [start, end) */
export function sliceTimeseries(start: number, end: number) {
  const result: Record<string, number[]> = {};
  for (const [key, arr] of Object.entries(timeseriesData)) {
    result[key] = (arr as number[]).slice(start, end);
  }
  return result;
}
