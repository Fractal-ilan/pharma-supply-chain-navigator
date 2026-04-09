import { KpiCard } from "@/components/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { timeseriesData } from "@/data/timeseries";
import { aiComparisonData } from "@/data/aiComparison";
import { calibrationData } from "@/data/calibration";
import { Thermometer, AlertTriangle, Brain } from "lucide-react";
import {
  Line, LineChart, Bar, BarChart, Cell,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

const ts = timeseriesData;
const last = (arr: number[]) => arr[arr.length - 1];

export default function ColdChainPage() {
  const spoilData = ts.Spoiled_Units.map((v, i) => ({
    week: i + 1,
    ai: aiComparisonData.ai_enabled.Spoiled_Units[i],
    noAi: aiComparisonData.no_ai.Spoiled_Units[i],
  }));

  const regionRisk = Object.entries(calibrationData.regional_risk_scores)
    .sort((a, b) => b[1] - a[1])
    .map(([region, risk]) => ({ region, risk: +(risk * 100).toFixed(0) }));

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Cold Chain Monitoring — Use Case 5</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard title="Spoiled Units" value={String(last(ts.Spoiled_Units))} icon={<Thermometer className="h-4 w-4" />} goodDirection="down" />
        <KpiCard title="Breach Rate" value={`${(calibrationData.cold_chain_breach_rate * 100).toFixed(0)}%`} icon={<AlertTriangle className="h-4 w-4" />} goodDirection="down" />
        <KpiCard title="AI Mitigation Rate" value="70%" icon={<Brain className="h-4 w-4" />} goodDirection="up" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Cold Chain Spoilage: AI vs No-AI</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spoilData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                <XAxis dataKey="week" stroke="hsl(215, 20%, 65%)" fontSize={12} />
                <YAxis stroke="hsl(215, 20%, 65%)" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} />
                <Legend />
                <Line type="monotone" dataKey="ai" stroke="#10B981" strokeWidth={2} dot={false} name="AI-Enabled" />
                <Line type="monotone" dataKey="noAi" stroke="#EF4444" strokeWidth={2} dot={false} name="No AI" strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Temperature Excursion Risk by Region</CardTitle></CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionRisk} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                <XAxis type="number" domain={[0, 100]} stroke="hsl(215, 20%, 65%)" fontSize={12} />
                <YAxis dataKey="region" type="category" stroke="hsl(215, 20%, 65%)" fontSize={12} width={40} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} />
                <Bar dataKey="risk" name="Risk Score %" radius={[0, 4, 4, 0]}>
                  {regionRisk.map((d, i) => {
                    const color = d.risk > 60 ? "#EF4444" : d.risk > 40 ? "#F59E0B" : "#10B981";
                    return <Cell key={i} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
