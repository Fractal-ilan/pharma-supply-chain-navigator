import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { scenarioData, scenarioLabels, scenarioColors, TOTAL_WEEKS, last } from "@/data";
import {
  Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Brush,
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WeekRangeSlider, useWeekRange } from "@/components/WeekRangeSlider";
import { KpiCard } from "@/components/KpiCard";

const metrics = [
  { key: "Service_Level", label: "Service Level", fmt: (v: number) => `${(v * 100).toFixed(1)}%` },
  { key: "Total_Inventory", label: "Total Inventory", fmt: (v: number) => v.toLocaleString() },
  { key: "Stockouts", label: "Stockouts", fmt: (v: number) => String(v) },
  { key: "Spoiled_Units", label: "Spoiled Units", fmt: (v: number) => String(v) },
  { key: "Batch_Failure_Rate", label: "Batch Failure Rate", fmt: (v: number) => `${(v * 100).toFixed(1)}%` },
  { key: "Active_Disruptions", label: "Active Disruptions", fmt: (v: number) => String(v) },
] as const;

const scenarioKeys = Object.keys(scenarioData) as (keyof typeof scenarioData)[];

export default function ScenarioPage() {
  const [active, setActive] = useState<Set<string>>(new Set(scenarioKeys));
  const { range, setRange } = useWeekRange(TOTAL_WEEKS);
  const startWeek = range[0];
  const endWeek = range[1] + 1;

  const toggle = (key: string) => {
    const next = new Set(active);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setActive(next);
  };

  const buildChartData = (metricKey: string) => {
    const data = [];
    for (let i = startWeek; i < endWeek; i++) {
      const point: Record<string, number> = { week: i + 1 };
      for (const sk of scenarioKeys) {
        if (active.has(sk)) {
          point[sk] = scenarioData[sk][metricKey][i];
        }
      }
      data.push(point);
    }
    return data;
  };

  // KPI calculations
  const finalWeekIndex = TOTAL_WEEKS - 1;
  const worstServiceLevel = Math.min(
    ...Array.from(active).map((sk) => scenarioData[sk].Service_Level[finalWeekIndex])
  );
  const peakDisruptions = Math.max(
    ...Array.from(active).map((sk) => Math.max(...scenarioData[sk].Active_Disruptions))
  );
  const totalStockouts = Array.from(active).reduce(
    (sum, sk) => sum + scenarioData[sk].Stockouts[finalWeekIndex],
    0
  );

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Scenario Testing — Use Case 2</h2>
      <div className="flex flex-wrap gap-2">
        {scenarioKeys.map((k) => (
          <Button
            key={k}
            variant={active.has(k) ? "default" : "secondary"}
            size="sm"
            onClick={() => toggle(k)}
            style={active.has(k) ? { backgroundColor: scenarioColors[k] } : {}}
          >
            {scenarioLabels[k]}
          </Button>
        ))}
      </div>

      <WeekRangeSlider />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <KpiCard
          title="Worst Service Level"
          value={`${(worstServiceLevel * 100).toFixed(1)}%`}
          icon={null}
          goodDirection="up"
        />
        <KpiCard
          title="Peak Disruptions"
          value={String(Math.round(peakDisruptions))}
          icon={null}
          goodDirection="down"
        />
        <KpiCard
          title="Total Stockouts"
          value={String(Math.round(totalStockouts))}
          icon={null}
          goodDirection="down"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {metrics.map((m) => (
          <Card key={m.key}>
            <CardHeader><CardTitle className="text-sm">{m.label}</CardTitle></CardHeader>
            <CardContent>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={buildChartData(m.key)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 19%, 25%)" />
                    <XAxis dataKey="week" stroke="hsl(215, 20%, 65%)" fontSize={10} />
                    <YAxis stroke="hsl(215, 20%, 65%)" fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(215, 19%, 30%)", borderRadius: 8 }} />
                    {m.key === "Service_Level" && (
                      <Brush dataKey="week" height={20} stroke="hsl(215, 20%, 65%)" />
                    )}
                    {scenarioKeys.filter((k) => active.has(k)).map((k) => (
                      <Line key={k} type="monotone" dataKey={k} stroke={scenarioColors[k]} strokeWidth={1.5} dot={false} name={scenarioLabels[k]} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Summary — Final Week Values</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scenario</TableHead>
                {metrics.map((m) => <TableHead key={m.key}>{m.label}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {scenarioKeys.map((sk) => (
                <TableRow key={sk}>
                  <TableCell className="font-medium" style={{ color: scenarioColors[sk] }}>{scenarioLabels[sk]}</TableCell>
                  {metrics.map((m) => {
                    const arr = scenarioData[sk][m.key];
                    return <TableCell key={m.key}>{m.fmt(arr[arr.length - 1])}</TableCell>;
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
