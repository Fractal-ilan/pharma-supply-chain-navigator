/**
 * Pharmaceutical Supply Chain Agent-Based Model (ABM)
 *
 * A complete in-browser TypeScript simulation of a multi-tier pharmaceutical supply chain
 * with disruption propagation, agent-based decision-making, and Monte Carlo analysis.
 *
 * Architecture:
 * - SeededRNG for reproducibility
 * - Agent classes (Tier3/Tier2/Tier1 Suppliers, Manufacturers, Distributors, Pharmacies, Regulator, InventoryAgent)
 * - Main simulation class with day-by-day loop
 * - Monte Carlo wrapper for stochastic analysis
 * - Public API: getDefaultConfig(), getScenarioPresets(), runSimulation(), runMonteCarloSimulation()
 */

// ============================================================================
// INTERFACES
// ============================================================================

export type DisruptionType = 'natural_disaster' | 'regulatory_change' | 'trade_dispute' | 'pandemic_wave' | 'cyber_attack' | 'quality_failure' | 'cold_chain_breach';
export type SimulationPhase = 'normal' | 'early-warning' | 'disruption-onset' | 'cascade-propagation' | 'shortage-crisis' | 'intervention' | 'recovery';

export interface PharmaConfig {
  timeHorizon: number;
  monteCarloRuns: number;
  disruptionStartWeek: number;
  disruptionType: DisruptionType;
  disruptionTier: string;
  disruptionSeverity: number;
  disruptionDuration: number;
  nTier1Suppliers: number;
  nTier2Suppliers: number;
  nTier3Suppliers: number;
  nManufacturers: number;
  nDistributors: number;
  nPharmacies: number;
  enableAIForecasting: boolean;
  enableRBE: boolean;
  enablePredictiveMaintenance: boolean;
  enableAutonomousInventory: boolean;
  enableColdChainAI: boolean;
  randomSeed?: number;
}

export interface WeeklySnapshot {
  week: number;
  totalInventory: number;
  serviceLevel: number;
  stockouts: number;
  batchFailureRate: number;
  spoiledUnits: number;
  activeDisruptions: number;
  shortagePredictions: number;
  rebalanceActions: number;
  complianceViolations: number;
  patientsServed: number;
  unfilledPrescriptions: number;
  networkVulnerability: number;
  phase: SimulationPhase;
  supplyByTier: { tier1: number; tier2: number; tier3: number };
  regionalExposure: Record<string, number>;
  agentMetrics: {
    disruptedSuppliers: number;
    activeManufacturers: number;
    frozenDistributors: number;
    totalAgents: number;
  };
}

export interface AgentSnapshot {
  week: number;
  suppliers: Array<{
    name: string;
    tier: string;
    region: string;
    disrupted: boolean;
    capacity: number;
    riskScore: number;
    inventory: number;
  }>;
  manufacturers: Array<{
    name: string;
    region: string;
    batchesProduced: number;
    batchesFailed: number;
    equipmentHealth: number;
    qualityScore: number;
  }>;
  distributors: Array<{
    name: string;
    region: string;
    serviceLevel: number;
    stockouts: number;
    spoiledUnits: number;
    forecastError: number;
  }>;
}

export interface MonteCarloResults {
  serviceLevelPercentiles: Array<{ week: number; p5: number; p25: number; p50: number; p75: number; p95: number }>;
  peakStockoutDistribution: Array<{ stockouts: number; frequency: number }>;
  recoveryWeekDistribution: Array<{ week: number; frequency: number }>;
  inventoryPercentiles: Array<{ week: number; p5: number; p25: number; p50: number; p75: number; p95: number }>;
  avgPeakStockouts: number;
  avgRecoveryWeek: number;
  avgMinServiceLevel: number;
}

export interface SimulationResult {
  weeklyData: WeeklySnapshot[];
  agentSnapshots: AgentSnapshot[];
  monteCarlo?: MonteCarloResults;
  summary: {
    minServiceLevel: number;
    minServiceLevelWeek: number;
    maxStockouts: number;
    maxDisruptions: number;
    totalSpoiledUnits: number;
    totalUnfilledPrescriptions: number;
    recoveryWeek: number;
    peakInventoryDeficit: number;
    complianceViolationsTotal: number;
    estimatedPatientImpact: number;
  };
}

