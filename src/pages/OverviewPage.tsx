import { useState, useMemo } from "react";
import { KpiCard } from "@/components/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity, AlertTriangle, Users, Thermometer, Brain, ShieldCheck,
  ArrowRight,
} from "lucide-react";
import {
  Area, AreaChart, Line, LineChart, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend,
} from "recharts";

import validationData from "@/data/validationReportData.json";

// ─── Types ──────────────────────────────────────────────────────
interface WeeklyPercentile {
  week: number;
  sl_p10: number;
  sl_p25: number;
  sl_p50: number;
  sl_p75: number;
  sl_p90: number;
  inv_p10: number;
  inv_p50: number;
  inv_p90: number;
}

interface ScenarioSummary {
  avgMinSL: number;
  avgAvgSL: number;
  avgTerminalSL: number;
  avgStockouts: number;
  avgRecovery: number;
  avgSpoilage: number;
  avgCompliance: number;
  avgPatientImpact: number;
  stdMinSL: number;
  p10MinSL: number;
  p90MinSL: number;
}

interface ScenarioConfig {
  summary: ScenarioSummary;
  weeklyPercentiles: WeeklyPercentile[];
}

const data = validationData as unknown as {
  metadata: {
    scenarios: string[];
    configs: string[];
    disruptionStart?: number;
    disruptionStarts?: Record<string, number>;
    totalRuns: number;
    nSeeds: number;
  };
  scenarios: Record<string, Record<string, ScenarioConfig>>;
  scorecard?: Array<{ name: string; pass: boolean; detail: string }>;
};

const scenarios = data.metadata.scenarios;

function getDisruptionStart(scenario?: string): number {
  if (scenario && data.metadata.disruptionStarts?.[scenario] != null) {
    return data.metadata.disruptionStarts[scenario];
  }
  if (typeof data.metadata.disruptionStart === "number") {
    return data.metadata.disruptionStart;
  }
  const starts = data.metadata.disruptionStarts;
  if (starts) {
    const vals = Object.values(starts);
    if (vals.length) return Math.min(...vals);
  }
  return 0;
}

// Supply chain tiers derived from the ABM config defaults
const baseTiers = [
  { name: "Tier 3", agents: 3, color: "bg-purple-700" },
  { name: "Tier 2", agents: 4, color: "bg-amber-700" },
  { name: "Tier 1", agents: 5, color: "bg-blue-600" },
  { name: "Manufacturing", agents: 3, color: "bg-emerald-600" },
  { name: "Distribution", agents: 4, color: "bg-cyan-600" },
  { name: "Pharmacy", agents: 20, color: "bg-rose-600" },
];

// Disruption impact per scenario on each tier
const scenarioDisruptions: Record<string, number[]> = {
  "India API Export Ban":        [0, 3, 2, 1, 1, 0],
  "China Raw Material Lockdown": [2, 2, 1, 1, 1, 0],
  "US Hurricane":                [0, 0, 3, 2, 2, 0],
  "Cyber Attack":                [0, 0, 2, 1, 0, 0],
  "Quality Crisis":              [0, 2, 1, 1, 1, 0],
};

