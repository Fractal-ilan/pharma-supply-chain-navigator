import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Brain, AlertTriangle, Activity } from "lucide-react";

// ─── Tier definitions ───
const TIERS = [
  { id: "T3", name: "Tier 3", subtitle: "Raw Materials", regions: "CN, IN, BR", agents: 10, leadWeeks: 4,
    color: "#ef4444", bgColor: "#fef2f2", examples: "Chemical compounds, Solvents, Excipients" },
  { id: "T2", name: "Tier 2", subtitle: "API Manufacturing", regions: "IN, CN, IL", agents: 15, leadWeeks: 3,
    color: "#f59e0b", bgColor: "#fffbeb", examples: "Active Pharmaceutical Ingredients" },
  { id: "T1", name: "Tier 1", subtitle: "Formulation", regions: "IN, IE, US, CH, DE", agents: 5, leadWeeks: 2,
    color: "#3B82F6", bgColor: "#eff6ff", examples: "Finished dosage forms" },
  { id: "MFG", name: "Manufacturing", subtitle: "", regions: "US, IE, CH", agents: 3, leadWeeks: null,
    color: "#8B5CF6", bgColor: "#f5f3ff", examples: "Batch processing, Quality control" },
  { id: "DIST", name: "Distribution", subtitle: "", regions: "Regional hubs", agents: 6, leadWeeks: null,
    color: "#10B981", bgColor: "#ecfdf5", examples: "Cold chain logistics" },
  { id: "RX", name: "Pharmacy", subtitle: "", regions: "Local", agents: 20, leadWeeks: null,
    color: "#06B6D4", bgColor: "#ecfeff", examples: "Patient demand fulfillment" },
];

// ─── AI intervention points (tier index) ───
const AI_POINTS = [
  { tierIdx: 0, label: "AI detects demand signals" },
  { tierIdx: 3, label: "AI adjusts reorder points" },
  { tierIdx: 4, label: "AI rebalances inventory" },
];

// ─── Scenario data ───
const SCENARIOS = [
  { id: "none", name: "No Disruption", color: "#6b7280",
    multipliers: { T3: 1.0, T2: 1.0, T1: 1.0, MFG: 1.0, DIST: 1.0, RX: 1.0 },
    severity: "None", startWeek: 0, duration: 0, affectedTiers: [] },
  { id: "india", name: "India API Export Ban", color: "#ef4444",
    multipliers: { T3: 2.0, T2: 2.5, T1: 1.3, MFG: 1.0, DIST: 1.0, RX: 1.0 },
    severity: "High", startWeek: 4, duration: 20, affectedTiers: ["T3", "T2", "T1"] },
  { id: "china", name: "China Raw Material Lockdown", color: "#f59e0b",
    multipliers: { T3: 3.0, T2: 1.8, T1: 1.5, MFG: 1.0, DIST: 1.0, RX: 1.0 },
    severity: "High", startWeek: 14, duration: 14, affectedTiers: ["T3", "T2", "T1"] },
  { id: "hurricane", name: "US Hurricane", color: "#3B82F6",
    multipliers: { T3: 1.0, T2: 1.0, T1: 1.3, MFG: 1.0, DIST: 1.0, RX: 1.0 },
    severity: "Medium", startWeek: 8, duration: 8, affectedTiers: ["T1", "DIST"] },
  { id: "cyber", name: "Cyber Attack", color: "#8B5CF6",
    multipliers: { T3: 1.0, T2: 1.0, T1: 1.1, MFG: 1.0, DIST: 1.0, RX: 1.0 },
    severity: "Low", startWeek: 2, duration: 4, affectedTiers: ["T1", "MFG"] },
  { id: "quality", name: "Quality Crisis", color: "#22c55e",
    multipliers: { T3: 1.2, T2: 2.0, T1: 1.5, MFG: 1.0, DIST: 1.0, RX: 1.0 },
    severity: "Extended", startWeek: 20, duration: 24, affectedTiers: ["T2", "T1"] },
];

const severityColors: Record<string, string> = {
  None: "#6b7280", High: "#ef4444", Medium: "#f59e0b", Low: "#22c55e", Extended: "#8B5CF6",
};

