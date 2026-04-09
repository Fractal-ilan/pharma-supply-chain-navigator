import { KpiCard } from "@/components/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { timeseriesData } from "@/data/timeseries";
import { calibrationData } from "@/data/calibration";
import { RefreshCcw, Package, Gauge } from "lucide-react";
import {
  Area, AreaChart, Line, Bar, BarChart,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ComposedChart,
} from "recharts";

const ts = timeseriesData;
const last = (arr: number[]) => arr[arr.length - 1];

export default function InventoryPage() {
  const rebalanceData = ts.Rebalance_Actions.map((v, i) => ({
    week: i + 1,
    rebalance: v,
    stockouts: ts.Stockouts[i],
  }));

  const regionData = Object.entries(calibrationData.regional_risk_scores).map(([region, risk]) => ({
    region,
    inventory: Math.round((1 - risk) * 12000 + 3000),
    risk: +(risk * 100).toFixed(0),
  }));

  const efficiency = last(ts.Stockouts) > 0 ? (last(ts.Rebalance_Actions) / last(ts.Stockouts)).toFixed(1) : "N/A";

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Inventory Balancing — Use Case 4</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard title="Rebalance Actions" value={String(last(ts.Rebalance_Actions))} icon={<RefreshCcw className="h-4 w-4" />} goodDirection="neutral" />
        <KpiCard title="Network Inventory" value={last(ts.Total_Inventory).toLocaleString()} icon={<Package className="h-4 w-4" />} goodDirection="up" />
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
                <Bar dataKey="inventory" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Inventory Units" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
