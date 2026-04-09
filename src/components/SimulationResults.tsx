"use client";

import React, { useMemo, useState } from "react";
import type { SimulationResult } from "@/lib/pharmaABM";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/KpiCard";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { AlertCircle, TrendingUp, Activity, Package, ShieldAlert, Thermometer, Users, BarChart3 } from "lucide-react";

interface SimulationResultsProps {
  result: SimulationResult | null;
}

const chartConfig = {
  grid: { strokeDasharray: "3 3", stroke: "hsl(215, 19%, 25%)" },
  axis: { stroke: "hsl(215, 20%, 65%)", fontSize: 12 },
  tooltip: {
    contentStyle: {
      backgroundColor: "hsl(217, 33%, 17%)",
      border: "1px solid hsl(215, 19%, 30%)",
      borderRadius: 8,
    },
  },
  colors: {
    blue: "#3B82F6",
    green: "#10B981",
    amber: "#F59E0B",
    red: "#EF4444",
    purple: "#8B5CF6",
  },
};

const phaseColors: Record<string, string> = {
  normal: "#10B981",
  "early-warning": "#F59E0B",
  "disruption-onset": "#FB923C",
  "cascade-propagation": "#EF4444",
  "shortage-crisis": "#7F1D1D",
  intervention: "#8B5CF6",
  recovery: "#3B82F6",
};

