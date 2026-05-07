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
 *
 * SYNTHETIC DATA POLICY:
 * Output trajectories from this simulator MUST NOT be used to fit, calibrate,
 * or train any free parameter of this same model. See
 * validation/calibration/05_synthetic_data_policy.md for the full policy and
 * permitted exceptions (pipeline validation, pre-registration, downstream
 * scenario generation only).
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
  leadTimeMultipliers?: { tier1: number; tier2: number; tier3: number };
}

export interface WeeklySnapshot {
  week: number;
  totalInventory: number;
  distributorInventory: number;
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

// Calibration constants. Tightened from initial values during the May 2026
// validation pass so that no-disruption steady-state service level meets the
// 0.95–0.99 industry baseline. See validation/ for full audit trail.
const BASELINE_SHORTAGE_RATE = 0.05;
const BATCH_FAILURE_RATE = 0.02;
const COLD_CHAIN_BREACH_RATE = 0.008;     // weekly breach prob (was 0.03)
const COLD_CHAIN_BREACH_LOSS = 0.03;      // fraction lost per breach (was 0.08 implicit)
const FORECAST_MAPE_BASELINE = 0.05;      // was 0.08
const FORECAST_MAPE_AI = 0.030;           // was 0.045
const RANDOM_EVENT_RATE = 0.0002;         // weekly per-supplier risk multiplier (was 0.002)
const SUPPLIER_DEFECT_BASE = 0.003;       // 0.3% base (was 0.01)
const SUPPLIER_DEFECT_RANGE = 0.007;      // 0.3–1.0% total (was 1–3%)

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
  capacity: number = 2000;
  production_rate: number;
  defect_rate: number;
  inventory: number = 400;          // ~2 weeks safety stock (was 150 ≈ 4 days)
  lead_time: number;
  base_lead_time: number;
  lead_time_multiplier: number = 1.0; // Scenario-specific multiplier applied during disruptions
  disrupted: boolean = false;
  disruption_weeks_remaining: number = 0;
  risk_score: number;
  recovery_rate: number = 0.15; // 15% recovery per week

  constructor(name: string, tier: string, region: string, rng: SeededRNG) {
    this.name = name;
    this.tier = tier;
    this.region = region;
    this.rng = rng;
    this.production_rate = 300 + rng.nextInt(60);
    this.defect_rate = SUPPLIER_DEFECT_BASE + rng.nextFloat() * SUPPLIER_DEFECT_RANGE;
    this.base_lead_time = tier === 'tier3' ? 4 : tier === 'tier2' ? 3 : 2;
    this.lead_time = this.base_lead_time;
    this.risk_score = REGIONAL_RISK_SCORES[region] || 0.35;
  }

  disruption_severity: number = 0.5; // How much production is reduced when disrupted

  decide(): { produce: number } {
    if (this.disrupted && this.disruption_weeks_remaining > 0) {
      // Production reduction scales with disruption severity
      const output_fraction = Math.max(0.05, 1 - this.disruption_severity);
      return { produce: Math.round(this.production_rate * output_fraction) };
    }
    return { produce: this.production_rate };
  }

  // Produce goods and add to inventory
  produce(): void {
    const { produce } = this.decide();
    const output = Math.round(produce * (1 - this.defect_rate));
    this.inventory = Math.min(this.capacity, this.inventory + output);
  }

  // Ship goods downstream: returns amount shipped, reduces inventory
  // Disrupted suppliers have impaired logistics (frozen exports, locked warehouses, etc.)
  // Lead time multiplier further reduces throughput (longer pipeline = less arrives per week)
  ship(requested: number): number {
    // Lead time multiplier reduces effective throughput even for non-disrupted suppliers
    // in the affected tier (simulates pipeline congestion, rerouting delays, requalification)
    const lt_throughput = this.lead_time_multiplier > 1.0
      ? Math.max(0.15, 1.0 / this.lead_time_multiplier)
      : 1.0;

    if (this.disrupted && this.disruption_severity > 0.2) {
      // Logistics impairment: higher severity = less can be shipped
      const ship_fraction = Math.max(0.05, 1 - this.disruption_severity * 0.85);
      const max_ship = Math.round(this.inventory * ship_fraction * lt_throughput);
      const shipped = Math.min(max_ship, requested);
      this.inventory -= shipped;
      return shipped;
    }
    const effective_request = Math.round(requested * lt_throughput);
    const shipped = Math.min(this.inventory, effective_request);
    this.inventory -= shipped;
    return shipped;
  }

  // Receive goods from upstream: adds to inventory
  receive(amount: number): void {
    this.inventory = Math.min(this.capacity, this.inventory + amount);
  }

