import { KpiCard } from "@/components/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WeekRangeSlider, useWeekRange } from "@/components/WeekRangeSlider";
import { timeseriesData, calibrationData, TOTAL_WEEKS, last } from "@/data";
import { RefreshCcw, Package, Gauge } from "lucide-react";
import {
  Area, AreaChart, Line, Bar, BarChart, Cell,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ComposedChart,
} from "recharts";

export default function InventoryPage() {
  const { range, setRange, sliceArr } = useWeekRange(TOTAL_WEEKS);

  // Slice timeseries data for the selected range
  const slicedRebalance = sliceArr(timeseriesData.Rebalance_Actions);
  const slicedStockouts = sliceArr(timeseriesData.Stockouts);
  const slicedTotal = sliceArr(timeseriesData.Total_Inventory);

  // Rebalancing Activity chart data
  const rebalanceData = slicedRebalance.map((v, i) => ({
    week: range[0] + i + 1,
    rebalance: v,
    stockouts: slicedStockouts[i],
  }));

  // Inventory Distribution by Region (all 9 regions from calibrationData)
  const regionData = Object.entries(calibrationData.regional_risk_scores).map(([region, risk]) => ({
    region,
    inventory: Math.round((1 - risk) * 12000 + 3000),
    risk,
  }));

  // Lead Time by Supply Chain Stage
  const leadTimeData = Object.entries(calibrationData.avg_lead_time_days).map(([stage, days]) => ({
    stage: stage
      .replace(/_/g, " ")
      .split(" ")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    days,
  }));

  // KPIs responding to range
  const lastRebalance = last(slicedRebalance);
  const lastInventory = last(slicedTotal);
  const lastStockouts = slicedStockouts[slicedStockouts.length - 1];
  const efficiency = lastStockouts > 0 ? (lastRebalance / lastStockouts).toFixed(1) : "N/A";

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Inventory Balancing — Use Case 4</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Week Range Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <WeekRangeSlider totalWeeks={TOTAL_WEEKS} value={range} onChange={setRange} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard title="Rebalance Actions" value={String(lastRebalance)} icon={<RefreshCcw className="h-4 w-4" />} goodDirection="neutral" />
        <KpiCard title="Network Inventory" value={lastInventory.toLocaleString()} icon={<Package className="h-4 w-4" />} goodDirection="up" />
        <KpiCard title="Efficiency Ratio" value={String(efficiency)} icon={<Gauge className="h-4 w-4" />} goodDirection="up" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Rebalancing Activity Over Time</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rebalanceData}>
                <defs>
                  <linearGradient id="rebGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                <XAxis dataKey="week" stroke="hsl(215, 20%, 65%)" fontSize={12} />
                <YAxis stroke="hsl(215, 20%, 65%)" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} />
                <Legend />
                <Area type="monotone" dataKey="rebalance" stroke="#10B981" fill="url(#rebGrad)" name="Rebalance Actions" />
                <Line type="monotone" dataKey="stockouts" stroke="#EF4444" strokeWidth={2} dot={false} name="Stockouts" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Inventory Distribution by Region</CardTitle></CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                <XAxis dataKey="region" stroke="hsl(215, 20%, 65%)" fontSize={12} />
                <YAxis stroke="hsl(215, 20%, 65%)" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} />
                <Bar dataKey="inventory" radius={[4, 4, 0, 0]} name="Inventory Units">
                  {regionData.map((d, i) => {
                    const color = d.risk > 0.5 ? "#EF4444" : d.risk > 0.3 ? "#F59E0B" : "#10B981";
                    return <Cell key={i} fill={color} />;
                  })}
                </Bar>
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
              <BarChart data={leadTimeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                <XAxis type="number" stroke="hsl(215, 20%, 65%)" fontSize={12} />
                <YAxis dataKey="stage" type="category" stroke="hsl(215, 20%, 65%)" fontSize={12} width={120} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} />
                <Bar dataKey="days" fill="#3B82F6" radius={[0, 4, 4, 0]} name="Days" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
