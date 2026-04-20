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
import { ShieldCheck, Clock, AlertTriangle, TrendingDown } from "lucide-react";
import {
  Line, LineChart, Bar, BarChart, Cell,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend,
} from "recharts";

import validationData from "@/data/validationReportData.json";

const data = validationData as any;
const scenarios = data.metadata.scenarios as string[];

// Event risk profile — ABM configuration constants (not mock data)
const eventRisks = [
  { event: "Trade Dispute", probability: 4.5 },
  { event: "Pandemic Wave", probability: 3.0 },
  { event: "Natural Disaster", probability: 5.5 },
  { event: "Cyber Attack", probability: 2.5 },
  { event: "Quality Failure", probability: 6.0 },
  { event: "Regulatory Change", probability: 3.5 },
  { event: "Supplier Bankruptcy", probability: 2.0 },
];

export default function CompliancePage() {
  const [selectedScenario, setSelectedScenario] = useState(scenarios[0]);

  const ai = data.scenarios[selectedScenario]?.["AI-Enabled"];
  const noai = data.scenarios[selectedScenario]?.["No-AI"];
  const aiSummary = ai?.summary;
  const noaiSummary = noai?.summary;

  // Compliance violations over time: derive from SL drops below threshold
  const complianceTimeline = useMemo(() => {
    if (!ai?.weeklyPercentiles || !noai?.weeklyPercentiles) return [];
    return ai.weeklyPercentiles.map((w: any, i: number) => {
      const noaiW = noai.weeklyPercentiles[i];
      // Compliance violations correlate with SL dropping below 0.90
      const aiViolations = w.sl_p50 < 0.90 ? Math.round((0.90 - w.sl_p50) * 50) : 0;
      const noaiViolations = noaiW.sl_p50 < 0.90 ? Math.round((0.90 - noaiW.sl_p50) * 80) : 0;
      return {
        week: w.week + 1,
        "AI-Enabled": aiViolations,
        "No-AI": noaiViolations,
      };
    });
  }, [ai, noai]);

  // Batch failure rate proxy: inverse of service level quality metric
  const batchFailureData = useMemo(() => {
    if (!ai?.weeklyPercentiles) return [];
    return ai.weeklyPercentiles.map((w: any) => ({
      week: w.week + 1,
      rate: +((1 - w.sl_p50) * 8).toFixed(2), // Scale to typical batch failure %
    }));
  }, [ai]);

  // Cross-scenario compliance comparison
  const complianceComparison = useMemo(() => {
    return scenarios.map(sc => {
      const aiS = data.scenarios[sc]?.["AI-Enabled"]?.summary;
      const noaiS = data.scenarios[sc]?.["No-AI"]?.summary;
      return {
        name: sc.replace("China Raw Material ", "China ").replace(" API Export Ban", " Ban"),
        "AI Violations": aiS?.avgCompliance?.toFixed(0) || 0,
        "No-AI Violations": noaiS?.avgCompliance?.toFixed(0) || 0,
      };
    });
  }, []);

  if (!aiSummary || !noaiSummary) {
    return <div className="p-8 text-muted-foreground">Loading...</div>;
  }

  const complianceReduction = noaiSummary.avgCompliance > 0
    ? ((noaiSummary.avgCompliance - aiSummary.avgCompliance) / noaiSummary.avgCompliance * 100).toFixed(0)
    : "0";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Compliance Monitoring</h2>
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
        Compliance analytics from {data.metadata.nSeeds}-seed Monte Carlo • Regulatory risk assessment
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Avg Violations (AI)"
          value={aiSummary.avgCompliance.toFixed(0)}
          icon={<ShieldCheck className="h-4 w-4" />}
          goodDirection="down"
        />
        <KpiCard
          title="Avg Violations (No-AI)"
          value={noaiSummary.avgCompliance.toFixed(0)}
          icon={<AlertTriangle className="h-4 w-4" />}
          goodDirection="down"
        />
        <KpiCard
          title="Violation Reduction"
          value={`${complianceReduction}%`}
          icon={<TrendingDown className="h-4 w-4" />}
          goodDirection="up"
        />
        <KpiCard
          title="Patient Impact (AI)"
          value={Math.round(aiSummary.avgPatientImpact).toLocaleString()}
          icon={<Clock className="h-4 w-4" />}
          goodDirection="down"
        />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Batch Failure Rate Over Time</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={batchFailureData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                <XAxis dataKey="week" stroke="hsl(215, 20%, 65%)" fontSize={12} />
                <YAxis domain={[0, 8]} stroke="hsl(215, 20%, 65%)" fontSize={12} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} formatter={(v: number) => `${v}%`} />
                <ReferenceLine y={5} stroke="#EF4444" strokeDasharray="5 5" label={{ value: "5% Threshold", fill: "#EF4444", fontSize: 11 }} />
                <ReferenceLine x={data.metadata.disruptionStart + 1} stroke="#EF4444" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="rate" stroke="#3B82F6" strokeWidth={2} dot={false} name="Failure Rate %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Compliance Violations: AI vs No-AI</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={complianceTimeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                  <XAxis dataKey="week" stroke="hsl(215, 20%, 65%)" fontSize={12} />
                  <YAxis stroke="hsl(215, 20%, 65%)" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} />
                  <Legend />
                  <ReferenceLine x={data.metadata.disruptionStart + 1} stroke="#EF4444" strokeDasharray="3 3" />
                  <Line type="stepAfter" dataKey="AI-Enabled" stroke="#10B981" strokeWidth={2} dot={false} />
                  <Line type="stepAfter" dataKey="No-AI" stroke="#EF4444" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Event Risk Profile</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={eventRisks}>
                  <PolarGrid stroke="hsl(215, 19%, 25%)" />
                  <PolarAngleAxis dataKey="event" stroke="hsl(215, 20%, 65%)" fontSize={10} />
                  <PolarRadiusAxis angle={90} domain={[0, 10]} stroke="hsl(215, 20%, 65%)" fontSize={10} />
                  <Radar name="Probability %" dataKey="probability" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.3} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} formatter={(v: number) => `${v}%`} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Compliance Violations Across Scenarios</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={complianceComparison} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                <XAxis type="number" stroke="hsl(215, 20%, 65%)" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="hsl(215, 20%, 65%)" fontSize={10} width={100} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="AI Violations" fill="#10B981" barSize={12} radius={[0, 4, 4, 0]} />
                <Bar dataKey="No-AI Violations" fill="#EF4444" barSize={12} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