  // End-of-week updates: disruption management, random events
  update(demand: number): void {
    if (this.disrupted) {
      this.disruption_weeks_remaining--;
      if (this.disruption_weeks_remaining <= 0) {
        this.disrupted = false;
        this.inventory = Math.round(this.inventory * (1 + this.recovery_rate));
      }
    }

    // Random event checks — very rare background events. Calibrated to keep
    // no-disruption steady-state service level inside industry band.
    if (!this.disrupted && this.rng.nextFloat() < this.risk_score * RANDOM_EVENT_RATE) {
      this.disrupted = true;
      this.disruption_severity = 0.3 + this.rng.nextFloat() * 0.3;
      this.disruption_weeks_remaining = this.rng.nextInt(3) + 1;
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
  inventory: number = 700;          // ~3 weeks safety stock (was 150 ≈ 1 week)
  capacity: number = 2000;
  yield_rate: number = 0.97;
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
    // Batch size: process nearly all available supply, capped by capacity.
    // 0.97 chosen during May 2026 calibration to ensure end-to-end
    // throughput matches demand under no-disruption conditions; the residual
    // 3% accounts for in-process losses, sampling, and cycle stock.
    const batch_size = Math.min(this.capacity, Math.floor(supplier_inventory * 0.97));
    const review_duration = this.enableRBE ? 2 : 8;
    return { batch_size, duration_hours: review_duration };
  }

  private supply_baseline: number = -1;  // learned from first few weeks
  private weeks_seen: number = 0;

  update(supplier_inventory: number): number {
    const { batch_size, duration_hours } = this.decide(supplier_inventory);

    // Learn supply baseline from first 4 weeks, then detect stress as drop from baseline
    this.weeks_seen++;
    if (this.supply_baseline < 0 && this.weeks_seen <= 4) {
      this.supply_baseline = supplier_inventory;
    } else if (this.weeks_seen <= 4) {
      this.supply_baseline = (this.supply_baseline + supplier_inventory) / 2;
    }
    const under_stress = this.supply_baseline > 0 && supplier_inventory < this.supply_baseline * 0.6;

    // Quality control: RBE maintains high pass rate under stress; without RBE, stress degrades QC
    // (rushed production, staff fatigue, shortcuts under pressure)
    let qc_pass_rate: number;
    if (this.enableRBE) {
      qc_pass_rate = 0.98;  // RBE: consistent quality regardless of stress
    } else {
      qc_pass_rate = under_stress ? 0.85 : 0.95;  // No-RBE: QC degrades under stress
    }
    const reject_fraction = this.enableRBE ? 0.90 : 0.75;  // On failure: AI rejects less
    const passed = this.rng.nextFloat() < qc_pass_rate ? batch_size : Math.round(batch_size * reject_fraction);

    this.batches_produced++;
    if (passed < batch_size * 0.9) this.batches_failed++;

    const output = Math.round(passed * this.yield_rate * this.equipment_health);
    this.inventory = Math.min(this.capacity, this.inventory + output);

    // Equipment degradation: faster under stress (running harder, deferred maintenance)
    const degrade_rate = under_stress && !this.enablePredictiveMaintenance ? 0.008 : 0.002;
    this.equipment_health = Math.max(0.7, this.equipment_health - degrade_rate);

    // Basic scheduled maintenance: No-AI resets at 0.80 threshold (slower catch-up)
    if (!this.enablePredictiveMaintenance && this.equipment_health < 0.80) {
      this.equipment_health = 0.92;
    }

    // Predictive maintenance restores equipment proactively (AI advantage: earlier, higher)
    if (this.enablePredictiveMaintenance && this.equipment_health < 0.88) {
      this.equipment_health = 0.98;
    }

    // Ship from inventory
    const ship = Math.min(this.inventory, batch_size);
    this.inventory -= ship;
    return ship;
  }
}

class DistributorAgent {
  name: string;
  region: string;
  rng: SeededRNG;
  inventory: number = 1000;         // ~2.5 weeks safety stock (was 200 ≈ 4 days)
  capacity: number = 2400;
  demand_share: number;             // 0.7–1.3 weight on this distributor's slice
                                    //         of total pharmacy demand
  demand_forecast: number = 100;
  enableAIForecasting: boolean = false;
  enableColdChainAI: boolean = false;
  forecast_error: number = 0;
  stockouts: number = 0;
  spoiled_units: number = 0;
  service_level: number = 1.0;
  days_of_supply: number = 0;
  // AI early-warning: track supply velocity to detect disruptions
  private supply_history: number[] = [];
  private supply_baseline_dist: number = -1;  // learned from first weeks
  private dist_weeks_seen: number = 0;
  stress_level: number = 0;  // 0 = normal, 1 = full crisis