// ============================================================================
// SEEDED RNG (Mulberry32 Pattern)
// ============================================================================

class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  nextInt(max: number): number {
    this.state = (this.state * 9301 + 49297) % 233280;
    return Math.floor((this.state / 233280) * max);
  }

  nextFloat(): number {
    this.state = (this.state * 9301 + 49297) % 233280;
    return this.state / 233280;
  }

  nextGaussian(): number {
    const u1 = this.nextFloat();
    const u2 = this.nextFloat();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}

// ============================================================================
// CALIBRATION DATA
// ============================================================================

const REGIONAL_RISK_SCORES: Record<string, number> = {
  IN: 0.65, CN: 0.72, US: 0.25, IE: 0.15, DE: 0.20, CH: 0.10, IL: 0.40, BR: 0.50, JP: 0.18,
};

const BASELINE_SHORTAGE_RATE = 0.05;
const BATCH_FAILURE_RATE = 0.02;
const COLD_CHAIN_BREACH_RATE = 0.08;
const FORECAST_MAPE_BASELINE = 0.117;
const FORECAST_MAPE_AI = 0.060;

const DEMAND_SEASONALITY = [0.95, 0.90, 1.00, 1.05, 1.10, 1.15, 1.10, 1.05, 1.00, 1.05, 1.10, 1.20];

const EVENT_PROBABILITIES = {
  natural_disaster: 0.03,
  regulatory_change: 0.02,
  trade_dispute: 0.04,
  pandemic_wave: 0.01,
  cyber_attack: 0.02,
  quality_failure: 0.05,
};

// ============================================================================
// AGENT CLASSES
// ============================================================================

class SupplierAgent {
  name: string;
  tier: string;
  region: string;
  rng: SeededRNG;
  capacity: number = 1000;
  production_rate: number;
  defect_rate: number;
  inventory: number = 500;
  lead_time: number;
  disrupted: boolean = false;
  disruption_weeks_remaining: number = 0;
  risk_score: number;
  recovery_rate: number = 0.15; // 15% recovery per week

  constructor(name: string, tier: string, region: string, rng: SeededRNG) {
    this.name = name;
    this.tier = tier;
    this.region = region;
    this.rng = rng;
    this.production_rate = 100 + rng.nextInt(50);
    this.defect_rate = 0.01 + rng.nextFloat() * 0.03;
    this.lead_time = tier === 'tier3' ? 4 : tier === 'tier2' ? 3 : 2;
    this.risk_score = REGIONAL_RISK_SCORES[region] || 0.35;
  }

  decide(): { produce: number } {
    if (this.disrupted && this.disruption_weeks_remaining > 0) {
      return { produce: Math.round(this.production_rate * 0.3) };
    }
    return { produce: this.production_rate };
  }

  update(demand: number): void {
    const { produce } = this.decide();
    const output = Math.round(produce * (1 - this.defect_rate));
    this.inventory = Math.max(0, Math.min(this.capacity, this.inventory + output - demand));

    if (this.disrupted) {
      this.disruption_weeks_remaining--;
      if (this.disruption_weeks_remaining <= 0) {
        this.disrupted = false;
        this.inventory = Math.round(this.inventory * (1 + this.recovery_rate));
      } else {
        // Gradual recovery while still disrupted
        this.inventory = Math.round(this.inventory * (1 + this.recovery_rate * 0.5));
      }
    }

    // Random event checks
    if (this.rng.nextFloat() < this.risk_score * (EVENT_PROBABILITIES.natural_disaster + 0.01)) {
      this.disrupted = true;
      this.disruption_weeks_remaining = this.rng.nextInt(4) + 2;
    }
  }
}

class ManufacturerAgent {
  name: string;
  region: string;
  rng: SeededRNG;
  equipment_health: number = 1.0;
  quality_score: number = 0.98;
  batches_produced: number = 0;
  batches_failed: number = 0;
  inventory: number = 300;
  capacity: number = 500;
  yield_rate: number = 0.95;
  enableRBE: boolean = false;
  enablePredictiveMaintenance: boolean = false;

  constructor(name: string, region: string, rng: SeededRNG, enableRBE: boolean = false, enablePM: boolean = false) {
    this.name = name;
    this.region = region;
    this.rng = rng;
    this.enableRBE = enableRBE;
    this.enablePredictiveMaintenance = enablePM;
  }

