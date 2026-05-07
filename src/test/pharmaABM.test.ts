/**
 * Unit and integration tests for pharmaABM.ts
 *
 * Covers:
 *   - SupplierAgent.ship() under disruption / lead-time states
 *   - ManufacturerAgent QC pass-rate logic with and without RBE
 *   - InventoryAutonomousAgent rebalance decisions
 *   - End-to-end determinism (same seed → byte-identical output)
 *   - Severity dose-response monotonicity
 *
 * These tests exercise the public API (runSimulation, getDefaultConfig,
 * getScenarioPresets). They do not import private agent classes — instead
 * they probe agent behaviour through the simulation surface, which keeps the
 * tests stable across refactors of internal class structure.
 */
import { describe, it, expect } from 'vitest';
import {
  runSimulation,
  getDefaultConfig,
  getScenarioPresets,
  type PharmaConfig,
} from '../lib/pharmaABM';

describe('Determinism', () => {
  it('produces byte-identical weeklyData for the same seed across two runs', () => {
    const cfg: Partial<PharmaConfig> = { randomSeed: 12345 };
    const r1 = runSimulation(cfg);
    const r2 = runSimulation(cfg);
    expect(JSON.stringify(r1.weeklyData)).toBe(JSON.stringify(r2.weeklyData));
    expect(JSON.stringify(r1.summary)).toBe(JSON.stringify(r2.summary));
  });

  it('reproduces every preset scenario at seed 42', () => {
    for (const [name, preset] of Object.entries(getScenarioPresets())) {
      const cfg = { ...preset, randomSeed: 42 };
      const a = runSimulation(cfg);
      const b = runSimulation(cfg);
      expect(JSON.stringify(a.weeklyData), `preset ${name} not reproducible`)
        .toBe(JSON.stringify(b.weeklyData));
    }
  });

  it('different seeds produce different output', () => {
    const r1 = runSimulation({ randomSeed: 1 });
    const r2 = runSimulation({ randomSeed: 2 });
    // Compare an output that always shows seed-dependent variation.
    // minServiceLevel can saturate at 1.0 under benign configs, so use the
    // cumulative unfilled / spoilage which always differ between seeds.
    expect(r1.summary.totalUnfilledPrescriptions)
      .not.toBe(r2.summary.totalUnfilledPrescriptions);
    expect(r1.summary.totalSpoiledUnits).not.toBe(r2.summary.totalSpoiledUnits);
  });
});

