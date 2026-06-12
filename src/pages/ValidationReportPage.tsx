"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
} from "recharts";
import {
  CheckCircle2,
  XCircle,
  Activity,
  TrendingUp,
  ShieldCheck,
  BarChart3,
  FlaskConical,
  Zap,
} from "lucide-react";

import validationData from "@/data/validationReportData.json";

// ─── Color palette ───────────────────────────────────────────────
const BLUE = "#3B82F6";
const GREEN = "#10B981";
const AMBER = "#F59E0B";
const RED = "#EF4444";
const PURPLE = "#8B5CF6";
const CYAN = "#22d3ee";
const GRAY = "#6b7280";

const SCENARIO_COLORS: Record<string, string> = {
  "India API Export Ban": RED,
  "China Raw Material Lockdown": AMBER,
  "US Hurricane": BLUE,
  "Cyber Attack": PURPLE,
  "Quality Crisis": GREEN,
};

const chartConfig = {
  grid: { strokeDasharray: "3 3", stroke: "hsl(215, 19%, 25%)" },
  axis: { stroke: "hsl(215, 20%, 65%)", fontSize: 11 },
  tooltip: {
    contentStyle: {
      backgroundColor: "hsl(217, 33%, 17%)",
      border: "1px solid hsl(215, 19%, 30%)",
      borderRadius: 8,
      fontSize: 12,
    },
  },
};

// ─── Helper types ────────────────────────────────────────────────
interface ScenarioConfig {
  summary: {
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
  };
  weeklyPercentiles: Array<{
    week: number;
    sl_p10: number;
    sl_p25: number;
    sl_p50: number;
    sl_p75: number;
    sl_p90: number;
    inv_p10: number;
    inv_p50: number;
    inv_p90: number;
  }>;
}

interface ScorecardItem {
  name: string;
  pass: boolean;
  detail: string;
}

const data = validationData as unknown as {
  metadata: {
    nSeeds: number;
    timeHorizon: number;
    disruptionStart?: number;
    disruptionStarts?: Record<string, number>;
    scenarios: string[];
    configs: string[];
    totalRuns: number;
    generatedAt: string;
  };
  scenarios: Record<string, Record<string, ScenarioConfig>>;
  scorecard?: ScorecardItem[];
};

const scorecard: ScorecardItem[] = (data as { scorecard?: ScorecardItem[] }).scorecard ?? [];

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