  decide(supplier_inventory: number): { batch_size: number; duration_hours: number } {
    const batch_size = Math.min(100, Math.floor(supplier_inventory * 0.5));
    const review_duration = this.enableRBE ? 2 : 8;
    return { batch_size, duration_hours: review_duration };
  }

  update(supplier_inventory: number): number {
    const { batch_size, duration_hours } = this.decide(supplier_inventory);

    // Quality control pass rate
    const qc_pass_rate = this.enableRBE ? 0.95 : 0.60;
    const passed = this.rng.nextFloat() < qc_pass_rate ? batch_size : 0;

    this.batches_produced++;
    if (passed === 0) this.batches_failed++;

    const output = Math.round(passed * this.yield_rate * this.equipment_health);
    this.inventory = Math.min(this.capacity, this.inventory + output);

    // Equipment degradation
    this.equipment_health = Math.max(0.5, this.equipment_health - 0.02);

    // Predictive maintenance
    if (this.enablePredictiveMaintenance && this.equipment_health < 0.4) {
      this.equipment_health = 0.95;
    }

    return Math.min(batch_size, output);
  }
}

class DistributorAgent {
  name: string;
  region: string;
  rng: SeededRNG;
  inventory: number = 400;
  capacity: number = 800;
  demand_forecast: number = 100;
  enableAIForecasting: boolean = false;
  enableColdChainAI: boolean = false;
  forecast_error: number = 0;
  stockouts: number = 0;
  spoiled_units: number = 0;
  service_level: number = 1.0;
  days_of_supply: number = 0;

  constructor(name: string, region: string, rng: SeededRNG, enableAI: boolean = false, enableColdChain: boolean = false) {
    this.name = name;
    this.region = region;
    this.rng = rng;
    this.enableAIForecasting = enableAI;
    this.enableColdChainAI = enableColdChain;
  }

  decide(actual_demand: number): { forecast: number } {
    const mape = this.enableAIForecasting ? FORECAST_MAPE_AI : FORECAST_MAPE_BASELINE;
    const forecast = actual_demand * (1 + (this.rng.nextGaussian() * mape));
    return { forecast: Math.max(1, forecast) };
  }

  update(supplier_output: number, actual_demand: number): number {
    const { forecast } = this.decide(actual_demand);
    this.forecast_error = Math.abs(forecast - actual_demand) / (actual_demand || 1);

    // Cold chain processing
    let receive = supplier_output;
    if (this.enableColdChainAI && this.rng.nextFloat() < COLD_CHAIN_BREACH_RATE) {
      const breach_loss = Math.round(receive * 0.2);
      receive -= breach_loss;
      this.spoiled_units += breach_loss;
    } else if (this.rng.nextFloat() < COLD_CHAIN_BREACH_RATE * 0.5) {
      const spoil = Math.round(receive * 0.1);
      receive -= spoil;
      this.spoiled_units += spoil;
    }

    this.inventory = Math.min(this.capacity, this.inventory + receive);

    // Fulfill demand
    const fulfilled = Math.min(this.inventory, actual_demand);
    const unfulfilled = Math.max(0, actual_demand - fulfilled);
    this.inventory -= fulfilled;

    if (unfulfilled > 0) {
      this.stockouts++;
    }

    this.days_of_supply = this.inventory / (actual_demand || 1);
    this.service_level = fulfilled / (actual_demand || 1);

    return fulfilled;
  }
}

class PharmacyAgent {
  name: string;
  rng: SeededRNG;
  demand: number;
  patients_served: number = 0;
  prescriptions_unfilled: number = 0;
  week: number = 0;

  constructor(name: string, rng: SeededRNG) {
    this.name = name;
    this.rng = rng;
    this.demand = 50 + rng.nextInt(50);
  }

  step(week: number, seasonality_factor: number): number {
    this.week = week;
    const adjusted_demand = Math.round(this.demand * seasonality_factor);
    return adjusted_demand;
  }

  fulfill(supply: number, demand: number): void {
    this.patients_served += Math.min(supply, demand);
    this.prescriptions_unfilled += Math.max(0, demand - supply);
  }
}

class RegulatorAgent {
  last_audit_week: number = 0;
  audit_frequency: number = 4; // weeks
  violations: Record<string, number> = {};
  recall_threshold: number = 2;

