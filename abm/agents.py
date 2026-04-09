"""
agents.py — Agent definitions for pharma supply chain ABM.

Each agent class models a distinct actor in the pharmaceutical supply chain
with autonomous decision-making, local state, and interaction protocols.
Uses a lightweight custom ABM framework (no mesa dependency).
"""

import numpy as np
import logging
from enum import Enum
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Tuple

logger = logging.getLogger(__name__)

# Global ID counter
_agent_counter = 0

def _next_id():
    global _agent_counter
    _agent_counter += 1
    return _agent_counter

def reset_id_counter():
    global _agent_counter
    _agent_counter = 0


# ---------------------------------------------------------------------------
# Enums & data classes
# ---------------------------------------------------------------------------

class SupplierTier(Enum):
    TIER1 = 1
    TIER2 = 2
    TIER3 = 3


class DisruptionType(Enum):
    natural_disaster = "natural_disaster"
    regulatory_change = "regulatory_change"
    trade_dispute = "trade_dispute"
    pandemic_wave = "pandemic_wave"
    cyber_attack = "cyber_attack"
    quality_failure = "quality_failure"
    cold_chain_breach = "cold_chain_breach"


@dataclass
class Shipment:
    origin_id: int
    destination_id: int
    drug_id: str
    quantity: float
    temperature_sensitive: bool = False
    current_temp: float = 4.0
    required_temp_range: Tuple[float, float] = (2.0, 8.0)
    transit_days_remaining: int = 7
    breached: bool = False
    batch_id: str = ""


@dataclass
class ComplianceRecord:
    agent_id: int
    step: int
    check_type: str
    passed: bool = True
    review_time_hours: float = 0.0
    deviations_found: int = 0
    capa_required: bool = False


# ---------------------------------------------------------------------------
# Base agent
# ---------------------------------------------------------------------------

class SupplyChainAgent:
    def __init__(self, model, region: str = "US", name: str = ""):
        self.unique_id = _next_id()
        self.model = model
        self.region = region
        self.name = name or f"Agent-{self.unique_id}"
        self.inventory: Dict[str, float] = {}
        self.capacity: float = 1000.0
        self.utilisation: float = 0.0
        self.disrupted: bool = False
        self.disruption_type: Optional[DisruptionType] = None
        self.disruption_duration: int = 0
        self.risk_score: float = 0.0
        self.compliance_records: List[ComplianceRecord] = []
        self.financial_cost: float = 0.0
        self.shipments_in_transit: List[Shipment] = []
        self.rng = model.rng

    def apply_disruption(self, dtype: DisruptionType, duration: int):
        self.disrupted = True
        self.disruption_type = dtype
        self.disruption_duration = duration
        self.capacity *= 0.3

    def recover(self):
        if self.disrupted:
            self.disruption_duration -= 1
            self.capacity = min(self.capacity * 1.15, 1000.0)
            if self.disruption_duration <= 0:
                self.disrupted = False
                self.disruption_type = None
                self.capacity = 1000.0

    def consume_inventory(self, drug_id: str, qty: float) -> float:
        available = self.inventory.get(drug_id, 0)
        consumed = min(available, qty)
        self.inventory[drug_id] = available - consumed
        return consumed

    def add_inventory(self, drug_id: str, qty: float):
        self.inventory[drug_id] = self.inventory.get(drug_id, 0) + qty

    def step(self):
        pass


# ---------------------------------------------------------------------------
# Supplier agents (Tier 1, 2, 3)
# ---------------------------------------------------------------------------