// ─── KPI Banner Card ─────────────────────────────────────────────
function KpiBanner() {
  const allAI = data.metadata.scenarios.map(
    (sc) => data.scenarios[sc]["AI-Enabled"].summary
  );
  const allNoAI = data.metadata.scenarios.map(
    (sc) => data.scenarios[sc]["No-AI"].summary
  );

  const avgAISL =
    allAI.reduce((s, d) => s + d.avgAvgSL, 0) / allAI.length;
  const avgNoAISL =
    allNoAI.reduce((s, d) => s + d.avgAvgSL, 0) / allNoAI.length;
  const complianceReduction =
    1 -
    allAI.reduce((s, d) => s + d.avgCompliance, 0) /
      allNoAI.reduce((s, d) => s + d.avgCompliance, 0);
  const passCount = scorecard.filter((c) => c.pass).length;

  const kpis = [
    {
      label: "AI Avg Service Level",
      value: `${(avgAISL * 100).toFixed(1)}%`,
      icon: <Activity className="h-5 w-5" />,
      color: "text-blue-400",
    },
    {
      label: "No-AI Avg Service Level",
      value: `${(avgNoAISL * 100).toFixed(1)}%`,
      icon: <TrendingUp className="h-5 w-5" />,
      color: "text-amber-400",
    },
    {
      label: "Compliance Reduction",
      value: `${(complianceReduction * 100).toFixed(0)}%`,
      icon: <ShieldCheck className="h-5 w-5" />,
      color: "text-green-400",
    },
    {
      label: "Validation Score",
      value: `${passCount}/${scorecard.length}`,
      icon: <CheckCircle2 className="h-5 w-5" />,
      color: "text-purple-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label}>
          <CardContent className="pt-6 pb-4 text-center">
            <div className={`flex justify-center mb-2 ${kpi.color}`}>
              {kpi.icon}
            </div>
            <div className="text-3xl font-bold">{kpi.value}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {kpi.label}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Scenario Comparison Bar Chart ──────────────────────────────
function ScenarioComparisonChart() {
  const barData = data.metadata.scenarios.map((sc) => {
    const ai = data.scenarios[sc]["AI-Enabled"].summary;
    const noai = data.scenarios[sc]["No-AI"].summary;
    return {
      name: sc.replace("China Raw Material ", "China ").replace(" API Export Ban", " Export Ban"),
      "AI Min SL": +(ai.avgMinSL * 100).toFixed(1),
      "No-AI Min SL": +(noai.avgMinSL * 100).toFixed(1),
      "AI Avg SL": +(ai.avgAvgSL * 100).toFixed(1),
      "No-AI Avg SL": +(noai.avgAvgSL * 100).toFixed(1),
      p10: +(ai.p10MinSL * 100).toFixed(1),
      p90: +(ai.p90MinSL * 100).toFixed(1),
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Scenario Comparison — Min Service Level (30-seed Monte Carlo)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={barData} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid {...chartConfig.grid} />
            <XAxis
              type="number"
              {...chartConfig.axis}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              {...chartConfig.axis}
              width={120}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              {...chartConfig.tooltip}
              formatter={(v: number) => `${v.toFixed(1)}%`}
            />
            <Legend />
            <Bar dataKey="AI Min SL" fill={BLUE} barSize={14} radius={[0, 4, 4, 0]} />
            <Bar dataKey="No-AI Min SL" fill={AMBER} barSize={14} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Scenario Results Table ──────────────────────────────────────
function ScenarioResultsTable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Detailed Scenario Results</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scenario</TableHead>
                <TableHead>Config</TableHead>
                <TableHead className="text-right">Avg SL</TableHead>
                <TableHead className="text-right">Min SL (P50)</TableHead>
                <TableHead className="text-right">Min SL P10</TableHead>
                <TableHead className="text-right">Min SL P90</TableHead>
                <TableHead className="text-right">Std Dev</TableHead>
                <TableHead className="text-right">Avg Stockouts</TableHead>
                <TableHead className="text-right">Terminal SL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.metadata.scenarios.flatMap((sc) =>
                data.metadata.configs.map((cfg) => {
                  const s = data.scenarios[sc][cfg].summary;
                  const isAI = cfg === "AI-Enabled";
                  return (
                    <TableRow
                      key={`${sc}-${cfg}`}
                      className={isAI ? "" : "opacity-70"}
                    >
                      <TableCell className="font-medium text-xs">
                        {isAI ? sc : ""}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={isAI ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {cfg}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {(s.avgAvgSL * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {(s.avgMinSL * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {(s.p10MinSL * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {(s.p90MinSL * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        ±{(s.stdMinSL * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {s.avgStockouts.toFixed(0)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {(s.avgTerminalSL * 100).toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Path Visualization with Confidence Bands ───────────────────
function PathVisualization() {
  const [selected, setSelected] = useState(data.metadata.scenarios[0]);

  const aiData = data.scenarios[selected]?.["AI-Enabled"]?.weeklyPercentiles || [];
  const noaiData = data.scenarios[selected]?.["No-AI"]?.weeklyPercentiles || [];

  const chartData = aiData.map((w, i) => ({
    week: w.week,
    ai_p50: +(w.sl_p50 * 100).toFixed(1),
    ai_p10: +(w.sl_p10 * 100).toFixed(1),
    ai_p90: +(w.sl_p90 * 100).toFixed(1),
    noai_p50: noaiData[i] ? +(noaiData[i].sl_p50 * 100).toFixed(1) : 0,
    noai_p10: noaiData[i] ? +(noaiData[i].sl_p10 * 100).toFixed(1) : 0,
    noai_p90: noaiData[i] ? +(noaiData[i].sl_p90 * 100).toFixed(1) : 0,
  }));

  const inventoryData = aiData.map((w, i) => ({
    week: w.week,
    ai_p50: w.inv_p50,
    ai_p10: w.inv_p10,
    ai_p90: w.inv_p90,
    noai_p50: noaiData[i]?.inv_p50 || 0,
    noai_p10: noaiData[i]?.inv_p10 || 0,
    noai_p90: noaiData[i]?.inv_p90 || 0,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Path Visualization — Confidence Bands (P10–P90)
          </CardTitle>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {data.metadata.scenarios.map((sc) => (
                <SelectItem key={sc} value={sc}>
                  {sc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Service Level Path */}
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-2">
            Service Level (%) — AI vs No-AI
          </h4>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="aiBand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BLUE} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={BLUE} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="noaiBand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={AMBER} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={AMBER} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid {...chartConfig.grid} />
              <XAxis
                {...chartConfig.axis}
                dataKey="week"
                label={{ value: "Week", position: "insideBottom", offset: -5, style: { fill: GRAY, fontSize: 11 } }}
              />
              <YAxis
                {...chartConfig.axis}
                domain={[0, 105]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                {...chartConfig.tooltip}
                formatter={(v: number, name: string) => [
                  `${v.toFixed(1)}%`,
                  name.replace("ai_", "AI ").replace("noai_", "No-AI ").replace("p50", "Median").replace("p10", "P10").replace("p90", "P90"),
                ]}
              />
              <ReferenceLine
                y={95}
                stroke={GREEN}
                strokeDasharray="5 5"
                label={{ value: "95% Target", fill: GREEN, fontSize: 10 }}
              />
              <ReferenceLine
                x={getDisruptionStart(selected)}
                stroke={RED}
                strokeDasharray="3 3"
                label={{ value: "Disruption", fill: RED, fontSize: 10, position: "top" }}
              />
              {/* AI confidence band */}
              <Area type="monotone" dataKey="ai_p90" stroke="none" fill="url(#aiBand)" />
              <Area type="monotone" dataKey="ai_p10" stroke="none" fill="transparent" />
              <Line type="monotone" dataKey="ai_p50" stroke={BLUE} strokeWidth={2.5} dot={false} name="AI Median" />
              <Line type="monotone" dataKey="ai_p10" stroke={BLUE} strokeWidth={1} strokeDasharray="4 4" dot={false} name="AI P10" />
              <Line type="monotone" dataKey="ai_p90" stroke={BLUE} strokeWidth={1} strokeDasharray="4 4" dot={false} name="AI P90" />
              {/* No-AI confidence band */}
              <Area type="monotone" dataKey="noai_p90" stroke="none" fill="url(#noaiBand)" />
              <Area type="monotone" dataKey="noai_p10" stroke="none" fill="transparent" />
              <Line type="monotone" dataKey="noai_p50" stroke={AMBER} strokeWidth={2.5} dot={false} name="No-AI Median" />
              <Line type="monotone" dataKey="noai_p10" stroke={AMBER} strokeWidth={1} strokeDasharray="4 4" dot={false} name="No-AI P10" />
              <Line type="monotone" dataKey="noai_p90" stroke={AMBER} strokeWidth={1} strokeDasharray="4 4" dot={false} name="No-AI P90" />
              <Legend />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Inventory Path */}
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-2">
            Total Inventory — AI vs No-AI
          </h4>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={inventoryData}>
              <CartesianGrid {...chartConfig.grid} />
              <XAxis {...chartConfig.axis} dataKey="week" />
              <YAxis {...chartConfig.axis} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                {...chartConfig.tooltip}
                formatter={(v: number, name: string) => [
                  v.toLocaleString(),
                  name.replace("ai_", "AI ").replace("noai_", "No-AI ").replace("p50", "Median").replace("p10", "P10").replace("p90", "P90"),
                ]}
              />
              <ReferenceLine
                x={getDisruptionStart(selected)}
                stroke={RED}
                strokeDasharray="3 3"
              />
              <Line type="monotone" dataKey="ai_p50" stroke={BLUE} strokeWidth={2} dot={false} name="AI Median" />
              <Line type="monotone" dataKey="ai_p10" stroke={BLUE} strokeWidth={1} strokeDasharray="4 4" dot={false} name="AI P10" />
              <Line type="monotone" dataKey="ai_p90" stroke={BLUE} strokeWidth={1} strokeDasharray="4 4" dot={false} name="AI P90" />
              <Line type="monotone" dataKey="noai_p50" stroke={AMBER} strokeWidth={2} dot={false} name="No-AI Median" />
              <Legend />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── All Scenarios Overlay ──────────────────────────────────────
function AllScenariosOverlay() {
  const chartData = Array.from({ length: 52 }, (_, week) => {
    const point: Record<string, number> = { week };
    for (const sc of data.metadata.scenarios) {
      const wp = data.scenarios[sc]?.["AI-Enabled"]?.weeklyPercentiles;
      if (wp && wp[week]) {
        const shortName = sc.replace("China Raw Material ", "China ").replace(" API Export Ban", " Ban").replace("US ", "");
        point[shortName] = +(wp[week].sl_p50 * 100).toFixed(1);
      }
    }
    return point;
  });

  const scenarioNames = data.metadata.scenarios.map((sc) =>
    sc.replace("China Raw Material ", "China ").replace(" API Export Ban", " Ban").replace("US ", "")
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Scenarios — AI-Enabled Median Service Level</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid {...chartConfig.grid} />
            <XAxis
              {...chartConfig.axis}
              dataKey="week"
              label={{ value: "Week", position: "insideBottom", offset: -5, style: { fill: GRAY, fontSize: 11 } }}
            />
            <YAxis
              {...chartConfig.axis}
              domain={[0, 105]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              {...chartConfig.tooltip}
              formatter={(v: number) => `${v.toFixed(1)}%`}
            />
            <ReferenceLine y={95} stroke={GREEN} strokeDasharray="5 5" />
            <ReferenceLine x={getDisruptionStart()} stroke={RED} strokeDasharray="3 3" />
            {scenarioNames.map((name, i) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={Object.values(SCENARIO_COLORS)[i]}
                strokeWidth={2}
                dot={false}
              />
            ))}
            <Legend />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Validation Scorecard ───────────────────────────────────────
function ValidationScorecard() {
  const passCount = scorecard.filter((c) => c.pass).length;
  const total = scorecard.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Validation Scorecard
          </span>
          <Badge
            variant={passCount === total ? "default" : "secondary"}
            className={`text-lg px-4 py-1 ${
              passCount === total
                ? "bg-green-600 hover:bg-green-700"
                : passCount >= total - 1
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {passCount}/{total} PASS
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {scorecard.map((check, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-3 p-3 rounded-lg ${
                check.pass
                  ? "bg-green-500/10 border border-green-500/20"
                  : "bg-red-500/10 border border-red-500/20"
              }`}
            >
              {check.pass ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              )}
              <div className="flex-1">
                <div className="font-medium text-sm">{check.name}</div>
                <div className="text-xs text-muted-foreground">
                  {check.detail}
                </div>
              </div>
              <Badge
                variant="outline"
                className={
                  check.pass
                    ? "border-green-500 text-green-500"
                    : "border-red-500 text-red-500"
                }
              >
                {check.pass ? "PASS" : "FAIL"}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── AI Impact Summary ──────────────────────────────────────────
function AIImpactChart() {
  const impactData = data.metadata.scenarios.map((sc) => {
    const ai = data.scenarios[sc]["AI-Enabled"].summary;
    const noai = data.scenarios[sc]["No-AI"].summary;
    return {
      name: sc.replace("China Raw Material ", "China ").replace(" API Export Ban", " Ban"),
      "SL Improvement": +((ai.avgAvgSL - noai.avgAvgSL) * 100).toFixed(1),
      "Stockout Reduction": +(
        ((noai.avgStockouts - ai.avgStockouts) / noai.avgStockouts) *
        100
      ).toFixed(1),
      "Compliance Reduction": +(
        ((noai.avgCompliance - ai.avgCompliance) / noai.avgCompliance) *
        100
      ).toFixed(1),
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          AI Impact — Improvement over No-AI Baseline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={impactData} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid {...chartConfig.grid} />
            <XAxis
              type="number"
              {...chartConfig.axis}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              {...chartConfig.axis}
              width={110}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              {...chartConfig.tooltip}
              formatter={(v: number) => `${v.toFixed(1)}%`}
            />
            <Legend />
            <Bar dataKey="SL Improvement" fill={BLUE} barSize={10} radius={[0, 4, 4, 0]} />
            <Bar dataKey="Stockout Reduction" fill={GREEN} barSize={10} radius={[0, 4, 4, 0]} />
            <Bar dataKey="Compliance Reduction" fill={PURPLE} barSize={10} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Methodology Section ────────────────────────────────────────
function Methodology() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Methodology</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <div>
          <h4 className="font-semibold text-foreground mb-1">
            Agent-Based Model
          </h4>
          <p>
            Multi-tier pharmaceutical supply chain with Tier 3 (raw materials)
            → Tier 2 (API synthesis) → Tier 1 (formulation) → Manufacturing →
            Distribution → Pharmacy agents. Each agent has stochastic
            production, inventory, and shipping behaviors governed by a seeded
            LCG PRNG for reproducibility.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-1">
            Monte Carlo Design
          </h4>
          <p>
            {data.metadata.nSeeds} independent seeds ×{" "}
            {data.metadata.scenarios.length} disruption scenarios × 2
            configurations (AI-Enabled, No-AI) ={" "}
            {data.metadata.totalRuns} total simulation runs over a{" "}
            {data.metadata.timeHorizon}-week horizon. Disruptions begin at week{" "}
            {getDisruptionStart()}.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-1">
            Disruption Types
          </h4>
          <p>
            <strong>Trade Dispute</strong>: Cascading export ban with inventory
            seizure. <strong>Pandemic Wave</strong>: Sustained multi-tier
            lockdown with bi-weekly drain. <strong>Natural Disaster</strong>:
            Catastrophic physical destruction with fast V-shaped recovery.{" "}
            <strong>Cyber Attack</strong>: Brief digital disruption, no
            inventory destruction. <strong>Quality Failure</strong>: Rolling
            recall waves every 5 weeks.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-1">
            Validation Criteria
          </h4>
          <p>
            8-point scorecard assessing scenario differentiation, AI vs No-AI
            separation, recovery dynamics, Monte Carlo convergence, and absence
            of pathological model behaviors. Generated{" "}
            {new Date(data.metadata.generatedAt).toLocaleDateString()}.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ──────────────────────────────────────────────────
export default function ValidationReportPage() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          ABM Validation Report
        </h1>
        <p className="text-muted-foreground">
          Pharma Supply Chain Agent-Based Model — Confidence Assessment
          <span className="ml-2 text-xs opacity-60">
            {data.metadata.totalRuns} Monte Carlo runs •{" "}
            {data.metadata.nSeeds} seeds •{" "}
            {data.metadata.scenarios.length} scenarios •{" "}
            Generated{" "}
            {new Date(data.metadata.generatedAt).toLocaleDateString()}
          </span>
        </p>
      </div>

      {/* KPI Banner */}
      <KpiBanner />

      {/* Scenario Comparison */}
      <ScenarioComparisonChart />

      {/* Results Table */}
      <ScenarioResultsTable />

      {/* Path Visualizations */}
      <PathVisualization />

      {/* All Scenarios Overlay */}
      <AllScenariosOverlay />

      {/* AI Impact */}
      <AIImpactChart />

      {/* Validation Scorecard */}
      <ValidationScorecard />

      {/* Methodology */}
      <Methodology />
    </div>
  );
}