  audit(week: number, manufacturers: ManufacturerAgent[]): Array<{ mfg_name: string; violations: number }> {
    const audits = [];
    if (week - this.last_audit_week >= this.audit_frequency) {
      this.last_audit_week = week;
      for (const mfg of manufacturers) {
        const failure_rate = mfg.batches_failed / Math.max(1, mfg.batches_produced);
        if (failure_rate > 0.05 || mfg.equipment_health < 0.5) {
          this.violations[mfg.name] = (this.violations[mfg.name] || 0) + 1;
          audits.push({ mfg_name: mfg.name, violations: this.violations[mfg.name] });
          if (this.violations[mfg.name] >= this.recall_threshold) {
            // Recall triggered
            mfg.inventory = Math.round(mfg.inventory * 0.5);
          }
        }
      }
    }
    return audits;
  }
}

class InventoryAutonomousAgent {
  enable: boolean;
  rebalance_actions: number = 0;

  constructor(enable: boolean) {
    this.enable = enable;
  }

  decide(distributors: DistributorAgent[]): Array<{ from_idx: number; to_idx: number; amount: number }> {
    const actions = [];
    if (!this.enable) return actions;

    for (let i = 0; i < distributors.length; i++) {
      const days_supply = distributors[i].days_of_supply;
      if (days_supply < 7) {
        // Find surplus distributor
        let best_idx = -1;
        let best_surplus = 0;
        for (let j = 0; j < distributors.length; j++) {
          if (i !== j && distributors[j].days_of_supply > 21) {
            const surplus = distributors[j].inventory - distributors[j].capacity * 0.3;
            if (surplus > best_surplus) {
              best_surplus = surplus;
              best_idx = j;
            }
          }
        }
        if (best_idx >= 0 && best_surplus > 0) {
          const transfer = Math.min(best_surplus * 0.3, Math.round(distributors[i].demand_forecast * 7));
          actions.push({ from_idx: best_idx, to_idx: i, amount: transfer });
        }
      }
    }
    return actions;
  }

  update(distributors: DistributorAgent[], actions: Array<{ from_idx: number; to_idx: number; amount: number }>): void {
    for (const action of actions) {
      const amount = Math.min(action.amount, distributors[action.from_idx].inventory);
      distributors[action.from_idx].inventory -= amount;
      distributors[action.to_idx].inventory = Math.min(distributors[action.to_idx].capacity, distributors[action.to_idx].inventory + amount);
      this.rebalance_actions++;
    }
  }
}

// ============================================================================
// MAIN SIMULATION CLASS
// ============================================================================

class PharmaSupplyChainSimulation {
  config: PharmaConfig;
  rng: SeededRNG;
  tier3_suppliers: SupplierAgent[] = [];
  tier2_suppliers: SupplierAgent[] = [];
  tier1_suppliers: SupplierAgent[] = [];
  manufacturers: ManufacturerAgent[] = [];
  distributors: DistributorAgent[] = [];
  pharmacies: PharmacyAgent[] = [];
  regulator: RegulatorAgent;
  inventory_agent: InventoryAutonomousAgent;
  weekly_snapshots: WeeklySnapshot[] = [];
  agent_snapshots: AgentSnapshot[] = [];
  disrupted_agents: Set<string> = new Set();
  disruption_week_counter: number = 0;

  constructor(config: PharmaConfig) {
    this.config = config;
    const seed = config.randomSeed || Math.floor(Math.random() * 1000000);
    this.rng = new SeededRNG(seed);

    this.initializeAgents();
    this.regulator = new RegulatorAgent();
    this.inventory_agent = new InventoryAutonomousAgent(config.enableAutonomousInventory);
  }