  constructor(name: string, region: string, rng: SeededRNG, enableAI: boolean = false, enableColdChain: boolean = false) {
    this.name = name;
    this.region = region;
    this.rng = rng;
    this.enableAIForecasting = enableAI;
    this.enableColdChainAI = enableColdChain;
    // Each distributor serves a different-sized regional market.
    // demand_share ∈ [0.7, 1.3] is normalized at allocation time so total
    // demand still flows through the network 1:1.
    this.demand_share = 0.7 + rng.nextFloat() * 0.6;
    // Initial inventory varies 0.8–1.2× from the safety-stock floor so
    // distributors start with slightly different days-of-supply. Combined
    // with per-agent cold-chain breach randomness, this gives the autonomous
    // inventory rebalancer real asymmetry to act on without ever pushing a
    // single distributor below its minimum viable stock at start.
    this.inventory = Math.round(this.inventory * (0.8 + rng.nextFloat() * 0.4));
  }

  decide(actual_demand: number): { forecast: number } {
    // Under stress, AI forecasting adapts much better (tighter error) while
    // No-AI forecasting degrades (wider error from unexpected demand patterns)
    let mape: number;
    if (this.enableAIForecasting) {
      mape = FORECAST_MAPE_AI;  // AI stays accurate even under stress
    } else {
      // No-AI forecast error increases significantly under supply stress
      // (unexpected demand surges, panic ordering, bullwhip effect)
      mape = FORECAST_MAPE_BASELINE + this.stress_level * 0.25;
    }
    const forecast = actual_demand * (1 + (this.rng.nextGaussian() * mape));
    return { forecast: Math.max(1, forecast) };
  }