class SupplierAgent(SupplyChainAgent):
    def __init__(self, model, tier: SupplierTier, region: str = "IN",
                 products: List[str] = None, **kw):
        super().__init__(model, region=region, **kw)
        self.tier = tier
        self.products = products or ["generic_api"]
        self.reliability: float = self.rng.uniform(0.85, 0.99)
        self.lead_time_days: int = {
            SupplierTier.TIER1: 14,
            SupplierTier.TIER2: 30,
            SupplierTier.TIER3: 45,
        }[tier]
        self.downstream_ids: List[int] = []
        self.upstream_ids: List[int] = []
        self.financial_stability: float = self.rng.uniform(0.5, 1.0)
        self.esg_score: float = self.rng.uniform(0.3, 1.0)
        self.defect_rate: float = self.rng.uniform(0.001, 0.05)
        self.production_rate: float = 150.0

    def step(self):
        self.recover()
        cal = self.model.calibration

        region_risk = cal["regional_risk_scores"].get(self.region, 0.3)
        if not self.disrupted:
            for etype, base_prob in cal["event_probabilities"].items():
                tier_mult = {SupplierTier.TIER1: 1.0, SupplierTier.TIER2: 1.5, SupplierTier.TIER3: 2.0}
                prob = base_prob * region_risk * tier_mult[self.tier] * (2.0 - self.financial_stability)
                if self.rng.random() < prob:
                    duration = self.rng.integers(2, 13)
                    self.apply_disruption(DisruptionType(etype), duration)
                    break

        if self.capacity > 0:
            for product in self.products:
                qty = self.production_rate * (self.capacity / 1000.0) * self.reliability
                good_qty = qty * (1 - self.defect_rate)
                self.add_inventory(product, good_qty)

        self.utilisation = min(1.0, sum(self.inventory.values()) / max(self.capacity, 1))
        self.risk_score = (
            0.3 * region_risk
            + 0.2 * (1 - self.reliability)
            + 0.2 * (1 - self.financial_stability)
            + 0.15 * (1 - self.esg_score)
            + 0.15 * float(self.disrupted)
        )


# ---------------------------------------------------------------------------
# Manufacturer agent
# ---------------------------------------------------------------------------

class ManufacturerAgent(SupplyChainAgent):
    def __init__(self, model, region: str = "US", drugs: List[str] = None, **kw):
        super().__init__(model, region=region, **kw)
        self.drugs = drugs or ["drug_A", "drug_B"]
        self.batch_size: float = 500.0
        self.yield_rate: float = 0.92
        self.quality_score: float = 0.95
        self.rbe_enabled: bool = True
        self.predictive_maintenance: bool = True
        self.supplier_ids: List[int] = []
        self.distributor_ids: List[int] = []
        self.batches_produced: int = 0
        self.batches_failed: int = 0
        self.review_time_hours: float = 0.0
        self.equipment_health: float = 1.0

    def _run_batch(self, drug_id: str) -> Tuple[float, bool]:
        cal = self.model.calibration

        if self.predictive_maintenance:
            if self.equipment_health < 0.4:
                self.equipment_health = 0.95
                self.financial_cost += 5000
        else:
            self.equipment_health -= self.rng.uniform(0.005, 0.02)

        effective_yield = self.yield_rate
        if self.quality_score > 0.9:
            effective_yield += 0.05  # AI-driven yield boost

        batch_qty = self.batch_size * effective_yield * (self.capacity / 1000.0)
        batch_qty *= self.equipment_health

        failure_prob = cal["batch_failure_rate"] * (2.0 - self.equipment_health)
        failed = self.rng.random() < failure_prob

        if self.rbe_enabled:
            review_hours = 2.0
            deviations = int(self.rng.integers(0, 4))
            auto_caught = int(deviations * 0.95)
        else:
            review_hours = 8.0
            deviations = int(self.rng.integers(0, 4))
            auto_caught = int(deviations * 0.60)

        self.review_time_hours += review_hours
        self.compliance_records.append(ComplianceRecord(
            agent_id=self.unique_id,
            step=self.model.current_step,
            check_type="batch_review",
            passed=not failed,
            review_time_hours=review_hours,
            deviations_found=deviations,
            capa_required=deviations - auto_caught > 0,
        ))

        self.batches_produced += 1
        if failed:
            self.batches_failed += 1
            return 0.0, False
        return batch_qty, True

    def step(self):
        self.recover()

        total_input = 0
        for sid in self.supplier_ids:
            supplier = self.model.get_agent(sid)
            if supplier:
                for product in getattr(supplier, 'products', []):
                    consumed = supplier.consume_inventory(product, 50.0)
                    total_input += consumed

        input_ratio = min(total_input / (50.0 * max(len(self.supplier_ids), 1)), 1.0)
        for drug in self.drugs:
            if input_ratio > 0.1:
                qty, success = self._run_batch(drug)
                if success:
                    self.add_inventory(drug, qty * input_ratio)

        for did in self.distributor_ids:
            distributor = self.model.get_agent(did)
            if distributor:
                for drug in self.drugs:
                    ship_qty = self.consume_inventory(drug, 100.0)
                    if ship_qty > 0:
                        shipment = Shipment(
                            origin_id=self.unique_id,
                            destination_id=did,
                            drug_id=drug,
                            quantity=ship_qty,
                            temperature_sensitive=(drug == "drug_B"),
                            transit_days_remaining=int(self.rng.integers(3, 11)),
                            batch_id=f"B-{self.batches_produced}",
                        )
                        distributor.shipments_in_transit.append(shipment)