  private initializeAgents(): void {
    const tier3_regions = ['CN', 'IN', 'BR'];
    const tier2_regions = ['IN', 'CN', 'IL'];
    const tier1_regions = ['IN', 'IE', 'US', 'CH', 'DE'];

    for (let i = 0; i < this.config.nTier3Suppliers; i++) {
      const region = tier3_regions[i % tier3_regions.length];
      this.tier3_suppliers.push(new SupplierAgent(`T3_Supplier_${i}`, 'tier3', region, this.rng));
    }

    for (let i = 0; i < this.config.nTier2Suppliers; i++) {
      const region = tier2_regions[i % tier2_regions.length];
      this.tier2_suppliers.push(new SupplierAgent(`T2_Supplier_${i}`, 'tier2', region, this.rng));
    }

    for (let i = 0; i < this.config.nTier1Suppliers; i++) {
      const region = tier1_regions[i % tier1_regions.length];
      this.tier1_suppliers.push(new SupplierAgent(`T1_Supplier_${i}`, 'tier1', region, this.rng));
    }

    for (let i = 0; i < this.config.nManufacturers; i++) {
      const region = tier1_regions[i % tier1_regions.length];
      this.manufacturers.push(
        new ManufacturerAgent(`Mfg_${i}`, region, this.rng, this.config.enableRBE, this.config.enablePredictiveMaintenance)
      );
    }

    for (let i = 0; i < this.config.nDistributors; i++) {
      const region = tier1_regions[i % tier1_regions.length];
      this.distributors.push(
        new DistributorAgent(`Dist_${i}`, region, this.rng, this.config.enableAIForecasting, this.config.enableColdChainAI)
      );
    }

    for (let i = 0; i < this.config.nPharmacies; i++) {
      this.pharmacies.push(new PharmacyAgent(`Pharmacy_${i}`, this.rng));
    }
  }

  private determinePhase(week: number): SimulationPhase {
    const disruption_week = this.config.disruptionStartWeek;
    const disruption_end = disruption_week + this.config.disruptionDuration;

    if (week < disruption_week - 2) return 'normal';
    if (week < disruption_week) return 'early-warning';
    if (week < disruption_week + 2) return 'disruption-onset';
    if (week < disruption_week + 6) return 'cascade-propagation';
    if (week <= disruption_end) return 'shortage-crisis';
    if (week <= disruption_end + 4) return 'intervention';
    return 'recovery';
  }

  private applyDisruption(week: number): void {
    if (week !== this.config.disruptionStartWeek) return;

    let target_agents: SupplierAgent[] = [];
    if (this.config.disruptionTier === 'tier1') {
      target_agents = this.tier1_suppliers;
    } else if (this.config.disruptionTier === 'tier2') {
      target_agents = this.tier2_suppliers;
    } else {
      target_agents = this.tier3_suppliers;
    }

    const n_to_disrupt = Math.ceil(target_agents.length * this.config.disruptionSeverity);
    for (let i = 0; i < n_to_disrupt; i++) {
      const agent = target_agents[i];
      agent.disrupted = true;
      agent.disruption_weeks_remaining = this.config.disruptionDuration;
      this.disrupted_agents.add(agent.name);
    }
  }

