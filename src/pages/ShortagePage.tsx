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
import { Brain, Package, Target, TrendingUp } from "lucide-react";
import {
  Area, AreaChart, Line, LineChart, Bar, BarChart,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ComposedChart, ReferenceLine,
} from "recharts";

import validationData from "@/data/validationReportData.json";

const data = validationData as any;
const scenarios = data.metadata.scenarios as string[];

export default function ShortagePage() {
  const [selectedScenario, setSelectedScenario] = useState(scenarios[0]);

  const ai = data.scenarios[selectedScenario]?.["AI-Enabled"];
  const noai = data.scenarios[selectedScenario]?.["No-AI"];
  const aiSummary = ai?.summary;
  const noaiSummary = noai?.summary;

  // Service level + inventory dual axis chart (proxy for shortage prediction)
  const dualData = useMemo(() => {
    if (!ai?.weeklyPercentiles) return [];
    return ai.weeklyPercentiles.map((w: any) => ({
      week: w.week + 1,
      serviceLevel: +(w.sl_p50 * 100).toFixed(1),
      inventory: w.inv_p50,
      invP10: w.inv_p10,
      invP90: w.inv_p90,
    }));
  }, [ai]);

  // AI vs No-AI service level comparison (shortage impact)
  const aiVsNoAiData = useMemo(() => {
    if (!ai?.weeklyPercentiles || !noai?.weeklyPercentiles) return [];
    return ai.weeklyPercentiles.map((w: any, i: number) => ({
      week: w.week + 1,
      "AI-Enabled": +(w.sl_p50 * 100).toFixed(1),
      "No-AI": +(noai.weeklyPercentiles[i]?.sl_p50 * 100 || 0).toFixed(1),
    }));
  }, [ai, noai]);

  // Scenario comparison: stockouts across all scenarios
  const stockoutComparison = useMemo(() => {
    return scenarios.map(sc => {
      const aiS = data.scenarios[sc]?.["AI-Enabled"]?.summary;
      const noaiS = data.scenarios[sc]?.["No-AI"]?.summary;
      return {
        name: sc.replace("China Raw Material ", "China ").replace(" API Export Ban", " Ban"),
        "AI Stockouts": Math.round(aiS?.avgStockouts || 0),
        "No-AI Stockouts": Math.round(noaiS?.avgStockouts || 0),
      };
    });
  }, []);

  if (!aiSummary || !noaiSummary) {
    return <div className="p-8 text-muted-foreground">Loading...</div>;
  }

  const stockoutReduction = ((noaiSummary.avgStockouts - aiSummary.avgStockouts) / noaiSummary.avgStockouts * 100).toFixed(0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Shortage Prediction</h2>
        <Select value={selectedScenario} onValueChange={setSelectedScenario}>
          <SelectTrigger className="w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {scenarios.map(sc => (
              <SelectItem key={sc} value={sc}>{sc}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        Monte Carlo shortage analysis • {data.metadata.nSeeds} seeds • Disruption at week {data.metadata.disruptionStart}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Avg Peak Stockouts"
          value={aiSummary.avgStockouts.toFixed(0)}
          icon={<Brain className="h-4 w-4" />}
          goodDirection="down"
        />
        <KpiCard
          title="Min Service Level"
          value={`${(aiSummary.avgMinSL * 100).toFixed(1)}%`}
          icon={<Package className="h-4 w-4" />}
          goodDirection="up"
        />
        <KpiCard
          title="Stockout Reduction (AI)"
          value={`${stockoutReduction}%`}
          icon={<Target className="h-4 w-4" />}
          goodDirection="up"
        />
        <KpiCard
          title="Avg Patient Impact"
          value={Math.round(aiSummary.avgPatientImpact).toLocaleString()}
          icon={<TrendingUp className="h-4 w-4" />}
          goodDirection="down"
        />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Service Level & Inventory Over Time</CardTitle></CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dualData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                <XAxis dataKey="week" stroke="hsl(215, 20%, 65%)" fontSize={12} />
                <YAxis yAxisId="left" domain={[0, 105]} stroke="#3B82F6" fontSize={12} tickFormatter={v => `${v}%`} />
                <YAxis yAxisId="right" orientation="right" stroke="#10B981" fontSize={12} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} />
                <Legend />
                <ReferenceLine yAxisId="left" y={95} stroke="#10B981" strokeDasharray="5 5" />
                <ReferenceLine x={data.metadata.disruptionStart + 1} stroke="#EF4444" strokeDasharray="3 3" />
                <Line yAxisId="left" type="monotone" dataKey="serviceLevel" stroke="#3B82F6" strokeWidth={2} dot={false} name="Service Level %" />
                <Area yAxisId="right" type="monotone" dataKey="inventory" stroke="#10B981" fill="#10B981" fillOpacity={0.15} name="Inventory" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Service Level: AI vs No-AI</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={aiVsNoAiData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                <XAxis dataKey="week" stroke="hsl(215, 20%, 65%)" fontSize={12} />
                <YAxis domain={[0, 105]} stroke="hsl(215, 20%, 65%)" fontSize={12} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} formatter={(v: number) => `${v}%`} />
                <Legend />
                <ReferenceLine x={data.metadata.disruptionStart + 1} stroke="#EF4444" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="AI-Enabled" stroke="#10B981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="No-AI" stroke="#EF4444" strokeWidth={2} dot={false} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Stockout Comparison Across Scenarios</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stockoutComparison} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                <XAxis type="number" stroke="hsl(215, 20%, 65%)" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="hsl(215, 20%, 65%)" fontSize={10} width={100} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="AI Stockouts" fill="#10B981" barSize={12} radius={[0, 4, 4, 0]} />
                <Bar dataKey="No-AI Stockouts" fill="#EF4444" barSize={12} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
