import { KpiCard } from "@/components/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { timeseriesData } from "@/data/timeseries";
import { aiComparisonData } from "@/data/aiComparison";
import { ShieldCheck, Clock, AlertTriangle, TrendingDown } from "lucide-react";
import {
  Line, LineChart, Bar, BarChart,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend,
} from "recharts";

const ts = timeseriesData;
const last = (arr: number[]) => arr[arr.length - 1];

export default function CompliancePage() {
  const bfrData = ts.Batch_Failure_Rate.map((v, i) => ({
    week: i + 1,
    rate: +(v * 100).toFixed(2),
  }));

  const reviewData = ts.Review_Time_Hours.map((_, i) => ({
    week: i + 1,
    ai: aiComparisonData.ai_enabled.Review_Time_Hours[i],
    noAi: aiComparisonData.no_ai.Review_Time_Hours[i],
  }));

  const violationData = ts.Compliance_Violations.map((v, i) => ({
    week: i + 1,
    violations: v,
  }));

  const aiHours = last(aiComparisonData.ai_enabled.Review_Time_Hours);
  const noAiHours = last(aiComparisonData.no_ai.Review_Time_Hours);
  const savings = ((1 - aiHours / noAiHours) * 100).toFixed(0);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Compliance — Use Case 6</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Batch Failure Rate" value={`${(last(ts.Batch_Failure_Rate) * 100).toFixed(1)}%`} icon={<ShieldCheck className="h-4 w-4" />} goodDirection="down" />
        <KpiCard title="Total Review Time" value={`${last(ts.Review_Time_Hours)}h`} icon={<Clock className="h-4 w-4" />} goodDirection="down" />
        <KpiCard title="Compliance Violations" value={String(last(ts.Compliance_Violations))} icon={<AlertTriangle className="h-4 w-4" />} goodDirection="down" />
        <KpiCard title="Review Time Savings" value={`${savings}%`} icon={<TrendingDown className="h-4 w-4" />} goodDirection="up" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Batch Failure Rate Over Time</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bfrData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                <XAxis dataKey="week" stroke="hsl(215, 20%, 65%)" fontSize={12} />
                <YAxis domain={[0, 8]} stroke="hsl(215, 20%, 65%)" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} />
                <ReferenceLine y={5} stroke="#EF4444" strokeDasharray="5 5" label={{ value: "5% Threshold", fill: "#EF4444", fontSize: 11 }} />
                <Line type="monotone" dataKey="rate" stroke="#3B82F6" strokeWidth={2} dot={false} name="Failure Rate %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Review Time: AI (RbE) vs Manual</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={reviewData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                  <XAxis dataKey="week" stroke="hsl(215, 20%, 65%)" fontSize={12} />
                  <YAxis stroke="hsl(215, 20%, 65%)" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} />
                  <Legend />
                  <Line type="monotone" dataKey="ai" stroke="#10B981" strokeWidth={2} dot={false} name="AI (RbE)" />
                  <Line type="monotone" dataKey="noAi" stroke="#EF4444" strokeWidth={2} dot={false} name="Manual" strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Compliance Violations Timeline</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={violationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                  <XAxis dataKey="week" stroke="hsl(215, 20%, 65%)" fontSize={12} />
                  <YAxis stroke="hsl(215, 20%, 65%)" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} />
                  <Line type="stepAfter" dataKey="violations" stroke="#F59E0B" strokeWidth={2} dot={false} name="Violations" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