  private collectSnapshot(week: number): WeeklySnapshot {
    const total_inventory = [
      ...this.tier3_suppliers,
      ...this.tier2_suppliers,
      ...this.tier1_suppliers,
      ...this.manufacturers,
      ...this.distributors,
    ].reduce((sum, a) => sum + a.inventory, 0);

    const avg_service_level =
      this.distributors.length > 0 ? this.distributors.reduce((sum, d) => sum + d.service_level, 0) / this.distributors.length : 1.0;

    const total_stockouts = this.distributors.reduce((sum, d) => sum + d.stockouts, 0);
    const avg_batch_failure =
      this.manufacturers.length > 0
        ? this.manufacturers.reduce((sum, m) => sum + m.batches_failed / Math.max(1, m.batches_produced), 0) / this.manufacturers.length
        : 0;

    const total_spoiled = this.distributors.reduce((sum, d) => sum + d.spoiled_units, 0);
    const active_disruptions = Array.from(this.disrupted_agents).filter((name) => {
      const agent = [
        ...this.tier1_suppliers,
        ...this.tier2_suppliers,
        ...this.tier3_suppliers,
      ].find((a) => a.name === name);
      return agent && agent.disrupted;
    }).length;

    const shortage_predictions = this.distributors.filter((d) => d.days_of_supply < 14).length;
    const rebalance_actions = this.inventory_agent.rebalance_actions;
    const compliance_violations = Object.values(this.regulator.violations).reduce((a, b) => a + b, 0);
    const patients_served = this.pharmacies.reduce((sum, p) => sum + p.patients_served, 0);
    const unfilled_prescriptions = this.pharmacies.reduce((sum, p) => sum + p.prescriptions_unfilled, 0);

    const supply_by_tier = {
      tier1: this.tier1_suppliers.reduce((sum, s) => sum + s.inventory, 0),
      tier2: this.tier2_suppliers.reduce((sum, s) => sum + s.inventory, 0),
      tier3: this.tier3_suppliers.reduce((sum, s) => sum + s.inventory, 0),
    };

    const regional_exposure: Record<string, number> = {};
    for (const region in REGIONAL_RISK_SCORES) {
      const agents = [
        ...this.tier1_suppliers,
        ...this.tier2_suppliers,
        ...this.tier3_suppliers,
        ...this.manufacturers,
      ].filter((a) => a.region === region);
      const disrupted_count = agents.filter((a) => 'disrupted' in a && a.disrupted).length;
      regional_exposure[region] = agents.length > 0 ? disrupted_count / agents.length : 0;
    }

    const network_vulnerability =
      (active_disruptions / Math.max(1, this.config.nTier1Suppliers + this.config.nTier2Suppliers + this.config.nTier3Suppliers)) * 0.5 +
      (1 - avg_service_level) * 0.5;

    return {
      week,
      totalInventory: total_inventory,
      serviceLevel: avg_service_level,
      stockouts: total_stockouts,
      batchFailureRate: avg_batch_failure,
      spoiledUnits: total_spoiled,
      activeDisruptions: active_disruptions,
      shortagePredictions: shortage_predictions,
      rebalanceActions: rebalance_actions,
      complianceViolations: compliance_violations,
      patientsServed: patients_served,
      unfilledPrescriptions: unfilled_prescriptions,
      networkVulnerability: network_vulnerability,
      phase: this.determinePhase(week),
      supplyByTier: supply_by_tier,
      regionalExposure: regional_exposure,
      agentMetrics: {
        disruptedSuppliers: active_disruptions,
        activeManufacturers: this.manufacturers.filter((m) => m.inventory > 0).length,
        frozenDistributors: this.distributors.filter((d) => d.inventory < 50).length,
        totalAgents: this.tier1_suppliers.length + this.tier2_suppliers.length + this.tier3_suppliers.length + this.manufacturers.length,
      },
    };
  }

  private collectAgentSnapshot(week: number): AgentSnapshot {
    return {
      week,
      suppliers: [
        ...this.tier1_suppliers,
        ...this.tier2_suppliers,
        ...this.tier3_suppliers,
      ].map((s) => ({
        name: s.name,
        tier: s.tier,
        region: s.region,
        disrupted: s.disrupted,
        capacity: s.capacity,
        riskScore: s.risk_score,
        inventory: s.inventory,
      })),
      manufacturers: this.manufacturers.map((m) => ({
        name: m.name,
        region: m.region,
        batchesProduced: m.batches_produced,
        batchesFailed: m.batches_failed,
        equipmentHealth: m.equipment_health,
        qualityScore: m.quality_score,
      })),
      distributors: this.distributors.map((d) => ({
        name: d.name,
        region: d.region,
        serviceLevel: d.service_level,
        stockouts: d.stockouts,
        spoiledUnits: d.spoiled_units,
        forecastError: d.forecast_error,
      })),
    };
  }

