import { useState } from "react";
import { KpiCard } from "@/components/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WeekRangeSlider, useWeekRange } from "@/components/WeekRangeSlider";
import {
  timeseriesData,
  aiComparisonData,
  TOTAL_WEEKS,
  last,
  avg,
  pctChange,
} from "@/data";
import {
  Activity, AlertTriangle, Users, Thermometer, Brain, ShieldCheck,
  ArrowRight,
} from "lucide-react";
import {
  Area, AreaChart, Line, LineChart, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend,
} from "recharts";

const tiers = [
  { name: "Tier 3", agents: 8, disrupted: 1, color: "bg-blue-900" },
  { name: "Tier 2", agents: 12, disrupted: 3, color: "bg-blue-700" },
  { name: "Tier 1", agents: 6, disrupted: 1, color: "bg-blue-500" },
  { name: "Manufacturer", agents: 4, disrupted: 1, color: "bg-emerald-600" },
  { name: "Distributor", agents: 5, disrupted: 0, color: "bg-amber-600" },
  { name: "Pharmacy", agents: 20, disrupted: 0, color: "bg-amber-500" },
];

export default function OverviewPage() {
  const { range, setRange, sliceArr } = useWeekRange(TOTAL_WEEKS);

  const slicedServiceLevel = sliceArr(timeseriesData.Service_Level);
  const slicedActiveDisruptions = sliceArr(timeseriesData.Active_Disruptions);
  const slicedPatientsServed = sliceArr(timeseriesData.Patients_Served);
  const slicedSpoiledUnits = sliceArr(timeseriesData.Spoiled_Units);
  const slicedShortagePredictions = sliceArr(timeseriesData.Shortage_Predictions);
  const slicedComplianceViolations = sliceArr(timeseriesData.Compliance_Violations);
  const slicedTotalInventory = sliceArr(timeseriesData.Total_Inventory);

  const slChart = slicedServiceLevel.map((v, i) => ({
    week: range[0] + i + 1,
    value: v * 100,
  }));

  const aiChart = slicedServiceLevel.map((_, i) => ({
    week: range[0] + i + 1,
    ai: aiComparisonData.ai_enabled.Service_Level[range[0] + i] * 100,
    noAi: aiComparisonData.no_ai.Service_Level[range[0] + i] * 100,
  }));

  const inventoryChart = slicedTotalInventory.map((v, i) => ({
    week: range[0] + i + 1,
    value: v,
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Time Period</CardTitle></CardHeader>
        <CardContent className="pt-4">
          <WeekRangeSlider totalWeeks={TOTAL_WEEKS} value={range} onChange={setRange} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          title="Service Level"
          value={`${(avg(slicedServiceLevel) * 100).toFixed(1)}%`}
          icon={<Activity className="h-4 w-4" />}
          trend={{ value: pctChange(slicedServiceLevel), direction: pctChange(slicedServiceLevel) >= 0 ? "up" : "down" }}
          goodDirection="up"
          sparklineData={slicedServiceLevel.slice(-12)}
        />
        <KpiCard
          title="Active Disruptions"
          value={String(last(slicedActiveDisruptions))}
          icon={<AlertTriangle className="h-4 w-4" />}
          trend={{ value: Math.abs(pctChange(slicedActiveDisruptions)), direction: pctChange(slicedActiveDisruptions) <= 0 ? "down" : "up" }}
          goodDirection="down"
          sparklineData={slicedActiveDisruptions.slice(-12)}
        />
        <KpiCard
          title="Patients Served"
          value={last(slicedPatientsServed).toLocaleString()}
          icon={<Users className="h-4 w-4" />}
          trend={{ value: pctChange(slicedPatientsServed), direction: "up" }}
          goodDirection="up"
          sparklineData={slicedPatientsServed.slice(-12)}
        />
        <KpiCard
          title="Cold Chain Spoilage"
          value={String(last(slicedSpoiledUnits))}
          icon={<Thermometer className="h-4 w-4" />}
          trend={{ value: Math.abs(pctChange(slicedSpoiledUnits)), direction: pctChange(slicedSpoiledUnits) >= 0 ? "up" : "down" }}
          goodDirection="down"
          sparklineData={slicedSpoiledUnits.slice(-12)}
        />
        <KpiCard
          title="Shortage Predictions"
          value={String(last(slicedShortagePredictions))}
          icon={<Brain className="h-4 w-4" />}
          trend={{ value: Math.abs(pctChange(slicedShortagePredictions)), direction: "up" }}
          goodDirection="neutral"
          sparklineData={slicedShortagePredictions.slice(-12)}
        />
        <KpiCard
          title="Compliance Violations"
          value={String(last(slicedComplianceViolations))}
          icon={<ShieldCheck className="h-4 w-4" />}
          trend={{ value: Math.abs(pctChange(slicedComplianceViolations)), direction: pctChange(slicedComplianceViolations) >= 0 ? "up" : "down" }}
          goodDirection="down"
          sparklineData={slicedComplianceViolations.slice(-12)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Service Level Over Time</CardTitle></CardHeader>
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
                  <YAxis domain={[0, 100]} stroke="hsl(215, 20%, 65%)" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} />
                  <ReferenceLine y={95} stroke="#EF4444" strokeDasharray="5 5" label={{ value: "Target 95%", fill: "#EF4444", fontSize: 11 }} />
                  <Area type="monotone" dataKey="value" stroke="#3B82F6" fill="url(#slGrad)" strokeWidth={2} name="Service Level %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">AI-Enabled vs No-AI</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={aiChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                  <XAxis dataKey="week" stroke="hsl(215, 20%, 65%)" fontSize={12} />
                  <YAxis domain={[40, 100]} stroke="hsl(215, 20%, 65%)" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} />
                  <Legend />
                  <Line type="monotone" dataKey="ai" stroke="#10B981" strokeWidth={2} dot={false} name="AI-Enabled" />
                  <Line type="monotone" dataKey="noAi" stroke="#EF4444" strokeWidth={2} dot={false} name="No AI" strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Inventory Trend</CardTitle></CardHeader>
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
                <YAxis stroke="hsl(215, 20%, 65%)" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} formatter={(v) => [(v as number).toLocaleString(), "Units"]} />
                <Area type="monotone" dataKey="value" stroke="#10B981" fill="url(#invGrad)" strokeWidth={2} name="Total Inventory" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

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
