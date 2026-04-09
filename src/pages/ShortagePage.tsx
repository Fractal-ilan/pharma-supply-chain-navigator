import { KpiCard } from "@/components/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { timeseriesData, calibrationData, aiComparisonData, last } from "@/data";
import { WeekRangeSlider, useWeekRange } from "@/components/WeekRangeSlider";
import { Brain, Package, Target, TrendingUp } from "lucide-react";
import {
  Area, AreaChart, Line, LineChart, Bar, BarChart,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ComposedChart,
} from "recharts";

const ts = timeseriesData;
const cal = calibrationData;
const aiComp = aiComparisonData;
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ShortagePage() {
  const { startWeek, endWeek } = useWeekRange();

  // Slice data for active week range
  const slicedShortage = ts.Shortage_Predictions.slice(startWeek, endWeek);
  const slicedServiceLevel = ts.Service_Level.slice(startWeek, endWeek);
  const slicedInventory = ts.Total_Inventory.slice(startWeek, endWeek);
  const slicedUnfilled = ts.Unfilled_Prescriptions.slice(startWeek, endWeek);

  const dualData = slicedShortage.map((v, i) => ({
    week: startWeek + i + 1,
    predictions: v,
    serviceLevel: slicedServiceLevel[i] * 100,
  }));

  const seasonData = cal.demand_seasonality.map((v, i) => ({
    month: months[i],
    multiplier: v,
  }));

  const aiVsNoAiData = aiComp.ai_enabled.Stockouts.map((aiVal, i) => ({
    week: i + 1,
    ai_enabled: aiVal,
    no_ai: aiComp.no_ai.Stockouts[i],
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Shortage Prediction — Use Case 3</h2>

      <WeekRangeSlider />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Shortage Predictions"
          value={String(Math.round(last(slicedShortage)))}
          icon={<Brain className="h-4 w-4" />}
          goodDirection="neutral"
        />
        <KpiCard
          title="Days of Supply"
          value={`${Math.round(last(slicedInventory) / 1500)} days`}
          icon={<Package className="h-4 w-4" />}
          goodDirection="up"
        />
        <KpiCard
          title="Forecast Accuracy (AI)"
          value={`${((1 - cal.forecast_mape_ai) * 100).toFixed(0)}%`}
          icon={<Target className="h-4 w-4" />}
          goodDirection="up"
        />
        <KpiCard
          title="Unfilled Prescriptions"
          value={String(Math.round(last(slicedUnfilled)))}
          icon={<TrendingUp className="h-4 w-4" />}
          goodDirection="down"
        />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Shortage Predictions vs Service Level</CardTitle></CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dualData}>
                <defs>
                  <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                <XAxis dataKey="week" stroke="hsl(215, 20%, 65%)" fontSize={12} />
                <YAxis yAxisId="left" stroke="#F59E0B" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" domain={[40, 100]} stroke="#3B82F6" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} />
                <Legend />
                <Area yAxisId="left" type="monotone" dataKey="predictions" stroke="#F59E0B" fill="url(#predGrad)" name="Predictions" />
                <Line yAxisId="right" type="monotone" dataKey="serviceLevel" stroke="#3B82F6" strokeWidth={2} dot={false} name="Service Level %" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Shortage Predictions: AI vs No-AI</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={aiVsNoAiData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                <XAxis dataKey="week" stroke="hsl(215, 20%, 65%)" fontSize={12} />
                <YAxis stroke="hsl(215, 20%, 65%)" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} />
                <Legend />
                <Line type="monotone" dataKey="ai_enabled" stroke="#10B981" strokeWidth={2} dot={false} name="AI Enabled" />
                <Line type="monotone" dataKey="no_ai" stroke="#EF4444" strokeWidth={2} dot={false} name="No AI" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Demand Seasonality</CardTitle></CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={seasonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                <XAxis dataKey="month" stroke="hsl(215, 20%, 65%)" fontSize={12} />
                <YAxis domain={[0.7, 1.4]} stroke="hsl(215, 20%, 65%)" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} />
                <Bar dataKey="multiplier" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Demand Multiplier" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