  run(): SimulationResult {
    for (let week = 0; week < this.config.timeHorizon; week++) {
      this.applyDisruption(week);

      // Tier3 -> Tier2
      const tier3_output = this.tier3_suppliers.reduce((sum, s) => sum + Math.min(s.inventory, 50), 0);
      this.tier3_suppliers.forEach((s) => s.update(50));
      this.tier2_suppliers.forEach((s) => s.update(Math.floor(tier3_output / this.tier2_suppliers.length)));

      // Tier2 -> Tier1
      const tier2_output = this.tier2_suppliers.reduce((sum, s) => sum + Math.min(s.inventory, 60), 0);
      this.tier2_suppliers.forEach((s) => s.update(60));
      this.tier1_suppliers.forEach((s) => s.update(Math.floor(tier2_output / this.tier1_suppliers.length)));

      // Tier1 -> Manufacturers
      const tier1_output = this.tier1_suppliers.reduce((sum, s) => sum + Math.min(s.inventory, 80), 0);
      this.tier1_suppliers.forEach((s) => s.update(80));
      const mfg_outputs = this.manufacturers.map((m, idx) => m.update(Math.floor(tier1_output / this.manufacturers.length)));

      // Manufacturers -> Distributors
      const total_mfg_output = mfg_outputs.reduce((a, b) => a + b, 0);
      this.distributors.forEach((d, idx) => {
        d.demand_forecast = d.demand_forecast || 80;
      });

      // Pharmacies demand
      const total_demand = this.pharmacies.reduce((sum, p) => {
        const seasonality = DEMAND_SEASONALITY[week % 12];
        return sum + p.step(week, seasonality);
      }, 0);

      // Distributors serve demand
      const dist_outputs = this.distributors.map((d, idx) => d.update(Math.floor(total_mfg_output / this.distributors.length), Math.floor(total_demand / this.distributors.length)));

      // Pharmacies fulfill
      this.pharmacies.forEach((p, idx) => {
        const seasonality = DEMAND_SEASONALITY[week % 12];
        const demand = Math.round(p.demand * seasonality);
        const supply = Math.floor(dist_outputs[idx % dist_outputs.length] / this.pharmacies.length);
        p.fulfill(supply, demand);
      });

      // Regulator audit
      this.regulator.audit(week, this.manufacturers);

      // Inventory autonomous agent rebalancing
      const rebalance_actions = this.inventory_agent.decide(this.distributors);
      this.inventory_agent.update(this.distributors, rebalance_actions);

      // Collect metrics
      this.weekly_snapshots.push(this.collectSnapshot(week));
      if (week % 4 === 0 || week === this.config.timeHorizon - 1) {
        this.agent_snapshots.push(this.collectAgentSnapshot(week));
      }
    }

    return this.buildResult();
  }

  private buildResult(): SimulationResult {
    const summary = {
      minServiceLevel: Math.min(...this.weekly_snapshots.map((s) => s.serviceLevel)),
      minServiceLevelWeek: this.weekly_snapshots.findIndex((s) => s.serviceLevel === Math.min(...this.weekly_snapshots.map((x) => x.serviceLevel))),
      maxStockouts: Math.max(...this.weekly_snapshots.map((s) => s.stockouts)),
      maxDisruptions: Math.max(...this.weekly_snapshots.map((s) => s.activeDisruptions)),
      totalSpoiledUnits: this.weekly_snapshots.reduce((sum, s) => sum + s.spoiledUnits, 0),
      totalUnfilledPrescriptions: this.weekly_snapshots.reduce((sum, s) => sum + s.unfilledPrescriptions, 0),
      recoveryWeek: this.weekly_snapshots.findIndex((s, idx) => idx > this.config.disruptionStartWeek && s.serviceLevel > 0.85) || -1,
      peakInventoryDeficit: Math.max(...this.weekly_snapshots.map((s) => s.totalInventory)) - Math.min(...this.weekly_snapshots.map((s) => s.totalInventory)),
      complianceViolationsTotal: this.weekly_snapshots.reduce((sum, s) => sum + s.complianceViolations, 0),
      estimatedPatientImpact: this.weekly_snapshots.reduce((sum, s) => sum + s.unfilledPrescriptions, 0) * 1.5, // rough proxy
    };

    return {
      weeklyData: this.weekly_snapshots,
      agentSnapshots: this.agent_snapshots,
      summary,
    };
  }
}

// ============================================================================
// PUBLIC API & MONTE CARLO
// ============================================================================

export function getDefaultConfig(): PharmaConfig {
  return {
    timeHorizon: 52,
    monteCarloRuns: 50,
    disruptionStartWeek: 4,
    disruptionType: 'trade_dispute',
    disruptionTier: 'tier2',
    disruptionSeverity: 0.4,
    disruptionDuration: 12,
    nTier1Suppliers: 5,
    nTier2Suppliers: 4,
    nTier3Suppliers: 3,
    nManufacturers: 3,
    nDistributors: 4,
    nPharmacies: 20,
    enableAIForecasting: false,
    enableRBE: false,
    enablePredictiveMaintenance: false,
    enableAutonomousInventory: false,
    enableColdChainAI: false,
  };
}