export default function SupplyChainFlowPage() {
  const [selectedScenario, setSelectedScenario] = useState("none");
  const scenario = useMemo(
    () => SCENARIOS.find(s => s.id === selectedScenario) || SCENARIOS[0],
    [selectedScenario]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supply Chain Flow</h1>
          <p className="text-sm text-gray-500 mt-1">
            6-tier agent-based model with AI intervention points and scenario-specific disruptions
          </p>
        </div>
        <Select value={selectedScenario} onValueChange={setSelectedScenario}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select scenario" />
          </SelectTrigger>
          <SelectContent>
            {SCENARIOS.map(s => (
              <SelectItem key={s.id} value={s.id}>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                  {s.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Scenario info banner */}
      {selectedScenario !== "none" && (
        <Card className="border-l-4" style={{ borderLeftColor: scenario.color }}>
          <CardContent className="py-3 flex flex-wrap gap-6 text-sm">
            <div><span className="text-gray-500">Severity:</span>{" "}
              <span className="font-semibold" style={{ color: severityColors[scenario.severity] }}>
                {scenario.severity}
              </span>
            </div>
            <div><span className="text-gray-500">Starts:</span> <span className="font-semibold">Week {scenario.startWeek}</span></div>
            <div><span className="text-gray-500">Duration:</span> <span className="font-semibold">{scenario.duration} weeks</span></div>
            <div><span className="text-gray-500">Ends:</span> <span className="font-semibold">Week {scenario.startWeek + scenario.duration}</span></div>
          </CardContent>
        </Card>
      )}

      {/* Flow diagram */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Supply Chain Architecture</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-1 overflow-x-auto pb-4">
            {TIERS.map((tier, i) => {
              const mult = scenario.multipliers[tier.id as keyof typeof scenario.multipliers] || 1.0;
              const isAffected = scenario.affectedTiers.includes(tier.id);
              const hasAI = AI_POINTS.some(a => a.tierIdx === i);
              const aiLabel = AI_POINTS.find(a => a.tierIdx === i)?.label;

              return (
                <div key={tier.id} className="flex items-center">
                  <div className="flex flex-col items-center" style={{ minWidth: 140 }}>
                    {/* AI intervention marker */}
                    {hasAI && (
                      <div className="mb-2 px-2 py-1 rounded-md text-xs font-semibold text-green-700 bg-green-50 border border-green-200 text-center flex items-center gap-1">
                        <Brain className="w-3 h-3" />
                        <span>{aiLabel}</span>
                      </div>
                    )}
                    {!hasAI && <div className="mb-2 h-7" />}

                    {/* Tier card */}
                    <div
                      className="rounded-lg border-2 w-full overflow-hidden transition-all duration-300"
                      style={{
                        borderColor: isAffected ? scenario.color : tier.color,
                        boxShadow: isAffected ? `0 0 12px ${scenario.color}40` : "none",
                      }}
                    >
                      {/* Header */}
                      <div className="px-3 py-2 text-center" style={{ backgroundColor: isAffected ? scenario.color : tier.color }}>
                        <div className="text-white font-bold text-xs">{tier.name}</div>
                        {tier.subtitle && <div className="text-white text-xs opacity-80">{tier.subtitle}</div>}
                      </div>

                      {/* Body */}
                      <div className="px-3 py-2 text-center" style={{ backgroundColor: tier.bgColor }}>
                        <div className="text-xs text-gray-600 italic">{tier.examples}</div>
                        <div className="text-xs text-gray-400 mt-1">{tier.regions}</div>
                        <div className="text-xs font-bold mt-1" style={{ color: tier.color }}>
                          {tier.agents} {tier.agents === 1 ? "agent" : "agents"}
                        </div>
                      </div>
                    </div>

                    {/* Lead time badge */}
                    {tier.leadWeeks && (
                      <div className="mt-2 px-2 py-0.5 rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: "#1A365D" }}>
                        {tier.leadWeeks} weeks
                      </div>
                    )}

                    {/* Multiplier indicator */}
                    {mult > 1.0 && (
                      <div className="mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" style={{ color: mult >= 2.0 ? "#ef4444" : "#f59e0b" }} />
                        <span className="text-xs font-bold" style={{ color: mult >= 2.0 ? "#ef4444" : "#f59e0b" }}>
                          {mult.toFixed(1)}x delay
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Arrow */}
                  {i < TIERS.length - 1 && (
                    <div className="flex-shrink-0 mx-1">
                      <ArrowRight
                        className="w-5 h-5 mt-8"
                        style={{ color: isAffected && scenario.affectedTiers.includes(TIERS[i + 1]?.id) ? scenario.color : "#1A365D" }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Lead Time Multiplier Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Scenario Lead Time Multipliers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 px-3 font-semibold text-gray-700">Scenario</th>
                  <th className="py-2 px-3 font-semibold text-gray-700">Severity</th>
                  <th className="py-2 px-3 font-semibold text-gray-700 text-center">Start</th>
                  <th className="py-2 px-3 font-semibold text-gray-700 text-center">Duration</th>
                  <th className="py-2 px-3 font-semibold text-gray-700 text-center">T3 Raw</th>
                  <th className="py-2 px-3 font-semibold text-gray-700 text-center">T2 API</th>
                  <th className="py-2 px-3 font-semibold text-gray-700 text-center">T1 Form</th>
                </tr>
              </thead>
              <tbody>
                {SCENARIOS.filter(s => s.id !== "none").map((s, i) => (
                  <tr
                    key={s.id}
                    className={`border-b cursor-pointer transition-colors ${selectedScenario === s.id ? "bg-blue-50" : i % 2 === 0 ? "bg-gray-50" : ""}`}
                    onClick={() => setSelectedScenario(s.id)}
                  >
                    <td className="py-2 px-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="font-medium">{s.name}</span>
                    </td>
                    <td className="py-2 px-3">
                      <span className="font-semibold" style={{ color: severityColors[s.severity] }}>
                        {s.severity}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">Wk {s.startWeek}</td>
                    <td className="py-2 px-3 text-center">{s.duration} wks</td>
                    {(["T3", "T2", "T1"] as const).map(tier => {
                      const v = s.multipliers[tier];
                      return (
                        <td key={tier} className="py-2 px-3 text-center">
                          <span
                            className={`font-bold ${v >= 2.0 ? "text-red-500" : v > 1.0 ? "text-amber-500" : "text-gray-400"}`}
                          >
                            {v.toFixed(1)}x
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
