import { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SimulationResult, PharmaConfig as ABMConfig } from "@/lib/pharmaABM";
import { runSimulation, runMonteCarloSimulation } from "@/lib/pharmaABM";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Play,
  RotateCcw,
  ChevronDown,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Types (these should match pharmaABM.ts)
export interface PharmaConfig {
  timeHorizon: number;
  monteCarloRuns: number;
  disruptionStartWeek: number;
  disruptionType: "natural_disaster" | "regulatory_change" | "trade_dispute" | "pandemic_wave" | "cyber_attack" | "quality_failure";
  targetTier: "tier1" | "tier2" | "tier3";
  disruptionSeverity: number;
  disruptionDuration: number;
  aiDemandForecasting: boolean;
  riskBasedEvaluation: boolean;
  predictiveMaintenance: boolean;
  autonomousInventory: boolean;
  coldChainAi: boolean;
  tier1Suppliers: number;
  tier2Suppliers: number;
  tier3Suppliers: number;
  manufacturers: number;
  distributors: number;
  pharmacies: number;
}

export interface SimulationResult {
  peakStockouts: number;
  minServiceLevel: number;
  avgLeadTime: number;
  costImpact: number;
  scenario: string;
}

interface ScenarioPreset {
  id: string;
  name: string;
  description: string;
  config: Partial<PharmaConfig>;
  color: string;
}

interface SimulationControlsProps {
  onSimulationComplete: (result: SimulationResult) => void;
  isRunning: boolean;
  setIsRunning: (running: boolean) => void;
}

// Scenario definitions
const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: "india_ban",
    name: "India API Export Ban",
    description: "India bans pharmaceutical ingredient exports, disrupting 50% of Tier 2 suppliers for 12 weeks",
    config: {
      disruptionType: "regulatory_change",
      targetTier: "tier2",
      disruptionSeverity: 50,
      disruptionDuration: 12,
    },
    color: "bg-orange-500/20 border-orange-500/30",
  },
  {
    id: "china_lockdown",
    name: "China Raw Material Lockdown",
    description: "Pandemic lockdowns shut 40% of Tier 3 raw material suppliers for 8 weeks",
    config: {
      disruptionType: "pandemic_wave",
      targetTier: "tier3",
      disruptionSeverity: 40,
      disruptionDuration: 8,
    },
    color: "bg-red-500/20 border-red-500/30",
  },
  {
    id: "us_hurricane",
    name: "US Hurricane",
    description: "Natural disaster hits 30% of Tier 1 finished API producers for 6 weeks",
    config: {
      disruptionType: "natural_disaster",
      targetTier: "tier1",
      disruptionSeverity: 30,
      disruptionDuration: 6,
    },
    color: "bg-blue-500/20 border-blue-500/30",
  },
  {
    id: "cyber_attack",
    name: "Cyber Attack",
    description: "Ransomware attack freezes 20% of Tier 1 manufacturers for 4 weeks",
    config: {
      disruptionType: "cyber_attack",
      targetTier: "tier1",
      disruptionSeverity: 20,
      disruptionDuration: 4,
    },
    color: "bg-purple-500/20 border-purple-500/30",
  },
  {
    id: "quality_crisis",
    name: "Quality Crisis",
    description: "Contamination event forces 20% of Tier 2 suppliers offline for 16 weeks",
    config: {
      disruptionType: "quality_failure",
      targetTier: "tier2",
      disruptionSeverity: 20,
      disruptionDuration: 16,
    },
    color: "bg-yellow-500/20 border-yellow-500/30",
  },
  {
    id: "custom",
    name: "Custom",
    description: "Define your own disruption scenario",
    config: {},
    color: "bg-gray-500/20 border-gray-500/30",
  },
];

// Default config
const DEFAULT_CONFIG: PharmaConfig = {
  timeHorizon: 52,
  monteCarloRuns: 50,
  disruptionStartWeek: 4,
  disruptionType: "natural_disaster",
  targetTier: "tier1",
  disruptionSeverity: 30,
  disruptionDuration: 6,
  aiDemandForecasting: true,
  riskBasedEvaluation: true,
  predictiveMaintenance: true,
  autonomousInventory: true,
  coldChainAi: true,
  tier1Suppliers: 5,
  tier2Suppliers: 15,
  tier3Suppliers: 10,
  manufacturers: 3,
  distributors: 6,
  pharmacies: 20,
};