# ---------------------------------------------------------------------------
# Distributor agent
# ---------------------------------------------------------------------------

class DistributorAgent(SupplyChainAgent):
    def __init__(self, model, region: str = "US", **kw):
        super().__init__(model, region=region, **kw)
        self.demand_forecast: Dict[str, float] = {}
        self.actual_demand: Dict[str, float] = {}
        self.forecast_error: float = 0.117
        self.ai_forecasting: bool = True
        self.cold_storage_temp: float = 4.0
        self.pharmacy_ids: List[int] = []
        self.stockouts: int = 0
        self.spoiled_units: float = 0.0
        self.service_level: float = 1.0

    def _forecast_demand(self, drug_id: str) -> float:
        cal = self.model.calibration
        month = self.model.current_step % 12
        seasonal = cal["demand_seasonality"][month]
        base_demand = 80.0 * seasonal

        if self.ai_forecasting:
            error = cal["forecast_mape_ai"]
        else:
            error = cal["forecast_mape_baseline"]

        noise = self.rng.normal(0, error)
        forecast = base_demand * (1 + noise)
        self.demand_forecast[drug_id] = max(forecast, 0)
        self.actual_demand[drug_id] = base_demand
        self.forecast_error = abs(forecast - base_demand) / max(base_demand, 1)
        return forecast

    def _process_cold_chain(self):
        new_transit = []
        for shipment in self.shipments_in_transit:
            shipment.transit_days_remaining -= 1

            if shipment.temperature_sensitive:
                temp_drift = self.rng.normal(0, 1.5)
                shipment.current_temp += temp_drift
                lo, hi = shipment.required_temp_range
                if shipment.current_temp < lo or shipment.current_temp > hi:
                    shipment.breached = True
                    if self.ai_forecasting and self.rng.random() < 0.7:
                        shipment.current_temp = (lo + hi) / 2
                        shipment.breached = False

            if shipment.transit_days_remaining <= 0:
                if shipment.breached:
                    spoil_pct = self.rng.uniform(0.3, 1.0)
                    spoiled = shipment.quantity * spoil_pct
                    self.spoiled_units += spoiled
                    good = shipment.quantity - spoiled
                else:
                    good = shipment.quantity
                self.add_inventory(shipment.drug_id, good)
            else:
                new_transit.append(shipment)
        self.shipments_in_transit = new_transit

    def step(self):
        self.recover()
        self._process_cold_chain()

        drugs = list(set(
            [s.drug_id for s in self.shipments_in_transit]
            + list(self.inventory.keys())
            + ["drug_A", "drug_B"]
        ))
        fulfilled = 0
        total_demand = 0

        for drug_id in drugs:
            demand = self._forecast_demand(drug_id)
            total_demand += demand
            served = self.consume_inventory(drug_id, demand)
            fulfilled += served
            if served < demand * 0.9:
                self.stockouts += 1

            per_pharmacy = served / max(len(self.pharmacy_ids), 1)
            for pid in self.pharmacy_ids:
                pharmacy = self.model.get_agent(pid)
                if pharmacy:
                    pharmacy.add_inventory(drug_id, per_pharmacy)

        self.service_level = fulfilled / max(total_demand, 1)


