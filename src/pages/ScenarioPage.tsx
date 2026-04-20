import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiCard } from "@/components/KpiCard";

import validationData from "@/data/validationReportData.json";

const data = validationData as any;
const scenarios = data.metadata.scenarios as string[];
const TOTAL_WEEKS = data.metadata.timeHorizon as number;

const scenarioColors: Record<string, string> = {
  "India API Export Ban": "#EF4444",
  "China Raw Material Lockdown": "#F59E0B",
  "US Hurricane": "#3B82F6",
  "Cyber Attack": "#8B5CF6",
  "Quality Crisis": "#10B981",
};

const shortName = (sc: string) =>
  sc.replace("China Raw Material ", "China ").replace(" API Export Ban", " Ban").replace("US ", "");

export default function ScenarioPage() {
  const [active, setActive] = useState<Set<string>>(new Set(scenarios));

  const toggle = (key: string) => {
    const next = new Set(active);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setActive(next);
  };

  // Build service level chart from real MC percentile data
  const slChartData = useMemo(() => {
    return Array.from({ length: TOTAL_WEEKS }, (_, week) => {
      const point: Record<string, number> = { week: week + 1 };
      for (const sc of scenarios) {
        if (active.has(sc)) {
          const wp = data.scenarios[sc]?.["AI-Enabled"]?.weeklyPercentiles;
          if (wp?.[week]) {
            point[sc] = +(wp[week].sl_p50 * 100).toFixed(1);
          }
        }
      }
      return point;
    });
  }, [active]);

  // Build inventory chart
  const invChartData = useMemo(() => {
    return Array.from({ length: TOTAL_WEEKS }, (_, week) => {
      const point: Record<string, number> = { week: week + 1 };
      for (const sc of scenarios) {
        if (active.has(sc)) {
          const wp = data.scenarios[sc]?.["AI-Enabled"]?.weeklyPercentiles;
          if (wp?.[week]) {
            point[sc] = wp[week].inv_p50;
          }
        }
      }
      return point;
    });
  }, [active]);

  // AI vs No-AI gap chart (service level difference)
  const gapChartData = useMemo(() => {
    return Array.from({ length: TOTAL_WEEKS }, (_, week) => {
      const point: Record<string, number> = { week: week + 1 };
      for (const sc of scenarios) {
        if (active.has(sc)) {
          const aiWp = data.scenarios[sc]?.["AI-Enabled"]?.weeklyPercentiles;
          const noaiWp = data.scenarios[sc]?.["No-AI"]?.weeklyPercentiles;
          if (aiWp?.[week] && noaiWp?.[week]) {
            point[sc] = +((aiWp[week].sl_p50 - noaiWp[week].sl_p50) * 100).toFixed(1);
          }
        }
      }
      return point;
    });
  }, [active]);

  // KPI calculations from real summaries
  const activeScenarios = Array.from(active);
  const worstMinSL = activeScenarios.length > 0
    ? Math.min(...activeScenarios.map(sc => data.scenarios[sc]?.["AI-Enabled"]?.summary?.avgMinSL || 1))
    : 1;
  const avgStockouts = activeScenarios.length > 0
    ? activeScenarios.reduce((sum, sc) => sum + (data.scenarios[sc]?.["AI-Enabled"]?.summary?.avgStockouts || 0), 0) / activeScenarios.length
    : 0;
  const avgRecovery = activeScenarios.length > 0
    ? activeScenarios.reduce((sum, sc) => sum + (data.scenarios[sc]?.["AI-Enabled"]?.summary?.avgRecovery || 0), 0) / activeScenarios.length
    : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Scenario Testing — Monte Carlo Comparison</h2>
      <p className="text-xs text-muted-foreground">
        Real data from {data.metadata.nSeeds}-seed Monte Carlo simulations • Median (P50) values shown • {data.metadata.totalRuns} total runs
      </p>

      <div className="flex flex-wrap gap-2">
        {scenarios.map((k) => (
          <Button
            key={k}
            variant={active.has(k) ? "default" : "secondary"}
            size="sm"
            onClick={() => toggle(k)}
            style={active.has(k) ? { backgroundColor: scenarioColors[k] } : {}}
          >
            {shortName(k)}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <KpiCard
          title="Worst Min Service Level"
          value={`${(worstMinSL * 100).toFixed(1)}%`}
          icon={null}
          goodDirection="up"
        />
        <KpiCard
          title="Avg Peak Stockouts"
          value={avgStockouts.toFixed(0)}
          icon={null}
          goodDirection="down"
        />
        <KpiCard
          title="Avg Recovery Week"
          value={avgRecovery >= 90 ? "No Recovery" : avgRecovery.toFixed(1)}
          icon={null}
          goodDirection="down"
        />
      </div>

      {/* Service Level comparison */}
      <Card>
        <CardHeader><CardTitle className="text-base">Service Level by Scenario (AI-Enabled)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={slChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                <XAxis dataKey="week" stroke="hsl(215, 20%, 65%)" fontSize={11} />
                <YAxis domain={[0, 105]} stroke="hsl(215, 20%, 65%)" fontSize={11} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} formatter={(v: number) => `${v.toFixed(1)}%`} />
                <ReferenceLine y={95} stroke="#10B981" strokeDasharray="5 5" />
                <ReferenceLine x={data.metadata.disruptionStart + 1} stroke="#EF4444" strokeDasharray="3 3" />
                <Legend />
                {scenarios.filter(k => active.has(k)).map(k => (
                  <Line key={k} type="monotone" dataKey={k} stroke={scenarioColors[k]} strokeWidth={2} dot={false} name={shortName(k)} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Inventory comparison */}
      <Card>
        <CardHeader><CardTitle className="text-base">Inventory by Scenario (AI-Enabled)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={invChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                <XAxis dataKey="week" stroke="hsl(215, 20%, 65%)" fontSize={11} />
                <YAxis stroke="hsl(215, 20%, 65%)" fontSize={11} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} formatter={(v: number) => v.toLocaleString()} />
                <ReferenceLine x={data.metadata.disruptionStart + 1} stroke="#EF4444" strokeDasharray="3 3" />
                <Legend />
                {scenarios.filter(k => active.has(k)).map(k => (
                  <Line key={k} type="monotone" dataKey={k} stroke={scenarioColors[k]} strokeWidth={1.5} dot={false} name={shortName(k)} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* AI advantage gap */}
      <Card>
        <CardHeader><CardTitle className="text-base">AI Advantage (SL Difference: AI minus No-AI)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={gapChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                <XAxis dataKey="week" stroke="hsl(215, 20%, 65%)" fontSize={11} />
                <YAxis stroke="hsl(215, 20%, 65%)" fontSize={11} tickFormatter={v => `${v}pp`} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} formatter={(v: number) => `${v.toFixed(1)}pp`} />
                <ReferenceLine y={0} stroke="#666" />
                <ReferenceLine x={data.metadata.disruptionStart + 1} stroke="#EF4444" strokeDasharray="3 3" />
                <Legend />
                {scenarios.filter(k => active.has(k)).map(k => (
                  <Line key={k} type="monotone" dataKey={k} stroke={scenarioColors[k]} strokeWidth={1.5} dot={false} name={shortName(k)} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Summary table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Scenario Summary (Monte Carlo Averages)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scenario</TableHead>
                <TableHead>Config</TableHead>
                <TableHead className="text-right">Avg SL</TableHead>
                <TableHead className="text-right">Min SL</TableHead>
                <TableHead className="text-right">Terminal SL</TableHead>
                <TableHead className="text-right">Stockouts</TableHead>
                <TableHead className="text-right">Spoilage</TableHead>
                <TableHead className="text-right">Compliance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scenarios.map((sc) =>
                ["AI-Enabled", "No-AI"].map((cfg) => {
                  const s = data.scenarios[sc]?.[cfg]?.summary;
                  if (!s) return null;
                  return (
                    <TableRow key={`${sc}-${cfg}`} className={cfg === "No-AI" ? "opacity-60" : ""}>
                      <TableCell className="font-medium text-xs" style={{ color: cfg === "AI-Enabled" ? scenarioColors[sc] : undefined }}>
                        {cfg === "AI-Enabled" ? shortName(sc) : ""}
                      </TableCell>
                      <TableCell className="text-xs">{cfg}</TableCell>
                      <TableCell className="text-right font-mono">{(s.avgAvgSL * 100).toFixed(1)}%</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{(s.avgMinSL * 100).toFixed(1)}%</TableCell>
                      <TableCell className="text-right font-mono">{(s.avgTerminalSL * 100).toFixed(1)}%</TableCell>
                      <TableCell className="text-right font-mono">{s.avgStockouts.toFixed(0)}</TableCell>
                      <TableCell className="text-right font-mono">{s.avgSpoilage.toFixed(0)}</TableCell>
                      <TableCell className="text-right font-mono">{s.avgCompliance.toFixed(0)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