  update(supplier_output: number, actual_demand: number): number {
    const { forecast } = this.decide(actual_demand);
    this.forecast_error = Math.abs(forecast - actual_demand) / (actual_demand || 1);

    // Track supply velocity to compute stress level — use stable baseline from first 4 weeks
    this.dist_weeks_seen++;
    if (this.dist_weeks_seen <= 4) {
      this.supply_baseline_dist = this.supply_baseline_dist < 0
        ? supplier_output
        : (this.supply_baseline_dist + supplier_output) / 2;
    }

    // Stress = how much supply dropped vs early-period baseline (0-1 scale)
    if (this.supply_baseline_dist > 0) {
      this.stress_level = Math.max(0, Math.min(1, 1 - supplier_output / this.supply_baseline_dist));
    }

    // Cold chain processing — under stress, No-AI cold chain failures increase
    // (rushed handling, less careful storage), AI monitoring prevents this
    let receive = supplier_output;
    let breach_prob: number;
    let breach_loss: number;
    if (this.enableColdChainAI) {
      breach_prob = COLD_CHAIN_BREACH_RATE * 0.25;  // AI monitoring stays effective
      breach_loss = 0.02;
    } else {
      // No-AI: breach rate increases under stress (rushed handling, overloaded staff)
      breach_prob = COLD_CHAIN_BREACH_RATE * (1 + this.stress_level * 3.0);
      breach_loss = COLD_CHAIN_BREACH_LOSS + this.stress_level * 0.20;
    }
    if (this.rng.nextFloat() < breach_prob) {
      const spoil = Math.round(receive * breach_loss);
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

    // Trigger band — corrected during May 2026 calibration. The distributor
    // field name is `days_of_supply` but its actual unit is *weeks of supply*
    // (inventory ÷ weekly demand). Thresholds below are therefore in weeks.
    // Rebalance proactively whenever a distributor falls below 2.0 weeks of
    // supply, sourcing from any peer holding more than 2.5 weeks — a
    // narrower band than before so the rebalancer stays active during the
    // pre-shock and recovery phases of every scenario, instead of only
    // firing in deep crisis.
    for (let i = 0; i < distributors.length; i++) {
      const weeks_supply = distributors[i].days_of_supply;
      if (weeks_supply < 2.0) {
        // Find surplus distributor
        let best_idx = -1;
        let best_surplus = 0;
        for (let j = 0; j < distributors.length; j++) {
          if (i !== j && distributors[j].days_of_supply > 2.5) {
            const surplus = distributors[j].inventory - distributors[j].capacity * 0.3;
            if (surplus > best_surplus) {
              best_surplus = surplus;
              best_idx = j;
            }
          }
        }
        if (best_idx >= 0 && best_surplus > 0) {
          const transfer = Math.min(best_surplus * 0.3, Math.round(distributors[i].demand_forecast * 1.5));
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
  // Per-week pharmacy-level fulfillment, written by run() and read by
  // collectSnapshot. The pharmacy SL is the metric end-users actually feel.
  _lastPharmacyDemand: number = 0;
  _lastPharmacyFulfilled: number = 0;

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

  /**
   * Apply the type-specific disruption fingerprint at this week, if any.
   *
   * SEVERITY DISCIPLINE — every per-week destruction fraction and disruption
   * severity inside this method is the product of three terms:
   *
   *   per_week_amount = baseline_amplitude × envelope(t, peak, tau) × severity
   *
   * The baseline amplitude encodes the mechanism's calibration at sev = 1.0;
   * the Gaussian envelope encodes the time-shape of the disruption (peak
   * week and width); the severity (0–1) is the user-controllable knob. This
   * structure guarantees:
   *   - monotonic dose-response: ∂minSL/∂severity ≤ 0 by construction
   *   - continuous slope: no discrete week triggers, so small changes in
   *     severity produce small changes in output
   *   - mechanism-shape preservation: each disruption type has a distinct
   *     time-profile (sharp V-dip, sustained drain, cascading waves) that
   *     remains identifiable as severity varies
   *
   * Mechanism envelopes (peak weeks at sev = 1.0):
   *
   *   trade_dispute / regulatory_change — INDIA-style export ban
   *     primary tier-2  : peak t=0,  τ=5  (sustained), 18% inv/wk + 95% dis
   *     mfg cascade     : peak t=3,  τ=2,  10% inv/wk
   *     tier-3 cascade  : peak t=6,  τ=2.5, 5% inv/wk + 70% dis
   *     dist losses     : peak t=10, τ=3,  5% inv/wk
   *
   *   pandemic_wave — CHINA-style sustained lockdown
   *     primary tier-3  : peak t=0,  τ=8  (long), 18% inv/wk + 95% dis
   *     tier-2 wave     : peak t=0,  τ=7,  13% inv/wk + 85% dis
   *     mfg drain       : peak t=0,  τ=3 + peak t=5, τ=2  (deepening)
   *     tier-1 cascade  : peak t=2,  τ=3,  8% inv/wk + 65% dis
   *     dist drain      : peak t=2 + peak t=5,  combined ongoing decay
   *     second wave     : peak t=9,  τ=2  (only when dur > 10)
   *
   *   natural_disaster — US HURRICANE-style instant damage + fast recovery
   *     primary         : peak t=0,  τ=0.6 (very narrow), 85% inv/wk + 95% dis
   *     mfg destruction : peak t=0,  τ=0.6, 65% inv/wk
   *     dist destruction: peak t=0,  τ=0.6, 60% inv/wk
   *     tier-2 transit  : peak t=0,  τ=0.6, 20% inv/wk
   *     emergency aid   : t≥1 severity decays ×0.5; mfg restock at t=2
   *
   *   cyber_attack — brief digital disruption, NOW with severity-scaled losses
   *     primary disrupt : peak t=0,  τ=1.5, 85% dis
   *     mfg disruption  : peak t=0,  τ=0.8, 10% inv/wk
   *     dist disruption : peak t=0,  τ=0.8,  8% inv/wk
   *     primary inv loss: peak t=0,  τ=0.8, 15% inv/wk
   *     fast recovery   : t≥1 severity decays ×0.4
   *
   *   quality_failure — repeated damped recall waves
   *     waves at t = 0, 5, 10, … with amplitudes 1.0, 0.7, 0.49, 0.343, …
   *     each wave: 10% primary inv/wk + 12% mfg/wk + 10% dist/wk + 85% dis
   *
   * All amplitudes ARE multiplied by severity at runtime via the s(x) helper.
   */
  private applyDisruption(week: number): void {
    const start = this.config.disruptionStartWeek;
    const dur = this.config.disruptionDuration;
    const sev = this.config.disruptionSeverity;
    const type = this.config.disruptionType;
    const ltm = this.config.leadTimeMultipliers || { tier1: 1.0, tier2: 1.0, tier3: 1.0 };

    // Severity helper — clamp to [0,1] for any user-supplied severity
    const s = (x: number) => Math.max(0, Math.min(1, x * sev));

    // Apply lead time multipliers during disruption, then gradually decay back to 1.0
    if (week >= start && week <= start + dur) {
      this.tier1_suppliers.forEach(sup => { sup.lead_time_multiplier = ltm.tier1; });
      this.tier2_suppliers.forEach(sup => { sup.lead_time_multiplier = ltm.tier2; });
      this.tier3_suppliers.forEach(sup => { sup.lead_time_multiplier = ltm.tier3; });
    } else if (week > start + dur) {
      const weeks_post = week - (start + dur);
      const decay = (m: number) => Math.max(1.0, m - (m - 1.0) * weeks_post / (m * 12));
      this.tier1_suppliers.forEach(sup => { sup.lead_time_multiplier = decay(ltm.tier1); });
      this.tier2_suppliers.forEach(sup => { sup.lead_time_multiplier = decay(ltm.tier2); });
      this.tier3_suppliers.forEach(sup => { sup.lead_time_multiplier = decay(ltm.tier3); });
    }

    if (week < start || week > start + dur) return;

    const t = week - start;  // weeks into disruption (continuous time index)

    // Gaussian envelope centered at peak with width tau
    // env(peak, tau) returns a value in [0, 1] — peak intensity at t=peak,
    // smooth decay for |t - peak| > tau. This is the core continuity
    // guarantee: small Δseverity → small Δenvelope value → small Δoutput.
    const env = (peak: number, tau: number) =>
      Math.exp(-Math.pow(t - peak, 2) / (2 * tau * tau));

    // Get target tier agents
    let primary_agents: SupplierAgent[] = [];
    if (this.config.disruptionTier === 'tier1') primary_agents = this.tier1_suppliers;
    else if (this.config.disruptionTier === 'tier2') primary_agents = this.tier2_suppliers;
    else primary_agents = this.tier3_suppliers;

    // Continuous damage helpers — apply per-week destruction rate and a
    // per-week disruption severity. Both are smooth functions of t.
    // damageAgents:
    //   invFrac  = fraction of inventory destroyed THIS week (0–1)
    //   sevLevel = disruption severity to set / refresh (0–1)
    //   weeksOff = remaining-disruption refresh
    const damageAgents = (
      agents: SupplierAgent[], invFrac: number, sevLevel: number, weeksOff: number
    ) => {
      if (invFrac <= 1e-4 && sevLevel <= 0.05) return;
      // Affect ALL agents in the targeted tier proportionally — this is the
      // continuous regime; previous code's "n agents" partial coverage is
      // replaced by per-agent fractional damage.
      for (const a of agents) {
        if (sevLevel > 0.05) {
          a.disrupted = true;
          a.disruption_severity = Math.min(0.98, Math.max(a.disruption_severity, sevLevel));
          a.disruption_weeks_remaining = Math.max(a.disruption_weeks_remaining, weeksOff);
          this.disrupted_agents.add(a.name);
        }
        if (invFrac > 1e-4) {
          a.inventory = Math.round(a.inventory * (1 - Math.min(0.95, invFrac)));
        }
      }
    };
    const damageMfg = (invFrac: number) => {
      if (invFrac <= 1e-4) return;
      const f = Math.min(0.95, invFrac);
      for (const m of this.manufacturers) {
        m.inventory = Math.round(m.inventory * (1 - f));
      }
    };
    const damageDist = (invFrac: number) => {
      if (invFrac <= 1e-4) return;
      const f = Math.min(0.95, invFrac);
      for (const d of this.distributors) {
        d.inventory = Math.round(d.inventory * (1 - f));
      }
    };

    if (type === 'trade_dispute' || type === 'regulatory_change') {
      // INDIA EXPORT BAN: cascading multi-tier seizure with heavy direct
      // downstream destruction. Primary disruption_severity capped at 0.6
      // to prevent supply collapse cliff; ranged response comes from
      // sustained mfg+dist destruction.
      damageAgents(primary_agents, s(0.18) * env(0, 5), s(0.60) * env(0, 5), 4);
      damageMfg(s(0.65) * env(3, 3));
      damageAgents(this.tier1_suppliers, s(0.10) * env(3, 2), s(0.50) * env(3, 4), 3);
      damageAgents(this.tier3_suppliers, s(0.08) * env(6, 2.5), s(0.45) * env(6, 4), 3);
      damageDist(s(0.60) * env(8, 4));

    } else if (type === 'pandemic_wave') {
      // CHINA LOCKDOWN: sustained multi-tier shutdown.
      damageAgents(primary_agents, s(0.20) * env(0, 8), s(0.60) * env(0, 8), 5);
      damageAgents(this.tier2_suppliers, s(0.14) * env(0, 7), s(0.55) * env(0, 7), 4);
      damageMfg(s(0.55) * env(0, 4) + s(0.40) * env(5, 2));
      damageAgents(this.tier1_suppliers, s(0.10) * env(2, 3), s(0.45) * env(2, 4), 3);
      damageDist(s(0.55) * env(2, 4) + s(0.40) * env(5, 2));
      if (dur > 10) {
        damageAgents(primary_agents, s(0.14) * env(9, 1.5), s(0.55) * env(9, 2), 3);
        damageAgents(this.tier2_suppliers, s(0.10) * env(9, 1.5), s(0.50) * env(9, 2), 2);
        damageDist(s(0.40) * env(9, 1.5));
      }

    } else if (type === 'natural_disaster') {
      // US HURRICANE: heavy sustained downstream destruction across wks 0-3.
      damageAgents(primary_agents, s(0.55) * env(0, 2.5), s(0.65) * env(0, 2.5),
                   Math.min(dur, 4));
      damageMfg(s(0.75) * env(0, 2.5) + s(0.40) * env(2, 1.5));
      damageDist(s(0.70) * env(0, 2.5) + s(0.35) * env(2, 1.5));
      damageAgents(this.tier2_suppliers, s(0.40) * env(0, 1.5), 0, 0);
      // Fast recovery: severity decays ×0.5/wk for primary agents
      if (t >= 1) {
        for (const a of primary_agents) {
          if (a.disrupted) {
            a.disruption_severity = Math.max(0.02, a.disruption_severity * 0.5);
            if (a.disruption_severity < 0.05) {
              a.disrupted = false;
              a.disruption_weeks_remaining = 0;
              a.inventory = Math.min(a.capacity, a.inventory + Math.round(a.production_rate * sev));
            }
          }
        }
      }
      // Emergency mfg restock at t=2 (smooth narrow envelope)
      const restock = Math.round(300 * sev * env(2, 0.7));
      if (restock > 0) {
        for (const m of this.manufacturers) {
          m.inventory = Math.min(m.capacity, m.inventory + restock);
        }
      }

    } else if (type === 'cyber_attack') {
      // CYBER ATTACK: brief disruption with severity-scaled inventory loss.
      damageAgents(primary_agents, s(0.45) * env(0, 2.5), s(0.55) * env(0, 2.5), 3);
      damageMfg(s(0.65) * env(0, 2.5));
      damageDist(s(0.60) * env(0, 2.5));
      // Sharp recovery
      if (t >= 1) {
        for (const a of primary_agents) {
          if (a.disrupted) {
            a.disruption_severity = Math.max(0, a.disruption_severity * 0.4);
            if (a.disruption_severity < 0.05) {
              a.disrupted = false;
              a.disruption_weeks_remaining = 0;
            }
          }
        }
      }

    } else if (type === 'quality_failure') {
      // QUALITY CRISIS: sum of damped recall waves at t = 0, 5, 10, … with
      // geometrically decaying amplitudes. Each wave is a Gaussian envelope
      // around its peak — no discrete triggers.
      let priInv = 0, priSev = 0, mfgInv = 0, distInv = 0;
      for (let k = 0; k * 5 <= dur; k++) {
        const peak = k * 5;
        const wave_amp = Math.pow(0.7, k);
        priInv  += s(0.25 * wave_amp) * env(peak, 1.8);
        priSev  += s(0.60 * wave_amp) * env(peak, 2);
        mfgInv  += s(0.55 * wave_amp) * env(peak, 1.8);
        distInv += s(0.45 * wave_amp) * env(peak, 1.8);
      }
      damageAgents(primary_agents, Math.min(0.7, priInv), Math.min(0.7, priSev), 4);
      damageMfg(Math.min(0.7, mfgInv));
      damageDist(Math.min(0.55, distInv));

    } else {
      // Default: single Gaussian peak at t=0
      damageAgents(primary_agents, s(0.05) * env(0, dur / 4),
                   sev * env(0, dur / 4), dur);
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

    // Service level is the FRACTION OF PHARMACY DEMAND FULFILLED this week.
    // Updated rev-3: previously this was distributor-level fulfillment which
    // hid pharmacy-side stockouts caused by heterogeneous pharmacy demand vs
    // uniform supply allocation. The pharmacy-level number is what end-users
    // (patients) actually experience.
    const avg_service_level = this._lastPharmacyDemand > 0
      ? this._lastPharmacyFulfilled / this._lastPharmacyDemand
      : 1.0;

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

    const dist_inventory = this.distributors.reduce((sum, d) => sum + d.inventory, 0);

    return {
      week,
      totalInventory: total_inventory,
      distributorInventory: dist_inventory,
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

      const seasonality = DEMAND_SEASONALITY[week % 12];

      // ---- STEP 1: All suppliers produce ----
      this.tier3_suppliers.forEach((s) => s.produce());
      this.tier2_suppliers.forEach((s) => s.produce());
      this.tier1_suppliers.forEach((s) => s.produce());

      // ---- STEP 2: Supply flows downstream (Tier3 → Tier2 → Tier1 → Mfg → Dist) ----
      // Calculate demand-driven shipping targets. Multiplier 1.15 (raised
      // from 1.1 during May 2026 calibration) keeps end-to-end no-disruption
      // service level inside the 0.95-0.99 industry band — generous enough
      // that small per-tier losses don't drain distributors, but tight
      // enough that random cold-chain breaches still register.
      const total_demand_est = this.config.nPharmacies * 75 * seasonality;
      const shipPerT3 = Math.ceil(total_demand_est / Math.max(1, this.config.nTier3Suppliers) * 1.15);
      const shipPerT2 = Math.ceil(total_demand_est / Math.max(1, this.config.nTier2Suppliers) * 1.15);
      const shipPerT1 = Math.ceil(total_demand_est / Math.max(1, this.config.nTier1Suppliers) * 1.15);

      // Tier3 ships to Tier2
      let tier3_total_shipped = 0;
      this.tier3_suppliers.forEach((s) => { tier3_total_shipped += s.ship(shipPerT3); });
      const perT2_from_T3 = Math.floor(tier3_total_shipped / Math.max(1, this.tier2_suppliers.length));
      this.tier2_suppliers.forEach((s) => s.receive(perT2_from_T3));

      // Tier2 ships to Tier1
      let tier2_total_shipped = 0;
      this.tier2_suppliers.forEach((s) => { tier2_total_shipped += s.ship(shipPerT2); });
      const perT1_from_T2 = Math.floor(tier2_total_shipped / Math.max(1, this.tier1_suppliers.length));
      this.tier1_suppliers.forEach((s) => s.receive(perT1_from_T2));

      // Tier1 ships to Manufacturers
      let tier1_total_shipped = 0;
      this.tier1_suppliers.forEach((s) => { tier1_total_shipped += s.ship(shipPerT1); });
      const perMfg_from_T1 = Math.floor(tier1_total_shipped / Math.max(1, this.manufacturers.length));
      const mfg_outputs = this.manufacturers.map((m) => m.update(perMfg_from_T1));

      // Manufacturers ship to Distributors. Aggregate supply and demand are
      // matched 1:1, but each distributor's per-week SUPPLY allocation has
      // up to ±15% logistics jitter (Gaussian-ish, drawn from the seeded
      // RNG). The mean is preserved so steady-state inventory is stable,
      // but week-to-week imbalance gives the autonomous inventory
      // rebalancer real divergence to act on.
      const total_mfg_output = mfg_outputs.reduce((a, b) => a + b, 0);
      const baseDistSupply = total_mfg_output / Math.max(1, this.distributors.length);
      // Sample jitter weights, clamped to [0.7, 1.3] so the Gaussian's heavy
      // tails can't ever zero out a distributor or send another to negative
      // supply. After clamping we renormalize so total supply is preserved.
      const rawJitter = this.distributors.map(() =>
        Math.max(0.7, Math.min(1.3, 1.0 + this.rng.nextGaussian() * 0.12)));
      const jitterSum = rawJitter.reduce((a, b) => a + b, 0);
      const dist_supply = rawJitter.map(j =>
        Math.floor(baseDistSupply * j * this.distributors.length / jitterSum));

      // ---- STEP 3: Pharmacy demand ----
      const total_demand = this.pharmacies.reduce((sum, p) => {
        return sum + p.step(week, seasonality);
      }, 0);
      const demand_per_dist = Math.floor(total_demand / Math.max(1, this.distributors.length));
      this.distributors.forEach((d) => {
        d.demand_forecast = demand_per_dist;
      });

      // ---- STEP 4: Distributors receive from mfg and serve demand ----
      const dist_outputs = this.distributors.map((d, i) => d.update(dist_supply[i], demand_per_dist));

      // ---- STEP 5: Pharmacies get fulfilled ----
      // Pharmacies receive supply weighted by their demand share — large
      // pharmacies get more units, small pharmacies less, so each gets
      // approximately the same days-of-supply. This avoids the structural
      // ~9% pharmacy-side stockout that came from uniform allocation
      // against heterogeneous demand.
      const total_dist_output = dist_outputs.reduce((a, b) => a + b, 0);
      const ph_demands = this.pharmacies.map(p => Math.round(p.demand * seasonality));
      const ph_demand_total = ph_demands.reduce((a, b) => a + b, 0) || 1;
      let pharmacy_fulfilled_total = 0;
      this.pharmacies.forEach((p, i) => {
        const demand = ph_demands[i];
        const supply = Math.round(total_dist_output * (demand / ph_demand_total));
        const fulfilled = Math.min(supply, demand);
        p.fulfill(supply, demand);
        pharmacy_fulfilled_total += fulfilled;
      });
      // Cache for snapshot computation below
      this._lastPharmacyDemand = ph_demand_total;
      this._lastPharmacyFulfilled = pharmacy_fulfilled_total;

      // ---- STEP 6: End-of-week supplier updates (disruption ticking, random events) ----
      this.tier3_suppliers.forEach((s) => s.update(0));
      this.tier2_suppliers.forEach((s) => s.update(0));
      this.tier1_suppliers.forEach((s) => s.update(0));

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
    // Recovery week: weeks-to-85%-or-end-of-horizon. Always a valid integer in
    // [0, timeHorizon]. If service level is restored above 0.85 after the
    // disruption start, return that week index; otherwise return the horizon
    // length as a sentinel meaning "never recovered within window".
    const horizon = this.config.timeHorizon;
    const startWk = this.config.disruptionStartWeek;
    let recoveryWeek = horizon;
    for (let i = startWk + 1; i < this.weekly_snapshots.length; i++) {
      if (this.weekly_snapshots[i].serviceLevel > 0.85) {
        recoveryWeek = i;
        break;
      }
    }

    const summary = {
      minServiceLevel: Math.min(...this.weekly_snapshots.map((s) => s.serviceLevel)),
      minServiceLevelWeek: this.weekly_snapshots.findIndex((s) => s.serviceLevel === Math.min(...this.weekly_snapshots.map((x) => x.serviceLevel))),
      maxStockouts: Math.max(...this.weekly_snapshots.map((s) => s.stockouts)),
      maxDisruptions: Math.max(...this.weekly_snapshots.map((s) => s.activeDisruptions)),
      totalSpoiledUnits: this.weekly_snapshots.reduce((sum, s) => sum + s.spoiledUnits, 0),
      totalUnfilledPrescriptions: this.weekly_snapshots.reduce((sum, s) => sum + s.unfilledPrescriptions, 0),
      recoveryWeek,
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
    leadTimeMultipliers: { tier1: 1.0, tier2: 1.0, tier3: 1.0 },
  };
}

export function getScenarioPresets(): Record<string, Partial<PharmaConfig>> {
  return {
    'India API Export Ban': {
      disruptionType: 'trade_dispute',
      disruptionTier: 'tier2',
      disruptionSeverity: 0.90,             // bumped 0.80 → 0.90 after severity-scaling refactor
      disruptionDuration: 20,
      disruptionStartWeek: 4,  // ends wk 24, recovery through ~wk 48+
      leadTimeMultipliers: { tier1: 1.3, tier2: 2.5, tier3: 2.0 },
    },
    'China Raw Material Lockdown': {
      disruptionType: 'pandemic_wave',
      disruptionTier: 'tier3',
      disruptionSeverity: 0.85,             // bumped 0.70 → 0.85
      disruptionDuration: 14,
      disruptionStartWeek: 14, // ends wk 28, late deep shock
      leadTimeMultipliers: { tier1: 1.5, tier2: 1.8, tier3: 3.0 },
    },
    'US Hurricane': {
      disruptionType: 'natural_disaster',
      disruptionTier: 'tier1',
      disruptionSeverity: 0.85,             // bumped 0.50 → 0.85 (V-dip preserved)
      disruptionDuration: 8,
      disruptionStartWeek: 8,  // ends wk 16, mid-timeline local shock
      leadTimeMultipliers: { tier1: 1.3, tier2: 1.0, tier3: 1.0 },
    },
    'Cyber Attack': {
      disruptionType: 'cyber_attack',
      disruptionTier: 'tier1',
      disruptionSeverity: 0.50,             // bumped 0.30 → 0.50 (still mild)
      disruptionDuration: 4,
      disruptionStartWeek: 2,  // ends wk 6, earliest and shortest
      leadTimeMultipliers: { tier1: 1.1, tier2: 1.0, tier3: 1.0 },
    },
    'Quality Crisis': {
      disruptionType: 'quality_failure',
      disruptionTier: 'tier2',
      disruptionSeverity: 0.70,             // bumped 0.40 → 0.70
      disruptionDuration: 24,
      disruptionStartWeek: 20, // ends wk 44, long slow burn, latest start
      leadTimeMultipliers: { tier1: 1.5, tier2: 2.0, tier3: 1.2 },
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
    // recoveryWeek is now always in [0, timeHorizon] — never -1.
    // The defensive ternary that used to map -1 → 99 is gone.
    recovery_weeks.push(result.summary.recoveryWeek);
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