export default function OverviewPage() {
  const [selectedScenario, setSelectedScenario] = useState(scenarios[0]);

  const ai = data.scenarios[selectedScenario]?.["AI-Enabled"];
  const noai = data.scenarios[selectedScenario]?.["No-AI"];

  // Build chart data from weekly percentiles
  const slChart = useMemo(() => {
    if (!ai?.weeklyPercentiles) return [];
    return ai.weeklyPercentiles.map((w) => ({
      week: w.week + 1,
      value: +(w.sl_p50 * 100).toFixed(1),
    }));
  }, [ai]);

  const aiChart = useMemo(() => {
    if (!ai?.weeklyPercentiles || !noai?.weeklyPercentiles) return [];
    return ai.weeklyPercentiles.map((w, i) => ({
      week: w.week + 1,
      ai: +(w.sl_p50 * 100).toFixed(1),
      noAi: +(noai.weeklyPercentiles[i]?.sl_p50 * 100 || 0).toFixed(1),
    }));
  }, [ai, noai]);

  const inventoryChart = useMemo(() => {
    if (!ai?.weeklyPercentiles) return [];
    return ai.weeklyPercentiles.map((w) => ({
      week: w.week + 1,
      value: w.inv_p50,
    }));
  }, [ai]);

  // Sparkline data: last 12 weeks of AI median SL
  const slSparkline = useMemo(() => {
    if (!ai?.weeklyPercentiles) return [];
    return ai.weeklyPercentiles.slice(-12).map((w) => w.sl_p50);
  }, [ai]);

  const invSparkline = useMemo(() => {
    if (!ai?.weeklyPercentiles) return [];
    return ai.weeklyPercentiles.slice(-12).map((w) => w.inv_p50);
  }, [ai]);

  // KPI values
  const summary = ai?.summary;
  const noaiSummary = noai?.summary;

  // Compute week-over-week pct change for sparkline trend
  const computeTrend = (arr: number[]) => {
    if (arr.length < 8) return 0;
    const recent = arr.slice(-4);
    const prev = arr.slice(-8, -4);
    const rAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const pAvg = prev.reduce((a, b) => a + b, 0) / prev.length;
    return pAvg === 0 ? 0 : ((rAvg - pAvg) / pAvg) * 100;
  };

  const slTrend = computeTrend(ai?.weeklyPercentiles?.map((w) => w.sl_p50) || []);

  // Tier disruption for selected scenario
  const disruptions = scenarioDisruptions[selectedScenario] || [0, 0, 0, 0, 0, 0];
  const tiers = baseTiers.map((t, i) => ({ ...t, disrupted: disruptions[i] }));

  if (!summary || !noaiSummary) {
    return <div className="p-8 text-muted-foreground">Loading validation data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Scenario Selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Scenario Overview</CardTitle>
            <Select value={selectedScenario} onValueChange={setSelectedScenario}>
              <SelectTrigger className="w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scenarios.map((sc) => (
                  <SelectItem key={sc} value={sc}>
                    {sc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">
            Data from {data.metadata.nSeeds}-seed Monte Carlo simulation • Median (P50) values shown • Disruption starts week {data.metadata.disruptionStart}
          </p>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          title="Service Level"
          value={`${(summary.avgAvgSL * 100).toFixed(1)}%`}
          icon={<Activity className="h-4 w-4" />}
          trend={{ value: Math.abs(slTrend), direction: slTrend >= 0 ? "up" : "down" }}
          goodDirection="up"
          sparklineData={slSparkline}
        />
        <KpiCard
          title="Min Service Level"
          value={`${(summary.avgMinSL * 100).toFixed(1)}%`}
          icon={<AlertTriangle className="h-4 w-4" />}
          trend={{ value: Math.abs(((summary.avgMinSL - noaiSummary.avgMinSL) / noaiSummary.avgMinSL) * 100), direction: "up" }}
          goodDirection="up"
        />
        <KpiCard
          title="Avg Stockouts"
          value={summary.avgStockouts.toFixed(0)}
          icon={<Users className="h-4 w-4" />}
          trend={{ value: Math.abs(((noaiSummary.avgStockouts - summary.avgStockouts) / noaiSummary.avgStockouts) * 100), direction: "down" }}
          goodDirection="down"
        />
        <KpiCard
          title="Avg Spoilage"
          value={summary.avgSpoilage.toFixed(0)}
          icon={<Thermometer className="h-4 w-4" />}
          trend={{ value: Math.abs(((noaiSummary.avgSpoilage - summary.avgSpoilage) / noaiSummary.avgSpoilage) * 100), direction: summary.avgSpoilage < noaiSummary.avgSpoilage ? "down" : "up" }}
          goodDirection="down"
        />
        <KpiCard
          title="Terminal SL"
          value={`${(summary.avgTerminalSL * 100).toFixed(1)}%`}
          icon={<Brain className="h-4 w-4" />}
          goodDirection="up"
        />
        <KpiCard
          title="Compliance Violations"
          value={summary.avgCompliance.toFixed(0)}
          icon={<ShieldCheck className="h-4 w-4" />}
          trend={{ value: Math.abs(((noaiSummary.avgCompliance - summary.avgCompliance) / noaiSummary.avgCompliance) * 100), direction: summary.avgCompliance < noaiSummary.avgCompliance ? "down" : "up" }}
          goodDirection="down"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Level Over Time */}
        <Card>
          <CardHeader><CardTitle className="text-base">Service Level Over Time (AI-Enabled Median)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={slChart}>
                  <defs>
                    <linearGradient id="slGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                  <XAxis dataKey="week" stroke="hsl(215, 20%, 65%)" fontSize={12} />
                  <YAxis domain={[0, 100]} stroke="hsl(215, 20%, 65%)" fontSize={12} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }}
                    formatter={(v: number) => [`${v.toFixed(1)}%`, "Service Level"]}
                  />
                  <ReferenceLine y={95} stroke="#10B981" strokeDasharray="5 5" label={{ value: "Target 95%", fill: "#10B981", fontSize: 11 }} />
                  <ReferenceLine x={data.metadata.disruptionStart + 1} stroke="#EF4444" strokeDasharray="3 3" label={{ value: "Disruption", fill: "#EF4444", fontSize: 10, position: "top" }} />
                  <Area type="monotone" dataKey="value" stroke="#3B82F6" fill="url(#slGrad)" strokeWidth={2} name="Service Level %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* AI vs No-AI */}
        <Card>
          <CardHeader><CardTitle className="text-base">AI-Enabled vs No-AI</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={aiChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                  <XAxis dataKey="week" stroke="hsl(215, 20%, 65%)" fontSize={12} />
                  <YAxis domain={[0, 105]} stroke="hsl(215, 20%, 65%)" fontSize={12} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }}
                    formatter={(v: number) => [`${v.toFixed(1)}%`]}
                  />
                  <Legend />
                  <ReferenceLine x={data.metadata.disruptionStart + 1} stroke="#EF4444" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="ai" stroke="#10B981" strokeWidth={2} dot={false} name="AI-Enabled" />
                  <Line type="monotone" dataKey="noAi" stroke="#F59E0B" strokeWidth={2} dot={false} name="No AI" strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Trend */}
      <Card>
        <CardHeader><CardTitle className="text-base">Inventory Trend (AI-Enabled Median)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={inventoryChart}>
                <defs>
                  <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                <XAxis dataKey="week" stroke="hsl(215, 20%, 65%)" fontSize={12} />
                <YAxis stroke="hsl(215, 20%, 65%)" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }}
                  formatter={(v: number) => [v.toLocaleString(), "Units"]}
                />
                <ReferenceLine x={data.metadata.disruptionStart + 1} stroke="#EF4444" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="value" stroke="#10B981" fill="url(#invGrad)" strokeWidth={2} name="Total Inventory" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Supply Chain at a Glance */}
      <Card>
        <CardHeader><CardTitle className="text-base">Supply Chain at a Glance</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between overflow-x-auto gap-2 py-4">
            {tiers.map((tier, i) => (
              <div key={tier.name} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-2 min-w-[100px]">
                  <div className={`${tier.color} rounded-xl px-4 py-3 text-center min-w-[100px]`}>
                    <div className="text-xs font-medium text-foreground">{tier.name}</div>
                    <div className="text-lg font-bold text-foreground">{tier.agents}</div>
                    {tier.disrupted > 0 && (
                      <span className="inline-flex items-center rounded-full bg-destructive/20 px-2 py-0.5 text-xs font-medium text-destructive">
                        {tier.disrupted} disrupted
                      </span>
                    )}
                  </div>
                </div>
                {i < tiers.length - 1 && <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
