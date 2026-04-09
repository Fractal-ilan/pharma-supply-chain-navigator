import { KpiCard } from "@/components/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WeekRangeSlider, useWeekRange } from "@/components/WeekRangeSlider";
import { timeseriesData, aiComparisonData, calibrationData, TOTAL_WEEKS, last } from "@/data";
import { ShieldCheck, Clock, AlertTriangle, TrendingDown } from "lucide-react";
import {
  Line, LineChart, Bar, BarChart,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend,
} from "recharts";

export default function CompliancePage() {
  const { range, setRange, sliceArr } = useWeekRange(TOTAL_WEEKS);

  // Slice timeseries data for the selected range
  const slicedBFR = sliceArr(timeseriesData.Batch_Failure_Rate);
  const slicedReview = sliceArr(timeseriesData.Review_Time_Hours);
  const slicedViolations = sliceArr(timeseriesData.Compliance_Violations);
  const slicedAiReview = sliceArr(aiComparisonData.ai_enabled.Review_Time_Hours);
  const slicedNoAiReview = sliceArr(aiComparisonData.no_ai.Review_Time_Hours);

  // Batch Failure Rate chart data
  const bfrData = slicedBFR.map((v, i) => ({
    week: range[0] + i + 1,
    rate: +(v * 100).toFixed(2),
  }));

  // Review Time chart data
  const reviewData = slicedReview.map((_, i) => ({
    week: range[0] + i + 1,
    ai: slicedAiReview[i],
    noAi: slicedNoAiReview[i],
  }));

  // Compliance Violations chart data
  const violationData = slicedViolations.map((v, i) => ({
    week: range[0] + i + 1,
    violations: v,
  }));

  // Event Risk Profile (Radar chart)
  const radarData = Object.entries(calibrationData.event_probabilities).map(([event, prob]) => ({
    event: event
      .replace(/_/g, " ")
      .split(" ")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    probability: +(prob * 100).toFixed(1),
  }));

  // KPIs responding to range
  const lastBFR = last(slicedBFR);
  const lastReview = last(slicedReview);
  const lastViolations = last(slicedViolations);
  const lastAiReview = last(slicedAiReview);
  const lastNoAiReview = last(slicedNoAiReview);
  const reviewSavings = lastNoAiReview > 0 ? ((1 - lastAiReview / lastNoAiReview) * 100).toFixed(0) : "0";

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Compliance — Use Case 6</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Week Range Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <WeekRangeSlider totalWeeks={TOTAL_WEEKS} value={range} onChange={setRange} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Batch Failure Rate" value={`${(lastBFR * 100).toFixed(1)}%`} icon={<ShieldCheck className="h-4 w-4" />} goodDirection="down" />
        <KpiCard title="Total Review Time" value={`${lastReview}h`} icon={<Clock className="h-4 w-4" />} goodDirection="down" />
        <KpiCard title="Compliance Violations" value={String(lastViolations)} icon={<AlertTriangle className="h-4 w-4" />} goodDirection="down" />
        <KpiCard title="Review Time Savings" value={`${reviewSavings}%`} icon={<TrendingDown className="h-4 w-4" />} goodDirection="up" />
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

      <Card>
        <CardHeader><CardTitle className="text-base">Event Risk Profile</CardTitle></CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(215, 19%, 25%)" />
                <PolarAngleAxis dataKey="event" stroke="hsl(215, 20%, 65%)" fontSize={11} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="hsl(215, 20%, 65%)" fontSize={10} />
                <Radar name="Probability %" dataKey="probability" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.3} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