# ---------------------------------------------------------------------------
# Pharmacy agent
# ---------------------------------------------------------------------------

class PharmacyAgent(SupplyChainAgent):
    def __init__(self, model, region: str = "US", **kw):
        super().__init__(model, region=region, **kw)
        self.patients_served: int = 0
        self.prescriptions_unfilled: int = 0
        self.demand_per_step: float = 20.0

    def step(self):
        self.recover()
        for drug_id in list(self.inventory.keys()):
            demand = self.demand_per_step * self.rng.uniform(0.8, 1.2)
            served = self.consume_inventory(drug_id, demand)
            self.patients_served += int(served)
            if served < demand * 0.5:
                self.prescriptions_unfilled += 1


# ---------------------------------------------------------------------------
# Regulator agent
# ---------------------------------------------------------------------------

class RegulatorAgent(SupplyChainAgent):
    def __init__(self, model, **kw):
        super().__init__(model, region="US", **kw)
        self.audits_conducted: int = 0
        self.violations_found: int = 0
        self.recalls_issued: int = 0
        self.audit_frequency: int = 4

    def step(self):
        if self.model.current_step % self.audit_frequency != 0:
            return

        for agent in self.model.agents:
            if isinstance(agent, ManufacturerAgent):
                self.audits_conducted += 1
                recent = [r for r in agent.compliance_records
                          if r.step >= self.model.current_step - self.audit_frequency]
                violations = sum(1 for r in recent if not r.passed or r.capa_required)
                self.violations_found += violations

                if violations >= 2:
                    agent.capacity *= 0.5
                    agent.financial_cost += 50000
                    self.recalls_issued += 1

                if agent.batches_produced > 0:
                    fail_rate = agent.batches_failed / agent.batches_produced
                    if fail_rate > 0.05:
                        agent.quality_score *= 0.9
                        self.violations_found += 1


# ---------------------------------------------------------------------------
# Autonomous Inventory Agent
# ---------------------------------------------------------------------------

class InventoryAutonomousAgent(SupplyChainAgent):
    def __init__(self, model, **kw):
        super().__init__(model, region="US", **kw)
        self.rebalance_actions: int = 0
        self.shortage_predictions: int = 0
        self.cost_savings: float = 0.0

    def step(self):
        distributors = [a for a in self.model.agents if isinstance(a, DistributorAgent)]
        if not distributors:
            return

        network_inventory: Dict[str, list] = {}
        for dist in distributors:
            for drug_id, qty in dist.inventory.items():
                if drug_id not in network_inventory:
                    network_inventory[drug_id] = []
                network_inventory[drug_id].append((dist, qty))

        for drug_id, entries in network_inventory.items():
            if len(entries) < 2:
                continue
            avg_qty = np.mean([qty for _, qty in entries])
            surplus = [(d, q) for d, q in entries if q > avg_qty * 1.3]
            deficit = [(d, q) for d, q in entries if q < avg_qty * 0.5]

            for s_dist, s_qty in surplus:
                for d_dist, d_qty in deficit:
                    transfer = min(s_qty - avg_qty, avg_qty - d_qty) * 0.5
                    if transfer > 10:
                        s_dist.consume_inventory(drug_id, transfer)
                        d_dist.add_inventory(drug_id, transfer)
                        self.rebalance_actions += 1
                        self.cost_savings += transfer * 0.5

        for drug_id, entries in network_inventory.items():
            total = sum(q for _, q in entries)
            total_demand = sum(d.actual_demand.get(drug_id, 100) for d in distributors)
            days_of_supply = total / max(total_demand, 1) * 30
            if days_of_supply < 14:
                self.shortage_predictions += 1
                for supplier in self.model.agents:
                    if isinstance(supplier, SupplierAgent) and not supplier.disrupted:
                        supplier.production_rate *= 1.2
                        break