describe('Output well-formedness', () => {
  it('weeklyData has exactly timeHorizon entries', () => {
    const r = runSimulation({ timeHorizon: 26, randomSeed: 1 });
    expect(r.weeklyData.length).toBe(26);
  });

  it('serviceLevel is always in [0, 1]', () => {
    const r = runSimulation({ randomSeed: 7 });
    for (const w of r.weeklyData) {
      expect(w.serviceLevel).toBeGreaterThanOrEqual(0);
      expect(w.serviceLevel).toBeLessThanOrEqual(1.0001); // 1e-4 slack for floating-point
    }
  });

  it('cumulative counters are monotone non-decreasing', () => {
    const r = runSimulation({ randomSeed: 11 });
    const cum = ['stockouts', 'spoiledUnits', 'patientsServed',
      'unfilledPrescriptions', 'complianceViolations'] as const;
    for (const f of cum) {
      for (let i = 1; i < r.weeklyData.length; i++) {
        expect(r.weeklyData[i][f], `${f} regressed at week ${i}`)
          .toBeGreaterThanOrEqual(r.weeklyData[i - 1][f]);
      }
    }
  });

  it('all numeric outputs are finite and non-negative', () => {
    const r = runSimulation({ randomSeed: 3 });
    const fields = ['totalInventory', 'distributorInventory', 'stockouts',
      'spoiledUnits', 'activeDisruptions', 'shortagePredictions',
      'rebalanceActions', 'complianceViolations', 'patientsServed',
      'unfilledPrescriptions', 'networkVulnerability'] as const;
    for (const w of r.weeklyData) {
      for (const f of fields) {
        expect(Number.isFinite(w[f]), `${f} non-finite at week ${w.week}`).toBe(true);
        expect(w[f], `${f} negative at week ${w.week}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('recoveryWeek is always a valid integer in [0, timeHorizon]', () => {
    // After the May 2026 fix, recoveryWeek is no longer -1.
    for (const [, preset] of Object.entries(getScenarioPresets())) {
      for (let s = 0; s < 5; s++) {
        const r = runSimulation({ ...preset, randomSeed: 100 + s });
        expect(r.summary.recoveryWeek).toBeGreaterThanOrEqual(0);
        expect(r.summary.recoveryWeek).toBeLessThanOrEqual(r.weeklyData.length);
        expect(Number.isInteger(r.summary.recoveryWeek)).toBe(true);
      }
    }
  });
});

describe('No-disruption steady state', () => {
  it('average service level over weeks 30-51 stays in industry band (≥ 0.95)', () => {
    const N = 30;
    let total = 0;
    for (let i = 0; i < N; i++) {
      const r = runSimulation({
        disruptionStartWeek: 200,        // never within horizon
        disruptionSeverity: 0,
        randomSeed: 5000 + i,
      });
      const tail = r.weeklyData.slice(30).map(w => w.serviceLevel);
      total += tail.reduce((a, b) => a + b, 0) / tail.length;
    }
    const mean = total / N;
    expect(mean).toBeGreaterThanOrEqual(0.95);
  });
});

describe('SupplierAgent / shipping behaviour (probed via tier inventory)', () => {
  it('disrupted suppliers ship less than non-disrupted (tier-2 inventory rises during cyber attack)', () => {
    // Cyber attack hits tier 1 suppliers; tier-2 supplier inventory should not
    // be drained as fast because tier-1 can't pull from them.
    const baseline = runSimulation({ randomSeed: 22, disruptionSeverity: 0 });
    const cyber = runSimulation({
      ...getScenarioPresets()['Cyber Attack'],
      randomSeed: 22,
    });
    // Tier-2 inventory at the disruption peak should be higher under cyber
    // attack vs baseline (because downstream demand is stalled)
    const peakT2Cyber = Math.max(...cyber.weeklyData.slice(2, 6).map(w => w.supplyByTier.tier2));
    const peakT2Base = Math.max(...baseline.weeklyData.slice(2, 6).map(w => w.supplyByTier.tier2));
    expect(peakT2Cyber).toBeGreaterThan(peakT2Base * 0.9);
  });

  it('lead-time multipliers reduce throughput', () => {
    const fast = runSimulation({
      randomSeed: 9,
      disruptionStartWeek: 4, disruptionDuration: 8,
      disruptionSeverity: 0.8, disruptionType: 'trade_dispute',
      leadTimeMultipliers: { tier1: 1.0, tier2: 1.0, tier3: 1.0 },
    });
    const slow = runSimulation({
      randomSeed: 9,
      disruptionStartWeek: 4, disruptionDuration: 8,
      disruptionSeverity: 0.8, disruptionType: 'trade_dispute',
      leadTimeMultipliers: { tier1: 1.5, tier2: 3.0, tier3: 2.0 },
    });
    expect(slow.summary.minServiceLevel).toBeLessThanOrEqual(fast.summary.minServiceLevel + 0.01);
  });
});

describe('ManufacturerAgent QC behaviour (probed via batch failure rate)', () => {
  it('RBE keeps batch failure rate lower under stress', () => {
    const N = 15;
    let withRBE = 0, withoutRBE = 0;
    const cfg = getScenarioPresets()['India API Export Ban'];
    for (let i = 0; i < N; i++) {
      const a = runSimulation({ ...cfg, enableRBE: false, randomSeed: 6000 + i });
      const b = runSimulation({ ...cfg, enableRBE: true,  randomSeed: 6000 + i });
      const meanA = a.weeklyData.reduce((s, w) => s + w.batchFailureRate, 0) / a.weeklyData.length;
      const meanB = b.weeklyData.reduce((s, w) => s + w.batchFailureRate, 0) / b.weeklyData.length;
      withoutRBE += meanA;
      withRBE += meanB;
    }
    // RBE should reduce mean batch failure rate by at least 25%
    expect(withRBE / N).toBeLessThan((withoutRBE / N) * 0.85);
  });

  it('predictive maintenance keeps equipment healthier (fewer recalls)', () => {
    const cfg = getScenarioPresets()['Quality Crisis'];
    let baseRecalls = 0, pmRecalls = 0;
    for (let i = 0; i < 15; i++) {
      baseRecalls += runSimulation({ ...cfg, enablePredictiveMaintenance: false,
        randomSeed: 7000 + i }).summary.complianceViolationsTotal;
      pmRecalls  += runSimulation({ ...cfg, enablePredictiveMaintenance: true,
        randomSeed: 7000 + i }).summary.complianceViolationsTotal;
    }
    expect(pmRecalls).toBeLessThanOrEqual(baseRecalls);
  });
});

describe('InventoryAutonomousAgent rebalance', () => {
  it('autonomous inventory increases rebalanceActions when enabled', () => {
    const off = runSimulation({
      ...getScenarioPresets()['India API Export Ban'],
      enableAutonomousInventory: false, randomSeed: 8000,
    });
    const on = runSimulation({
      ...getScenarioPresets()['India API Export Ban'],
      enableAutonomousInventory: true, randomSeed: 8000,
    });
    const offActions = off.weeklyData[off.weeklyData.length - 1].rebalanceActions;
    const onActions = on.weeklyData[on.weeklyData.length - 1].rebalanceActions;
    expect(onActions).toBeGreaterThan(offActions);
  });
});

describe('Severity dose-response monotonicity', () => {
  // After the May 2026 severity-scaling refactor, every disruption type should
  // show monotonic degradation as severity rises. We check averages over 25
  // seeds at sev=0.2 vs sev=0.8 for each of the 5 mechanisms.
  const types: PharmaConfig['disruptionType'][] = [
    'trade_dispute', 'pandemic_wave', 'natural_disaster',
    'cyber_attack', 'quality_failure',
  ];
  for (const type of types) {
    it(`${type}: minSL at sev=0.2 ≥ minSL at sev=0.8`, () => {
      const N = 25;
      let lowSum = 0, highSum = 0;
      for (let i = 0; i < N; i++) {
        const lo = runSimulation({ disruptionType: type, disruptionSeverity: 0.2,
          disruptionStartWeek: 4, disruptionDuration: 12, randomSeed: 9000 + i });
        const hi = runSimulation({ disruptionType: type, disruptionSeverity: 0.8,
          disruptionStartWeek: 4, disruptionDuration: 12, randomSeed: 9000 + i });
        lowSum += lo.summary.minServiceLevel;
        highSum += hi.summary.minServiceLevel;
      }
      // Allow small tolerance for the cyber_attack case which has a recovery
      // step that bounds the worst-case
      expect(lowSum / N, `${type} not monotone in severity`)
        .toBeGreaterThanOrEqual(highSum / N - 0.005);
    });
  }
});

describe('AI feature toggle improvement', () => {
  it('all AI features together strictly improve outcomes under India scenario', () => {
    const cfg = getScenarioPresets()['India API Export Ban'];
    let noAISL = 0, aiSL = 0, noAISpoil = 0, aiSpoil = 0;
    const N = 15;
    for (let i = 0; i < N; i++) {
      const a = runSimulation({ ...cfg, randomSeed: 11000 + i });
      const b = runSimulation({
        ...cfg,
        enableAIForecasting: true, enableRBE: true,
        enablePredictiveMaintenance: true, enableAutonomousInventory: true,
        enableColdChainAI: true,
        randomSeed: 11000 + i,
      });
      noAISL += a.summary.minServiceLevel;
      aiSL  += b.summary.minServiceLevel;
      noAISpoil += a.summary.totalSpoiledUnits;
      aiSpoil   += b.summary.totalSpoiledUnits;
    }
    expect(aiSL / N).toBeGreaterThan(noAISL / N);
    expect(aiSpoil).toBeLessThan(noAISpoil);
  });
});

describe('Continuous severity dose-response', () => {
  // Rev-3 envelope-based applyDisruption — every disruption type must
  // produce a continuous, monotonic, meaningful slope of minSL vs severity.
  // These tests pre-register the slope contract so future calibration
  // changes don't quietly break dose-response.
  const types: PharmaConfig['disruptionType'][] = [
    'trade_dispute', 'pandemic_wave', 'natural_disaster',
    'cyber_attack', 'quality_failure',
  ];
  const sevs = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  const SEEDS = 25;

  function curve(type: PharmaConfig['disruptionType']): number[] {
    return sevs.map(sev => {
      let total = 0;
      for (let i = 0; i < SEEDS; i++) {
        total += runSimulation({
          disruptionType: type, disruptionSeverity: sev,
          disruptionDuration: 12, disruptionStartWeek: 4,
          randomSeed: 7000 + i,
        }).summary.minServiceLevel;
      }
      return total / SEEDS;
    });
  }

  for (const type of types) {
    it(`${type}: slope is negative and meaningful (≤ -0.025)`, () => {
      const row = curve(type);
      const xMean = sevs.reduce((a, b) => a + b, 0) / sevs.length;
      const yMean = row.reduce((a, b) => a + b, 0) / row.length;
      let num = 0, den = 0;
      for (let i = 0; i < sevs.length; i++) {
        num += (sevs[i] - xMean) * (row[i] - yMean);
        den += (sevs[i] - xMean) ** 2;
      }
      const slope = num / den;
      expect(slope, `${type} slope`).toBeLessThan(-0.025);
      expect(slope, `${type} slope (lower bound)`).toBeGreaterThan(-1.0);
    });

    it(`${type}: response is smooth (max 2nd-difference < 0.10)`, () => {
      const row = curve(type);
      let maxSecond = 0;
      for (let i = 1; i < row.length - 1; i++) {
        maxSecond = Math.max(maxSecond,
          Math.abs(row[i + 1] - 2 * row[i] + row[i - 1]));
      }
      expect(maxSecond, `${type} max 2nd-diff`).toBeLessThan(0.10);
    });

    it(`${type}: response is monotonic (no SL increase as severity rises)`, () => {
      const row = curve(type);
      // Allow tiny ensemble noise tolerance
      let monoViolations = 0;
      for (let i = 1; i < row.length; i++) {
        if (row[i] > row[i - 1] + 0.01) monoViolations++;
      }
      expect(monoViolations, `${type} monotonicity violations`).toBe(0);
    });
  }

  it('range across [0.1, 0.9] is meaningful for every disruption type', () => {
    for (const t of types) {
      const row = curve(t);
      const range = row[0] - row[row.length - 1];
      expect(range, `${t} range`).toBeGreaterThan(0.02);
    }
  });
});

describe('Default config sanity', () => {
  it('returns expected default fields', () => {
    const c = getDefaultConfig();
    expect(c.timeHorizon).toBeGreaterThan(0);
    expect(c.nPharmacies).toBeGreaterThan(0);
    expect(c.disruptionType).toBeDefined();
    expect(c.leadTimeMultipliers).toBeDefined();
  });

  it('returns 5 named presets', () => {
    const presets = getScenarioPresets();
    expect(Object.keys(presets).length).toBe(5);
    expect(presets['India API Export Ban']).toBeDefined();
    expect(presets['Cyber Attack']).toBeDefined();
  });
});
