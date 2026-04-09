import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { scenarioData, scenarioLabels, scenarioColors } from "@/data/scenarios";
import {
  Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

  const toggle = (key: string) => {
    const next = new Set(active);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setActive(next);
  };

  const buildChartData = (metricKey: string) =>
    Array.from({ length: 52 }, (_, i) => {
      const point: Record<string, number> = { week: i + 1 };
      for (const sk of scenarioKeys) {
        if (active.has(sk)) {
          point[sk] = (scenarioData[sk] as Record<string, number[]>)[metricKey][i];
        }
      }
      return point;
    });

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
                    const arr = (scenarioData[sk] as Record<string, number[]>)[m.key];
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