export function getScenarioPresets(): Record<string, Partial<PharmaConfig>> {
  return {
    'India API Export Ban': {
      disruptionType: 'trade_dispute',
      disruptionTier: 'tier2',
      disruptionSeverity: 0.5,
      disruptionDuration: 12,
    },
    'China Raw Material Lockdown': {
      disruptionType: 'pandemic_wave',
      disruptionTier: 'tier3',
      disruptionSeverity: 0.4,
      disruptionDuration: 8,
    },
    'US Hurricane': {
      disruptionType: 'natural_disaster',
      disruptionTier: 'tier1',
      disruptionSeverity: 0.3,
      disruptionDuration: 6,
    },
    'Cyber Attack': {
      disruptionType: 'cyber_attack',
      disruptionTier: 'tier1',
      disruptionSeverity: 0.2,
      disruptionDuration: 4,
    },
    'Quality Crisis': {
      disruptionType: 'quality_failure',
      disruptionTier: 'tier2',
      disruptionSeverity: 0.2,
      disruptionDuration: 16,
    },
  };
}

export function runSimulation(config: Partial<PharmaConfig>): SimulationResult {
  const full_config = { ...getDefaultConfig(), ...config };
  const sim = new PharmaSupplyChainSimulation(full_config);
  return sim.run();
}

export function runMonteCarloSimulation(config: Partial<PharmaConfig>): SimulationResult {
  const full_config = { ...getDefaultConfig(), ...config };
  const n_runs = full_config.monteCarloRuns;

  const all_results: SimulationResult[] = [];
  for (let i = 0; i < n_runs; i++) {
    const run_config = { ...full_config, randomSeed: full_config.randomSeed ? full_config.randomSeed + i : Math.random() * 1000000 };
    const sim = new PharmaSupplyChainSimulation(run_config);
    all_results.push(sim.run());
  }

  // Aggregate results
  const service_level_by_week: Record<number, number[]> = {};
  const inventory_by_week: Record<number, number[]> = {};
  const peak_stockouts: number[] = [];
  const recovery_weeks: number[] = [];

  for (const result of all_results) {
    for (const snapshot of result.weeklyData) {
      if (!service_level_by_week[snapshot.week]) service_level_by_week[snapshot.week] = [];
      if (!inventory_by_week[snapshot.week]) inventory_by_week[snapshot.week] = [];
      service_level_by_week[snapshot.week].push(snapshot.serviceLevel);
      inventory_by_week[snapshot.week].push(snapshot.totalInventory);
    }
    peak_stockouts.push(result.summary.maxStockouts);
    recovery_weeks.push(result.summary.recoveryWeek === -1 ? 99 : result.summary.recoveryWeek);
  }

  const percentile = (arr: number[], p: number) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  };

  const monteCarlo: MonteCarloResults = {
    serviceLevelPercentiles: Object.entries(service_level_by_week).map(([week, values]) => ({
      week: parseInt(week),
      p5: percentile(values, 5),
      p25: percentile(values, 25),
      p50: percentile(values, 50),
      p75: percentile(values, 75),
      p95: percentile(values, 95),
    })),
    peakStockoutDistribution: (() => {
      const dist: Record<number, number> = {};
      for (const val of peak_stockouts) {
        dist[val] = (dist[val] || 0) + 1;
      }
      return Object.entries(dist).map(([stockouts, freq]) => ({ stockouts: parseInt(stockouts), frequency: freq }));
    })(),
    recoveryWeekDistribution: (() => {
      const dist: Record<number, number> = {};
      for (const val of recovery_weeks) {
        dist[val] = (dist[val] || 0) + 1;
      }
      return Object.entries(dist).map(([week, freq]) => ({ week: parseInt(week), frequency: freq }));
    })(),
    inventoryPercentiles: Object.entries(inventory_by_week).map(([week, values]) => ({
      week: parseInt(week),
      p5: percentile(values, 5),
      p25: percentile(values, 25),
      p50: percentile(values, 50),
      p75: percentile(values, 75),
      p95: percentile(values, 95),
    })),
    avgPeakStockouts: peak_stockouts.reduce((a, b) => a + b, 0) / peak_stockouts.length,
    avgRecoveryWeek: recovery_weeks.reduce((a, b) => a + b, 0) / recovery_weeks.length,
    avgMinServiceLevel: all_results.reduce((sum, r) => sum + r.summary.minServiceLevel, 0) / all_results.length,
  };

  // Merge all runs, return first as base with MC
  const merged = all_results[0];
  merged.monteCarlo = monteCarlo;
  return merged;
}