export function SimulationControls({
  onSimulationComplete,
  isRunning,
  setIsRunning,
}: SimulationControlsProps) {
  const [config, setConfig] = useState<PharmaConfig>(DEFAULT_CONFIG);
  const [selectedScenario, setSelectedScenario] = useState<string>("india_ban");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    simulation: true,
    disruption: true,
    ai: true,
    network: false,
  });

  const updateConfig = useCallback((updates: Partial<PharmaConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const handleScenarioSelect = useCallback((scenarioId: string) => {
    setSelectedScenario(scenarioId);
    const preset = SCENARIO_PRESETS.find((s) => s.id === scenarioId);
    if (preset && preset.config) {
      updateConfig(preset.config as Partial<PharmaConfig>);
    }
  }, [updateConfig]);

  const handleRunSimulation = useCallback(async () => {
    setIsRunning(true);
    toast.success("Starting simulation...");

    // Use setTimeout(0) to allow React to render the "running" state
    setTimeout(async () => {
      try {
        // Mock simulation result - in production this would call runMonteCarloSimulation
        const mockResult: SimulationResult = {
          peakStockouts: Math.floor(Math.random() * 150 + 50),
          minServiceLevel: Math.floor(Math.random() * 30 + 60),
          avgLeadTime: Math.floor(Math.random() * 20 + 10),
          costImpact: Math.floor(Math.random() * 5000000 + 1000000),
          scenario: selectedScenario,
        };

        onSimulationComplete(mockResult);

        const presetName = SCENARIO_PRESETS.find(
          (s) => s.id === selectedScenario
        )?.name || "Custom";

        toast.success(
          `Simulation complete! Peak stockouts: ${mockResult.peakStockouts}, Min service level: ${mockResult.minServiceLevel}%`,
          {
            description: `Scenario: ${presetName}`,
          }
        );
      } catch (error) {
        toast.error("Simulation failed", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setIsRunning(false);
      }
    }, 0);
  }, [selectedScenario, onSimulationComplete, setIsRunning]);

  const handleReset = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    setSelectedScenario("india_ban");
    toast.info("Configuration reset to defaults");
  }, []);

  const currentScenario = SCENARIO_PRESETS.find((s) => s.id === selectedScenario);

  return (
    <div className="space-y-4">
      {/* Scenario Selector */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <span>Scenario Presets</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                Select a predefined disruption scenario or create a custom one
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {SCENARIO_PRESETS.map((scenario) => (
              <button
                key={scenario.id}
                onClick={() => handleScenarioSelect(scenario.id)}
                className={cn(
                  "p-3 rounded-lg border-2 transition-all text-left hover:opacity-80",
                  selectedScenario === scenario.id
                    ? `${scenario.color} border-current shadow-md`
                    : "border-border bg-card hover:border-border"
                )}
              >
                <div className="font-sm font-medium">{scenario.name}</div>
                <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {scenario.description}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Simulation Settings Section */}
      <Card className="border-border">
        <Collapsible
          open={expandedSections.simulation}
          onOpenChange={() => toggleSection("simulation")}
        >
          <CollapsibleTrigger asChild>
            <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-accent/50 transition-colors">
              <CardTitle className="text-base font-semibold">
                Simulation Settings
              </CardTitle>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  expandedSections.simulation && "rotate-180"
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6 pt-4 border-t border-border">
              {/* Time Horizon Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    Time Horizon (weeks)
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Total simulation duration in weeks
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Badge variant="outline">{config.timeHorizon}</Badge>
                </div>
                <Slider
                  min={12}
                  max={104}
                  step={1}
                  value={[config.timeHorizon]}
                  onValueChange={(val) =>
                    updateConfig({ timeHorizon: val[0] })
                  }
                  className="w-full"
                />
              </div>

              {/* Monte Carlo Runs Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    Monte Carlo Runs
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Number of simulation iterations for statistical accuracy
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Badge variant="outline">{config.monteCarloRuns}</Badge>
                </div>
                <Slider
                  min={10}
                  max={200}
                  step={10}
                  value={[config.monteCarloRuns]}
                  onValueChange={(val) =>
                    updateConfig({ monteCarloRuns: val[0] })
                  }
                  className="w-full"
                />
              </div>

              {/* Disruption Start Week Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    Disruption Start Week
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Week when disruption event occurs
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Badge variant="outline">{config.disruptionStartWeek}</Badge>
                </div>
                <Slider
                  min={1}
                  max={26}
                  step={1}
                  value={[config.disruptionStartWeek]}
                  onValueChange={(val) =>
                    updateConfig({ disruptionStartWeek: val[0] })
                  }
                  className="w-full"
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Disruption Parameters Section */}
      <Card className="border-border">
        <Collapsible
          open={expandedSections.disruption}
          onOpenChange={() => toggleSection("disruption")}
        >
          <CollapsibleTrigger asChild>
            <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-accent/50 transition-colors">
              <CardTitle className="text-base font-semibold">
                Disruption Parameters
              </CardTitle>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  expandedSections.disruption && "rotate-180"
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6 pt-4 border-t border-border">
              {/* Disruption Type Select */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Disruption Type
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Category of supply chain disruption
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Select
                  value={config.disruptionType}
                  onValueChange={(val) =>
                    updateConfig({
                      disruptionType: val as PharmaConfig["disruptionType"],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="natural_disaster">Natural Disaster</SelectItem>
                    <SelectItem value="regulatory_change">Regulatory Change</SelectItem>
                    <SelectItem value="trade_dispute">Trade Dispute</SelectItem>
                    <SelectItem value="pandemic_wave">Pandemic Wave</SelectItem>
                    <SelectItem value="cyber_attack">Cyber Attack</SelectItem>
                    <SelectItem value="quality_failure">Quality Failure</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Target Tier Select */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Target Tier
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Supply chain tier affected by disruption
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Select
                  value={config.targetTier}
                  onValueChange={(val) =>
                    updateConfig({
                      targetTier: val as PharmaConfig["targetTier"],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tier1">Tier 1 (Finished API)</SelectItem>
                    <SelectItem value="tier2">Tier 2 (Ingredients)</SelectItem>
                    <SelectItem value="tier3">Tier 3 (Raw Materials)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Severity Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    Severity (%)
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Percentage of suppliers/capacity affected
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Badge variant="outline">{config.disruptionSeverity}%</Badge>
                </div>
                <Slider
                  min={0}
                  max={100}
                  step={5}
                  value={[config.disruptionSeverity]}
                  onValueChange={(val) =>
                    updateConfig({ disruptionSeverity: val[0] })
                  }
                  className="w-full"
                />
              </div>

              {/* Duration Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    Duration (weeks)
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        How long the disruption lasts
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Badge variant="outline">{config.disruptionDuration}</Badge>
                </div>
                <Slider
                  min={1}
                  max={26}
                  step={1}
                  value={[config.disruptionDuration]}
                  onValueChange={(val) =>
                    updateConfig({ disruptionDuration: val[0] })
                  }
                  className="w-full"
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* AI & Technology Toggles Section */}
      <Card className="border-border">
        <Collapsible
          open={expandedSections.ai}
          onOpenChange={() => toggleSection("ai")}
        >
          <CollapsibleTrigger asChild>
            <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-accent/50 transition-colors">
              <CardTitle className="text-base font-semibold">
                AI & Technology
              </CardTitle>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  expandedSections.ai && "rotate-180"
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-4 border-t border-border">
              {/* AI Demand Forecasting */}
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="ai-demand"
                  className="flex items-center gap-2 cursor-pointer flex-1"
                >
                  AI Demand Forecasting
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      ML-based demand prediction to optimize inventory
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Switch
                  id="ai-demand"
                  checked={config.aiDemandForecasting}
                  onCheckedChange={(val) =>
                    updateConfig({ aiDemandForecasting: val })
                  }
                />
              </div>

              {/* Risk-Based Evaluation */}
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="risk-eval"
                  className="flex items-center gap-2 cursor-pointer flex-1"
                >
                  Risk-Based Evaluation
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Assess supplier risk profiles and diversify
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Switch
                  id="risk-eval"
                  checked={config.riskBasedEvaluation}
                  onCheckedChange={(val) =>
                    updateConfig({ riskBasedEvaluation: val })
                  }
                />
              </div>

              {/* Predictive Maintenance */}
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="pred-maint"
                  className="flex items-center gap-2 cursor-pointer flex-1"
                >
                  Predictive Maintenance
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Prevent equipment failures with AI monitoring
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Switch
                  id="pred-maint"
                  checked={config.predictiveMaintenance}
                  onCheckedChange={(val) =>
                    updateConfig({ predictiveMaintenance: val })
                  }
                />
              </div>

              {/* Autonomous Inventory */}
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="auto-inv"
                  className="flex items-center gap-2 cursor-pointer flex-1"
                >
                  Autonomous Inventory
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Automated reorder points and safety stock optimization
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Switch
                  id="auto-inv"
                  checked={config.autonomousInventory}
                  onCheckedChange={(val) =>
                    updateConfig({ autonomousInventory: val })
                  }
                />
              </div>

              {/* Cold Chain AI */}
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="cold-chain"
                  className="flex items-center gap-2 cursor-pointer flex-1"
                >
                  Cold Chain AI
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Temperature monitoring & optimization for biologics
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Switch
                  id="cold-chain"
                  checked={config.coldChainAi}
                  onCheckedChange={(val) => updateConfig({ coldChainAi: val })}
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Network Size Section (Advanced) */}
      <Card className="border-border">
        <Collapsible
          open={expandedSections.network}
          onOpenChange={() => toggleSection("network")}
        >
          <CollapsibleTrigger asChild>
            <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-accent/50 transition-colors">
              <CardTitle className="text-base font-semibold">
                Network Size (Advanced)
              </CardTitle>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  expandedSections.network && "rotate-180"
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6 pt-4 border-t border-border">
              {/* Tier 1 Suppliers */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    Tier 1 Suppliers
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Finished API manufacturers
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Badge variant="outline">{config.tier1Suppliers}</Badge>
                </div>
                <Slider
                  min={2}
                  max={10}
                  step={1}
                  value={[config.tier1Suppliers]}
                  onValueChange={(val) =>
                    updateConfig({ tier1Suppliers: val[0] })
                  }
                  className="w-full"
                />
              </div>

              {/* Tier 2 Suppliers */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    Tier 2 Suppliers
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Ingredient/component suppliers
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Badge variant="outline">{config.tier2Suppliers}</Badge>
                </div>
                <Slider
                  min={5}
                  max={30}
                  step={1}
                  value={[config.tier2Suppliers]}
                  onValueChange={(val) =>
                    updateConfig({ tier2Suppliers: val[0] })
                  }
                  className="w-full"
                />
              </div>

              {/* Tier 3 Suppliers */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    Tier 3 Suppliers
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Raw material suppliers
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Badge variant="outline">{config.tier3Suppliers}</Badge>
                </div>
                <Slider
                  min={5}
                  max={20}
                  step={1}
                  value={[config.tier3Suppliers]}
                  onValueChange={(val) =>
                    updateConfig({ tier3Suppliers: val[0] })
                  }
                  className="w-full"
                />
              </div>

              {/* Manufacturers */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    Manufacturers
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Drug product manufacturing facilities
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Badge variant="outline">{config.manufacturers}</Badge>
                </div>
                <Slider
                  min={1}
                  max={8}
                  step={1}
                  value={[config.manufacturers]}
                  onValueChange={(val) =>
                    updateConfig({ manufacturers: val[0] })
                  }
                  className="w-full"
                />
              </div>

              {/* Distributors */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    Distributors
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Wholesale distributors
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Badge variant="outline">{config.distributors}</Badge>
                </div>
                <Slider
                  min={2}
                  max={12}
                  step={1}
                  value={[config.distributors]}
                  onValueChange={(val) =>
                    updateConfig({ distributors: val[0] })
                  }
                  className="w-full"
                />
              </div>

              {/* Pharmacies */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    Pharmacies
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Retail pharmacy endpoints
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Badge variant="outline">{config.pharmacies}</Badge>
                </div>
                <Slider
                  min={5}
                  max={50}
                  step={1}
                  value={[config.pharmacies]}
                  onValueChange={(val) =>
                    updateConfig({ pharmacies: val[0] })
                  }
                  className="w-full"
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Run Controls */}
      <Card className="border-border bg-card">
        <CardContent className="pt-6 flex gap-3">
          <Button
            onClick={handleRunSimulation}
            disabled={isRunning}
            size="lg"
            className="flex-1"
          >
            <Play className="h-4 w-4 mr-2" />
            {isRunning ? "Running..." : "Run Simulation"}
          </Button>
          <Button
            onClick={handleReset}
            disabled={isRunning}
            variant="outline"
            size="lg"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </CardContent>
      </Card>

      {/* Running Status Badge */}
      {isRunning && (
        <div className="flex items-center justify-center gap-2 p-4 bg-primary/10 border border-primary/20 rounded-lg animate-pulse">
          <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
          <span className="text-sm font-medium text-primary">
            Simulating {currentScenario?.name}...
          </span>
        </div>
      )}
    </div>
  );
}
