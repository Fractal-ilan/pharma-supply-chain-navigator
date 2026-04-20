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
import { RefreshCcw, Package, Gauge, TrendingUp } from "lucide-react";
import {
  Area, AreaChart, Line, LineChart, Bar, BarChart, Cell,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";

import validationData from "@/data/validationReportData.json";

const data = validationData as any;
const scenarios = data.metadata.scenarios as string[];

// Supply chain tiers with lead time estimates (ABM config constants)
const leadTimes = [
  { stage: "Raw Material", days: 45 },
  { stage: "API Manufacturing", days: 35 },
  { stage: "Finished Dosage", days: 21 },
  { stage: "Distribution", days: 14 },
  { stage: "Pharmacy", days: 7 },
];

// Regional inventory distribution weights (ABM topology)
const regionWeights: { region: string; weight: number }[] = [
  { region: "CN", weight: 0.15 },
  { region: "IN", weight: 0.20 },
  { region: "US", weight: 0.25 },
  { region: "IE", weight: 0.12 },
  { region: "DE", weight: 0.08 },
  { region: "CH", weight: 0.07 },
  { region: "IL", weight: 0.05 },
  { region: "BR", weight: 0.04 },
  { region: "JP", weight: 0.04 },
];

export default function InventoryPage() {
  const [selectedScenario, setSelectedScenario] = useState(scenarios[0]);

  const ai = data.scenarios[selectedScenario]?.["AI-Enabled"];
  const noai = data.scenarios[selectedScenario]?.["No-AI"];
  const aiSummary = ai?.summary;
  const noaiSummary = noai?.summary;

  // Inventory over time with rebalancing proxy
  const inventoryChart = useMemo(() => {
    if (!ai?.weeklyPercentiles || !noai?.weeklyPercentiles) return [];
    return ai.weeklyPercentiles.map((w: any, i: number) => {
      const noaiW = noai.weeklyPercentiles[i];
      // Rebalance actions proxy: difference between AI and No-AI inventory levels
      // indicates how much the AI optimizer is actively rebalancing
      const rebalanceProxy = Math.max(0, Math.round((w.inv_p50 - noaiW.inv_p50) * 0.05));
      return {
        week: w.week + 1,
        "AI Inventory": w.inv_p50,
        "No-AI Inventory": noaiW.inv_p50,
        "Rebalance Actions": rebalanceProxy,
      };
    });
  }, [ai, noai]);

  // Inventory distribution by region (scaled by median inventory at a sample week)
  const regionData = useMemo(() => {
    if (!ai?.weeklyPercentiles) return [];
    const midWeek = Math.floor(ai.weeklyPercentiles.length / 2);
    const totalInv = ai.weeklyPercentiles[midWeek]?.inv_p50 || 10000;
    return regionWeights.map(r => ({
      region: r.region,
      inventory: Math.round(totalInv * r.weight),
    }));
  }, [ai]);

  // Cross-scenario inventory comparison at trough
  const inventoryComparison = useMemo(() => {
    return scenarios.map(sc => {
      const aiWp = data.scenarios[sc]?.["AI-Enabled"]?.weeklyPercentiles;
      const noaiWp = data.scenarios[sc]?.["No-AI"]?.weeklyPercentiles;
      if (!aiWp || !noaiWp) return { name: sc, "AI Min Inv": 0, "No-AI Min Inv": 0 };
      const aiMin = Math.min(...aiWp.map((w: any) => w.inv_p50));
      const noaiMin = Math.min(...noaiWp.map((w: any) => w.inv_p50));
      return {
        name: sc.replace("China Raw Material ", "China ").replace(" API Export Ban", " Ban"),
        "AI Min Inv": aiMin,
        "No-AI Min Inv": noaiMin,
      };
    });
  }, []);

  // Inventory band chart (P10-P90 confidence)
  const invBandData = useMemo(() => {
    if (!ai?.weeklyPercentiles) return [];
    return ai.weeklyPercentiles.map((w: any) => ({
      week: w.week + 1,
      p10: w.inv_p10,
      p50: w.inv_p50,
      p90: w.inv_p90,
    }));
  }, [ai]);

  if (!aiSummary || !noaiSummary) {
    return <div className="p-8 text-muted-foreground">Loading...</div>;
  }

  // KPIs
  const lastAiInv = ai.weeklyPercentiles[ai.weeklyPercentiles.length - 1]?.inv_p50 || 0;
  const minAiInv = Math.min(...ai.weeklyPercentiles.map((w: any) => w.inv_p50));
  const minNoaiInv = Math.min(...noai.weeklyPercentiles.map((w: any) => w.inv_p50));
  const invAdvantage = minNoaiInv > 0 ? ((minAiInv - minNoaiInv) / minNoaiInv * 100).toFixed(0) : "0";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Inventory Balancing</h2>
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
        Inventory analytics from {data.metadata.nSeeds}-seed Monte Carlo • AI vs No-AI optimization comparison
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Terminal Inventory (AI)"
          value={lastAiInv.toLocaleString()}
          icon={<Package className="h-4 w-4" />}
          goodDirection="up"
        />
        <KpiCard
          title="Min Inventory (AI)"
          value={minAiInv.toLocaleString()}
          icon={<Gauge className="h-4 w-4" />}
          goodDirection="up"
        />
        <KpiCard
          title="Inventory Advantage"
          value={`${invAdvantage}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          goodDirection="up"
        />
        <KpiCard
          title="Avg Stockouts (AI)"
          value={aiSummary.avgStockouts.toFixed(0)}
          icon={<RefreshCcw className="h-4 w-4" />}
          goodDirection="down"
        />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Inventory Over Time: AI vs No-AI</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={inventoryChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                <XAxis dataKey="week" stroke="hsl(215, 20%, 65%)" fontSize={12} />
                <YAxis stroke="hsl(215, 20%, 65%)" fontSize={12} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} formatter={(v: number) => v.toLocaleString()} />
                <Legend />
                <ReferenceLine x={data.metadata.disruptionStart + 1} stroke="#EF4444" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="AI Inventory" stroke="#10B981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="No-AI Inventory" stroke="#EF4444" strokeWidth={2} dot={false} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Inventory Confidence Band (AI-Enabled P10–P90)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={invBandData}>
                <defs>
                  <linearGradient id="invBandGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                <XAxis dataKey="week" stroke="hsl(215, 20%, 65%)" fontSize={12} />
                <YAxis stroke="hsl(215, 20%, 65%)" fontSize={12} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} formatter={(v: number) => v.toLocaleString()} />
                <ReferenceLine x={data.metadata.disruptionStart + 1} stroke="#EF4444" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="p90" stroke="none" fill="url(#invBandGrad)" name="P90" />
                <Area type="monotone" dataKey="p10" stroke="none" fill="white" fillOpacity={0} name="P10" />
                <Line type="monotone" dataKey="p50" stroke="#10B981" strokeWidth={2} dot={false} name="Median" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Inventory Distribution by Region</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={regionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                  <XAxis dataKey="region" stroke="hsl(215, 20%, 65%)" fontSize={12} />
                  <YAxis stroke="hsl(215, 20%, 65%)" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} formatter={(v: number) => v.toLocaleString()} />
                  <Bar dataKey="inventory" radius={[4, 4, 0, 0]} name="Inventory Units" fill="#10B981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Lead Time by Supply Chain Stage</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadTimes} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                  <XAxis type="number" stroke="hsl(215, 20%, 65%)" fontSize={12} tickFormatter={v => `${v}d`} />
                  <YAxis dataKey="stage" type="category" stroke="hsl(215, 20%, 65%)" fontSize={11} width={120} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} formatter={(v: number) => `${v} days`} />
                  <Bar dataKey="days" fill="#3B82F6" radius={[0, 4, 4, 0]} name="Days" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Minimum Inventory Across Scenarios</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inventoryComparison} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                <XAxis type="number" stroke="hsl(215, 20%, 65%)" fontSize={11} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <YAxis dataKey="name" type="category" stroke="hsl(215, 20%, 65%)" fontSize={10} width={100} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} formatter={(v: number) => v.toLocaleString()} />
                <Legend />
                <Bar dataKey="AI Min Inv" fill="#10B981" barSize={12} radius={[0, 4, 4, 0]} />
                <Bar dataKey="No-AI Min Inv" fill="#EF4444" barSize={12} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