export function SimulationResults({ result }: SimulationResultsProps) {
  const [selectedWeek, setSelectedWeek] = useState<number>(0);

  const weeklyData = useMemo(() => {
    if (!result) return [];
    return result.weeklyData.map((snapshot, idx) => ({
      week: idx,
      serviceLevel: snapshot.serviceLevel,
      totalInventory: snapshot.totalInventory,
      stockouts: snapshot.stockouts,
      activeDisruptions: snapshot.activeDisruptions,
      tier1: snapshot.supplyByTier.tier1,
      tier2: snapshot.supplyByTier.tier2,
      tier3: snapshot.supplyByTier.tier3,
      phase: snapshot.phase,
    }));
  }, [result]);

  const minServiceLevel = useMemo(() => {
    if (!result) return { value: "0", week: 0 };
    const min = Math.min(...result.weeklyData.map(s => s.serviceLevel));
    const week = result.weeklyData.findIndex(s => s.serviceLevel === min);
    return { value: min.toFixed(1), week };
  }, [result]);

  const peakStockouts = useMemo(() => {
    if (!result) return 0;
    return Math.max(...result.weeklyData.map(s => s.stockouts));
  }, [result]);

  const recoveryWeek = useMemo(() => {
    if (!result) return 0;
    const idx = result.weeklyData.findIndex(
      s => s.serviceLevel >= 95 && s.phase === "recovery"
    );
    return idx >= 0 ? idx : result.weeklyData.length - 1;
  }, [result]);

  const agentSnapshot = useMemo(() => {
    if (!result?.agentSnapshots || result.agentSnapshots.length === 0) return null;
    const weeks = result.agentSnapshots.map((_, i) => i * 4);
    return { weeks, data: result.agentSnapshots };
  }, [result]);

  const networkData = useMemo(() => {
    if (!result?.agentSnapshots || result.agentSnapshots.length === 0) return null;
    const snap = result.agentSnapshots[result.agentSnapshots.length - 1];
    return {
      tier3: {
        count: snap.suppliers.filter(s => s.tier === "tier3" || s.tier === "3").length,
        disrupted: snap.suppliers.filter(s => (s.tier === "tier3" || s.tier === "3") && s.disrupted).length,
      },
      tier2: {
        count: snap.suppliers.filter(s => s.tier === "tier2" || s.tier === "2").length,
        disrupted: snap.suppliers.filter(s => (s.tier === "tier2" || s.tier === "2") && s.disrupted).length,
      },
      tier1: {
        count: snap.suppliers.filter(s => s.tier === "tier1" || s.tier === "1").length,
        disrupted: snap.suppliers.filter(s => (s.tier === "tier1" || s.tier === "1") && s.disrupted).length,
      },
      mfg: {
        count: snap.manufacturers.length,
        failed: snap.manufacturers.filter(m => (m.batchesFailed || 0) > 0).length,
      },
      dist: {
        count: snap.distributors.length,
        lowService: snap.distributors.filter(d => (d.serviceLevel || 0) < 95).length,
      },
    };
  }, [result]);

  const phaseTimeline = useMemo(() => {
    if (!result) return [];
    const phases: Array<{ phase: string; start: number; weeks: number; color: string }> = [];
    let currentPhase = result.weeklyData[0].phase;
    let phaseStart = 0;

    for (let i = 1; i < result.weeklyData.length; i++) {
      if (result.weeklyData[i].phase !== currentPhase) {
        phases.push({
          phase: currentPhase,
          start: phaseStart,
          weeks: i - phaseStart,
          color: phaseColors[currentPhase] || "#9CA3AF",
        });
        currentPhase = result.weeklyData[i].phase;
        phaseStart = i;
      }
    }
    phases.push({
      phase: currentPhase,
      start: phaseStart,
      weeks: result.weeklyData.length - phaseStart,
      color: phaseColors[currentPhase] || "#9CA3AF",
    });

    return phases;
  }, [result]);

  if (!result) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">
            Configure and run a simulation to see results
          </p>
        </div>
      </div>
    );
  }

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="monte-carlo" disabled={!result.monteCarlo}>
          Monte Carlo
        </TabsTrigger>
        <TabsTrigger value="agents" disabled={!result.agentSnapshots}>
          Agents
        </TabsTrigger>
        <TabsTrigger value="network" disabled={!networkData}>
          Network
        </TabsTrigger>
      </TabsList>

      {/* ===== OVERVIEW TAB ===== */}
      <TabsContent value="overview" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard
            title="Min Service Level"
            value={`${minServiceLevel.value}%`}
            icon={<Activity className="h-4 w-4" />}
          />
          <KpiCard
            title="Peak Stockouts"
            value={peakStockouts.toString()}
            icon={<Package className="h-4 w-4" />}
          />
          <KpiCard
            title="Recovery Week"
            value={recoveryWeek.toString()}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <KpiCard
            title="Total Spoiled Units"
            value={result.summary.totalSpoiledUnits.toString()}
            icon={<Thermometer className="h-4 w-4" />}
          />
          <KpiCard
            title="Compliance Violations"
            value={result.summary.complianceViolationsTotal.toString()}
            icon={<ShieldAlert className="h-4 w-4" />}
          />
          <KpiCard
            title="Est. Patient Impact"
            value={Math.round(result.summary.estimatedPatientImpact).toString()}
            icon={<Users className="h-4 w-4" />}
          />
        </div>

        {/* Main Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Service Level Over Time */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Service Level Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={weeklyData}>
                  <defs>
                    <linearGradient id="colorService" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...chartConfig.grid} />
                  <XAxis {...chartConfig.axis} dataKey="week" />
                  <YAxis {...chartConfig.axis} domain={[0, 100]} />
                  <Tooltip {...chartConfig.tooltip} />
                  <ReferenceLine y={95} stroke="#10B981" strokeDasharray="5 5" label="Target (95%)" />
                  <Area
                    type="monotone"
                    dataKey="serviceLevel"
                    stroke="#3B82F6"
                    fillOpacity={1}
                    fill="url(#colorService)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Inventory Trend */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Inventory Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={weeklyData}>
                  <defs>
                    <linearGradient id="colorInventory" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...chartConfig.grid} />
                  <XAxis {...chartConfig.axis} dataKey="week" />
                  <YAxis {...chartConfig.axis} />
                  <Tooltip {...chartConfig.tooltip} />
                  <Area
                    type="monotone"
                    dataKey="totalInventory"
                    stroke="#10B981"
                    fillOpacity={1}
                    fill="url(#colorInventory)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Supply by Tier */}
          <Card className="col-span-1 lg:col-span-2">
            <CardHeader>
              <CardTitle>Supply by Tier</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={weeklyData}>
                  <CartesianGrid {...chartConfig.grid} />
                  <XAxis {...chartConfig.axis} dataKey="week" />
                  <YAxis {...chartConfig.axis} />
                  <Tooltip {...chartConfig.tooltip} />
                  <Legend />
                  <Area type="monotone" dataKey="tier3" stackId="1" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.6} name="Tier 3" />
                  <Area type="monotone" dataKey="tier2" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.6} name="Tier 2" />
                  <Area type="monotone" dataKey="tier1" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} name="Tier 1" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Disruptions & Stockouts */}
          <Card className="col-span-1 lg:col-span-2">
            <CardHeader>
              <CardTitle>Active Disruptions & Stockouts</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={weeklyData}>
                  <CartesianGrid {...chartConfig.grid} />
                  <XAxis {...chartConfig.axis} dataKey="week" />
                  <YAxis {...chartConfig.axis} />
                  <Tooltip {...chartConfig.tooltip} />
                  <Legend />
                  <Bar dataKey="stockouts" fill="#EF4444" name="Stockouts" />
                  <Line type="monotone" dataKey="activeDisruptions" stroke="#F59E0B" name="Active Disruptions" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Phase Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Crisis Phase Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 h-16 items-center overflow-x-auto">
              {phaseTimeline.map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center"
                  style={{ minWidth: `${(p.weeks / result.weeklyData.length) * 80}%` }}
                >
                  <div
                    className="h-10 flex items-center justify-center text-white text-xs font-semibold rounded"
                    style={{ backgroundColor: p.color, width: "100%", opacity: 0.9 }}
                  >
                    {p.phase} ({p.weeks}w)
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2">
              {Object.entries(phaseColors).map(([phase, color]) => (
                <div key={phase} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                  <span className="text-muted-foreground capitalize">{phase.replace("-", " ")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ===== MONTE CARLO TAB ===== */}
      <TabsContent value="monte-carlo" className="space-y-6">
        {result.monteCarlo && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <KpiCard
                title="Avg Peak Stockouts"
                value={result.monteCarlo.avgPeakStockouts.toFixed(1)}
                icon={<Package className="h-4 w-4" />}
              />
              <KpiCard
                title="Avg Recovery Week"
                value={result.monteCarlo.avgRecoveryWeek.toFixed(1)}
                icon={<TrendingUp className="h-4 w-4" />}
              />
              <KpiCard
                title="Avg Min Service Level"
                value={`${result.monteCarlo.avgMinServiceLevel.toFixed(1)}%`}
                icon={<Activity className="h-4 w-4" />}
              />
              <KpiCard
                title="Monte Carlo Runs"
                value={result.monteCarlo.serviceLevelPercentiles.length > 0 ? "Complete" : "N/A"}
                icon={<BarChart3 className="h-4 w-4" />}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Service Level Percentile Bands */}
              <Card className="col-span-1 lg:col-span-2">
                <CardHeader>
                  <CardTitle>Service Level Percentile Bands</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={result.monteCarlo.serviceLevelPercentiles}>
                      <defs>
                        <linearGradient id="p5p95" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...chartConfig.grid} />
                      <XAxis {...chartConfig.axis} dataKey="week" />
                      <YAxis {...chartConfig.axis} domain={[0, 100]} />
                      <Tooltip {...chartConfig.tooltip} />
                      <Area type="monotone" dataKey="p95" stroke="#3B82F6" fill="url(#p5p95)" fillOpacity={0.3} name="p95" />
                      <Area type="monotone" dataKey="p75" stroke="#3B82F6" fill="url(#p5p95)" fillOpacity={0.2} name="p75" />
                      <Line type="monotone" dataKey="p50" stroke="#3B82F6" strokeWidth={2} dot={false} name="Median" />
                      <Area type="monotone" dataKey="p25" stroke="#3B82F6" fill="none" strokeDasharray="3 3" name="p25" />
                      <Area type="monotone" dataKey="p5" stroke="#3B82F6" fill="none" strokeDasharray="3 3" name="p5" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Inventory Percentile Bands */}
              <Card className="col-span-1 lg:col-span-2">
                <CardHeader>
                  <CardTitle>Inventory Percentile Bands</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={result.monteCarlo.inventoryPercentiles}>
                      <defs>
                        <linearGradient id="invp5p95" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...chartConfig.grid} />
                      <XAxis {...chartConfig.axis} dataKey="week" />
                      <YAxis {...chartConfig.axis} />
                      <Tooltip {...chartConfig.tooltip} />
                      <Area type="monotone" dataKey="p95" stroke="#10B981" fill="url(#invp5p95)" fillOpacity={0.3} name="p95" />
                      <Line type="monotone" dataKey="p50" stroke="#10B981" strokeWidth={2} dot={false} name="Median" />
                      <Area type="monotone" dataKey="p5" stroke="#10B981" fill="none" strokeDasharray="3 3" name="p5" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Peak Stockout Distribution */}
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Peak Stockout Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={result.monteCarlo.peakStockoutDistribution}>
                      <CartesianGrid {...chartConfig.grid} />
                      <XAxis {...chartConfig.axis} dataKey="stockouts" />
                      <YAxis {...chartConfig.axis} />
                      <Tooltip {...chartConfig.tooltip} />
                      <Bar dataKey="frequency" fill="#EF4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Recovery Week Distribution */}
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Recovery Week Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={result.monteCarlo.recoveryWeekDistribution}>
                      <CartesianGrid {...chartConfig.grid} />
                      <XAxis {...chartConfig.axis} dataKey="week" />
                      <YAxis {...chartConfig.axis} />
                      <Tooltip {...chartConfig.tooltip} />
                      <Bar dataKey="frequency" fill="#3B82F6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </TabsContent>

      {/* ===== AGENTS TAB ===== */}
      <TabsContent value="agents" className="space-y-6">
        {agentSnapshot && (
          <>
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Select Snapshot Week</h3>
              <Select value={selectedWeek.toString()} onValueChange={(v) => setSelectedWeek(parseInt(v))}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {agentSnapshot.weeks.map((w, idx) => (
                    <SelectItem key={idx} value={idx.toString()}>
                      Week {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {agentSnapshot.data[selectedWeek] && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Supplier Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Tier</TableHead>
                            <TableHead>Region</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Capacity %</TableHead>
                            <TableHead>Risk Score</TableHead>
                            <TableHead>Inventory</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {agentSnapshot.data[selectedWeek].suppliers.map((s, idx) => (
                            <TableRow key={idx} className={s.disrupted ? "bg-destructive/10" : ""}>
                              <TableCell className="font-medium">{s.name}</TableCell>
                              <TableCell>{s.tier}</TableCell>
                              <TableCell>{s.region || "N/A"}</TableCell>
                              <TableCell>
                                {s.disrupted ? (
                                  <Badge variant="destructive">Disrupted</Badge>
                                ) : (
                                  <Badge variant="outline">Normal</Badge>
                                )}
                              </TableCell>
                              <TableCell>{((s.capacity || 0) / 10).toFixed(0)}%</TableCell>
                              <TableCell>{(s.riskScore || 0).toFixed(2)}</TableCell>
                              <TableCell>{s.inventory || 0}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Manufacturer Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                          data={agentSnapshot.data[selectedWeek].manufacturers.map((m) => ({
                            name: m.name,
                            produced: m.batchesProduced || 0,
                            failed: m.batchesFailed || 0,
                          }))}
                        >
                          <CartesianGrid {...chartConfig.grid} />
                          <XAxis {...chartConfig.axis} dataKey="name" angle={-45} textAnchor="end" height={80} />
                          <YAxis {...chartConfig.axis} />
                          <Tooltip {...chartConfig.tooltip} />
                          <Legend />
                          <Bar dataKey="produced" fill="#10B981" name="Produced" />
                          <Bar dataKey="failed" fill="#EF4444" name="Failed" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Distributor Service Levels</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                          data={agentSnapshot.data[selectedWeek].distributors.map((d) => ({
                            name: d.name,
                            serviceLevel: (d.serviceLevel || 0) * 100,
                          }))}
                          layout="vertical"
                        >
                          <CartesianGrid {...chartConfig.grid} />
                          <XAxis type="number" {...chartConfig.axis} domain={[0, 100]} />
                          <YAxis type="category" dataKey="name" {...chartConfig.axis} width={100} />
                          <Tooltip {...chartConfig.tooltip} />
                          <Bar dataKey="serviceLevel" fill="#3B82F6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </>
        )}
      </TabsContent>

      {/* ===== NETWORK TAB ===== */}
      <TabsContent value="network" className="space-y-6">
        {networkData && (
          <Card>
            <CardHeader>
              <CardTitle>Supply Chain Network Topology</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto py-8">
                <div className="flex items-center justify-between min-w-max gap-8 px-4">
                  {[
                    { label: "Tier 3", data: networkData.tier3, color: "purple", sub: "suppliers" },
                    { label: "Tier 2", data: networkData.tier2, color: "amber", sub: "suppliers" },
                    { label: "Tier 1", data: networkData.tier1, color: "blue", sub: "suppliers" },
                  ].map((tier, i) => (
                    <React.Fragment key={tier.label}>
                      {i > 0 && <div className="text-2xl text-muted-foreground">→</div>}
                      <div className="flex flex-col items-center">
                        <div className={`w-20 h-20 rounded-lg bg-${tier.color}-600/20 border-2 border-${tier.color}-600 flex items-center justify-center`}>
                          <div className="text-center">
                            <div className="text-2xl font-bold">{tier.data.count}</div>
                            <div className="text-xs text-muted-foreground">{tier.sub}</div>
                          </div>
                        </div>
                        {tier.data.disrupted > 0 && (
                          <Badge variant="destructive" className="mt-2">{tier.data.disrupted} disrupted</Badge>
                        )}
                        <div className="text-xs text-muted-foreground mt-2 text-center">{tier.label}</div>
                      </div>
                    </React.Fragment>
                  ))}

                  <div className="text-2xl text-muted-foreground">→</div>
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-20 rounded-lg bg-green-600/20 border-2 border-green-600 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-400">{networkData.mfg.count}</div>
                        <div className="text-xs text-muted-foreground">mfg</div>
                      </div>
                    </div>
                    {networkData.mfg.failed > 0 && (
                      <Badge variant="destructive" className="mt-2">{networkData.mfg.failed} failed</Badge>
                    )}
                    <div className="text-xs text-muted-foreground mt-2 text-center">Manufacturing</div>
                  </div>

                  <div className="text-2xl text-muted-foreground">→</div>
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-20 rounded-lg bg-cyan-600/20 border-2 border-cyan-600 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-cyan-400">{networkData.dist.count}</div>
                        <div className="text-xs text-muted-foreground">dist</div>
                      </div>
                    </div>
                    {networkData.dist.lowService > 0 && (
                      <Badge variant="destructive" className="mt-2">{networkData.dist.lowService} low SL</Badge>
                    )}
                    <div className="text-xs text-muted-foreground mt-2 text-center">Distribution</div>
                  </div>

                  <div className="text-2xl text-muted-foreground">→</div>
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-20 rounded-lg bg-rose-600/20 border-2 border-rose-600 flex items-center justify-center">
                      <div className="text-center">
                        <TrendingUp className="w-8 h-8 text-rose-400 mx-auto mb-1" />
                        <div className="text-xs text-muted-foreground">pharmacy</div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-8">End Points</div>
                  </div>
                </div>
              </div>

              <div className="mt-8 p-4 bg-muted/50 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Total Suppliers</div>
                    <div className="text-xl font-semibold">
                      {networkData.tier1.count + networkData.tier2.count + networkData.tier3.count}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Disrupted</div>
                    <div className="text-xl font-semibold text-destructive">
                      {networkData.tier1.disrupted + networkData.tier2.disrupted + networkData.tier3.disrupted}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Manufacturing</div>
                    <div className="text-xl font-semibold">{networkData.mfg.count}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Distribution</div>
                    <div className="text-xl font-semibold">{networkData.dist.count}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}
