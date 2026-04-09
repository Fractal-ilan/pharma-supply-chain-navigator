"""
model.py — Main simulation model for the pharma supply chain ABM.

Implements all 6 use cases with a lightweight custom framework (no mesa/networkx).
Graph analysis uses adjacency lists and custom BFS/centrality algorithms.
"""

import numpy as np
import logging
from typing import Optional, Dict, List, Set
from collections import defaultdict, deque

from agents import (
    SupplyChainAgent, SupplierAgent, ManufacturerAgent, DistributorAgent,
    PharmacyAgent, RegulatorAgent, InventoryAutonomousAgent,
    SupplierTier, DisruptionType, reset_id_counter,
)
from data_sources import load_calibration_data, PHARMA_REGIONS

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lightweight directed graph (replaces networkx)
# ---------------------------------------------------------------------------

class DiGraph:
    """Minimal directed graph for supply chain topology analysis."""

    def __init__(self):
        self.nodes: Dict[int, dict] = {}
        self.edges: Dict[int, Set[int]] = defaultdict(set)     # outgoing
        self.reverse: Dict[int, Set[int]] = defaultdict(set)    # incoming

    def add_node(self, nid: int, **attrs):
        self.nodes[nid] = attrs

    def add_edge(self, src: int, dst: int):
        self.edges[src].add(dst)
        self.reverse[dst].add(src)

    def number_of_nodes(self) -> int:
        return len(self.nodes)

    def descendants(self, nid: int) -> Set[int]:
        """All nodes reachable from nid via BFS."""
        visited = set()
        queue = deque(self.edges.get(nid, set()))
        while queue:
            node = queue.popleft()
            if node not in visited:
                visited.add(node)
                queue.extend(self.edges.get(node, set()) - visited)
        return visited

    def betweenness_centrality(self) -> Dict[int, float]:
        """Brandes algorithm for betweenness centrality."""
        C = {v: 0.0 for v in self.nodes}
        for s in self.nodes:
            S = []
            P = {w: [] for w in self.nodes}
            sigma = {t: 0.0 for t in self.nodes}
            sigma[s] = 1.0
            d = {t: -1 for t in self.nodes}
            d[s] = 0
            Q = deque([s])
            while Q:
                v = Q.popleft()
                S.append(v)
                for w in self.edges.get(v, set()):
                    if d[w] < 0:
                        Q.append(w)
                        d[w] = d[v] + 1
                    if d[w] == d[v] + 1:
                        sigma[w] += sigma[v]
                        P[w].append(v)
            delta = {v: 0.0 for v in self.nodes}
            while S:
                w = S.pop()
                for v in P[w]:
                    delta[v] += (sigma[v] / max(sigma[w], 1e-10)) * (1 + delta[w])
                if w != s:
                    C[w] += delta[w]
        n = len(self.nodes)
        if n > 2:
            norm = 1.0 / ((n - 1) * (n - 2))
            C = {v: c * norm for v, c in C.items()}
        return C

    def connected_components_undirected(self) -> int:
        """Count connected components treating graph as undirected."""
        adj = defaultdict(set)
        for src, dsts in self.edges.items():
            for dst in dsts:
                adj[src].add(dst)
                adj[dst].add(src)
        visited = set()
        components = 0
        for node in self.nodes:
            if node not in visited:
                components += 1
                queue = deque([node])
                while queue:
                    n = queue.popleft()
                    if n not in visited:
                        visited.add(n)
                        queue.extend(adj.get(n, set()) - visited)
        return components


# ---------------------------------------------------------------------------
# Main Model
# ---------------------------------------------------------------------------

class PharmaSupplyChainModel:
    """
    Agent-based model of a pharmaceutical supply chain.
    Calibrated with GDELT geopolitical data and FDA drug shortage data.
    """

    def __init__(
        self,
        n_tier1_suppliers: int = 5,
        n_tier2_suppliers: int = 15,
        n_tier3_suppliers: int = 10,
        n_manufacturers: int = 3,
        n_distributors: int = 6,
        n_pharmacies: int = 20,
        enable_ai_forecasting: bool = True,
        enable_rbe: bool = True,
        enable_predictive_maintenance: bool = True,
        enable_autonomous_inventory: bool = True,
        enable_cold_chain_ai: bool = True,
        inject_disruption: Optional[dict] = None,
        use_live_apis: bool = True,
        seed: int = 42,
    ):
        reset_id_counter()
        self.rng = np.random.default_rng(seed)
        self.current_step = 0
        self.agents: List[SupplyChainAgent] = []
        self._agent_map: Dict[int, SupplyChainAgent] = {}

        self.calibration = load_calibration_data(use_live_apis=use_live_apis)

        self.enable_ai_forecasting = enable_ai_forecasting
        self.enable_rbe = enable_rbe
        self.enable_predictive_maintenance = enable_predictive_maintenance
        self.enable_autonomous_inventory = enable_autonomous_inventory

        self.supply_network = DiGraph()
        self.collected_data: List[dict] = []

        # --- Create agents ---
        tier3_ids = []
        regions_t3 = ["CN", "IN", "BR", "CN", "IN", "DE", "CN", "IN", "JP", "CN"]
        for i in range(n_tier3_suppliers):
            region = regions_t3[i % len(regions_t3)]
            s = SupplierAgent(self, tier=SupplierTier.TIER3, region=region,
                              products=["raw_chemical"], name=f"Tier3-{region}-{i}")
            self._register(s)
            tier3_ids.append(s.unique_id)

        tier2_ids = []
        regions_t2 = ["IN", "CN", "IN", "CN", "IL", "IN", "CN", "DE", "IN", "BR",
                       "CN", "IN", "JP", "IN", "CN"]
        for i in range(n_tier2_suppliers):
            region = regions_t2[i % len(regions_t2)]
            s = SupplierAgent(self, tier=SupplierTier.TIER2, region=region,
                              products=["api_intermediate"], name=f"Tier2-{region}-{i}")
            upstream = list(self.rng.choice(tier3_ids, size=min(2, len(tier3_ids)), replace=False))
            s.upstream_ids = upstream
            self._register(s)
            tier2_ids.append(s.unique_id)

        tier1_ids = []
        regions_t1 = ["IN", "IE", "US", "CH", "DE"]
        for i in range(n_tier1_suppliers):
            region = regions_t1[i % len(regions_t1)]
            s = SupplierAgent(self, tier=SupplierTier.TIER1, region=region,
                              products=["finished_api"], name=f"Tier1-{region}-{i}")
            upstream = list(self.rng.choice(tier2_ids, size=min(3, len(tier2_ids)), replace=False))
            s.upstream_ids = upstream
            for uid in upstream:
                u_agent = self.get_agent(uid)
                if u_agent:
                    u_agent.downstream_ids.append(s.unique_id)
            self._register(s)
            tier1_ids.append(s.unique_id)

        mfg_ids = []
        for i in range(n_manufacturers):
            region = ["US", "IE", "CH"][i % 3]
            m = ManufacturerAgent(self, region=region, drugs=["drug_A", "drug_B"],
                                  name=f"Mfg-{region}-{i}")
            m.rbe_enabled = enable_rbe
            m.predictive_maintenance = enable_predictive_maintenance
            m.supplier_ids = list(self.rng.choice(tier1_ids, size=min(2, len(tier1_ids)), replace=False))
            self._register(m)
            mfg_ids.append(m.unique_id)

        dist_ids = []
        for i in range(n_distributors):
            region = ["US", "US", "DE", "JP", "BR", "IN"][i % 6]
            d = DistributorAgent(self, region=region, name=f"Dist-{region}-{i}")
            d.ai_forecasting = enable_ai_forecasting
            self._register(d)
            dist_ids.append(d.unique_id)

        for mid in mfg_ids:
            m = self.get_agent(mid)
            m.distributor_ids = list(self.rng.choice(dist_ids, size=min(3, len(dist_ids)), replace=False))

        pharm_ids = []
        for i in range(n_pharmacies):
            p = PharmacyAgent(self, region="US", name=f"Pharmacy-{i}")
            self._register(p)
            pharm_ids.append(p.unique_id)

        pharmacies_per_dist = max(1, len(pharm_ids) // len(dist_ids))
        for idx, did in enumerate(dist_ids):
            d = self.get_agent(did)
            start = idx * pharmacies_per_dist
            end = start + pharmacies_per_dist
            d.pharmacy_ids = pharm_ids[start:end]

        self.regulator = RegulatorAgent(self, name="FDA-Regulator")
        self._register(self.regulator)

        if enable_autonomous_inventory:
            self.inventory_agent = InventoryAutonomousAgent(self, name="Inventory-Auto-Agent")
            self._register(self.inventory_agent)

        self._build_network(tier3_ids, tier2_ids, tier1_ids, mfg_ids, dist_ids, pharm_ids)

        if inject_disruption:
            self._inject_disruption(inject_disruption)

    def _register(self, agent: SupplyChainAgent):
        self.agents.append(agent)
        self._agent_map[agent.unique_id] = agent

    def get_agent(self, agent_id: int) -> Optional[SupplyChainAgent]:
        return self._agent_map.get(agent_id)

    def _build_network(self, t3, t2, t1, mfg, dist, pharm):
        G = self.supply_network
        for nid in t3:
            G.add_node(nid, tier="tier3", region=self.get_agent(nid).region)
        for nid in t2:
            a = self.get_agent(nid)
            G.add_node(nid, tier="tier2", region=a.region)
            for uid in a.upstream_ids:
                G.add_edge(uid, nid)
        for nid in t1:
            a = self.get_agent(nid)
            G.add_node(nid, tier="tier1", region=a.region)
            for uid in a.upstream_ids:
                G.add_edge(uid, nid)
        for nid in mfg:
            a = self.get_agent(nid)
            G.add_node(nid, tier="manufacturer", region=a.region)
            for sid in a.supplier_ids:
                G.add_edge(sid, nid)
            for did in a.distributor_ids:
                G.add_edge(nid, did)
        for nid in dist:
            a = self.get_agent(nid)
            G.add_node(nid, tier="distributor", region=a.region)
            for pid in a.pharmacy_ids:
                G.add_edge(nid, pid)
        for nid in pharm:
            G.add_node(nid, tier="pharmacy", region=self.get_agent(nid).region)

    def _inject_disruption(self, config: dict):
        target_tier = config.get("tier", "tier2")
        dtype = DisruptionType(config.get("type", "natural_disaster"))
        duration = config.get("duration", 8)
        fraction = config.get("fraction", 0.3)

        targets = [a for a in self.agents
                    if isinstance(a, SupplierAgent)
                    and a.tier.name.lower() == target_tier]
        n_disrupt = max(1, int(len(targets) * fraction))
        chosen = list(self.rng.choice(targets, size=min(n_disrupt, len(targets)), replace=False))
        for agent in chosen:
            agent.apply_disruption(dtype, duration)

    # --- Metrics ---

    def _collect_metrics(self) -> dict:
        dists = [a for a in self.agents if isinstance(a, DistributorAgent)]
        mfgs = [a for a in self.agents if isinstance(a, ManufacturerAgent)]
        pharms = [a for a in self.agents if isinstance(a, PharmacyAgent)]

        total_batches = sum(m.batches_produced for m in mfgs)
        total_failed = sum(m.batches_failed for m in mfgs)

        inv_agent = getattr(self, 'inventory_agent', None)

        # Network vulnerability
        centrality = self.supply_network.betweenness_centrality()
        max_vuln = 0.0
        for nid, cent in centrality.items():
            agent = self.get_agent(nid)
            if agent and getattr(agent, 'disrupted', False):
                max_vuln = max(max_vuln, cent)

        return {
            "Total_Inventory": sum(sum(a.inventory.values()) for a in self.agents),
            "Service_Level": np.mean([d.service_level for d in dists]) if dists else 1.0,
            "Stockouts": sum(d.stockouts for d in dists),
            "Batch_Failure_Rate": total_failed / max(total_batches, 1),
            "Spoiled_Units": sum(d.spoiled_units for d in dists),
            "Active_Disruptions": sum(1 for a in self.agents if getattr(a, 'disrupted', False)),
            "Shortage_Predictions": inv_agent.shortage_predictions if inv_agent else 0,
            "Rebalance_Actions": inv_agent.rebalance_actions if inv_agent else 0,
            "Compliance_Violations": self.regulator.violations_found,
            "Review_Time_Hours": sum(m.review_time_hours for m in mfgs),
            "Network_Vulnerability": max_vuln,
            "Patients_Served": sum(p.patients_served for p in pharms),
            "Unfilled_Prescriptions": sum(p.prescriptions_unfilled for p in pharms),
        }

    # --- Vulnerability analysis (Use Case 1) ---

    def analyze_vulnerabilities(self) -> dict:
        G = self.supply_network
        results = {
            "critical_nodes": [],
            "single_points_of_failure": [],
            "concentration_risk": {},
            "cascade_impact": {},
        }

        centrality = G.betweenness_centrality()
        sorted_nodes = sorted(centrality.items(), key=lambda x: x[1], reverse=True)
        for nid, score in sorted_nodes[:10]:
            agent = self.get_agent(nid)
            if agent:
                results["critical_nodes"].append({
                    "id": nid, "name": agent.name,
                    "tier": str(getattr(agent, 'tier', 'N/A')),
                    "region": agent.region,
                    "centrality": round(score, 4),
                    "risk_score": round(agent.risk_score, 4),
                })

        base_components = G.connected_components_undirected()
        for nid in list(G.nodes.keys()):
            saved_edges_out = G.edges.pop(nid, set())
            saved_edges_in = set()
            for src, dsts in G.edges.items():
                if nid in dsts:
                    dsts.discard(nid)
                    saved_edges_in.add(src)
            saved_node = G.nodes.pop(nid)

            new_components = G.connected_components_undirected()
            if new_components > base_components:
                agent = self.get_agent(nid)
                if agent:
                    results["single_points_of_failure"].append({
                        "id": nid, "name": agent.name, "region": agent.region,
                    })

            G.nodes[nid] = saved_node
            G.edges[nid] = saved_edges_out
            for src in saved_edges_in:
                G.edges[src].add(nid)

        region_counts = {}
        for nid in G.nodes:
            agent = self.get_agent(nid)
            if agent and isinstance(agent, SupplierAgent):
                r = agent.region
                region_counts[r] = region_counts.get(r, 0) + 1
        total = sum(region_counts.values()) or 1
        results["concentration_risk"] = {r: round(c / total, 3) for r, c in region_counts.items()}

        tier2_agents = [a for a in self.agents
                        if isinstance(a, SupplierAgent) and a.tier == SupplierTier.TIER2]
        for agent in tier2_agents:
            desc = G.descendants(agent.unique_id)
            results["cascade_impact"][agent.name] = len(desc)

        return results

    # --- Step ---

    def step(self):
        self.current_step += 1
        order = list(self.agents)
        self.rng.shuffle(order)
        for agent in order:
            agent.step()
        self.collected_data.append(self._collect_metrics())

    def run_scenario(self, scenario_name: str, steps: int = 52) -> dict:
        scenarios = {
            "india_export_ban": {"tier": "tier2", "type": "trade_dispute", "duration": 12, "fraction": 0.5},
            "china_lockdown": {"tier": "tier3", "type": "pandemic_wave", "duration": 8, "fraction": 0.4},
            "hurricane_us": {"tier": "tier1", "type": "natural_disaster", "duration": 6, "fraction": 0.3},
            "cyber_attack": {"tier": "tier1", "type": "cyber_attack", "duration": 4, "fraction": 0.2},
            "quality_crisis": {"tier": "tier2", "type": "quality_failure", "duration": 16, "fraction": 0.2},
        }
        if scenario_name in scenarios:
            self._inject_disruption(scenarios[scenario_name])
        for _ in range(steps):
            self.step()
        return {k: {i: v for i, v in enumerate(
            [d[k] for d in self.collected_data]
        )} for k in self.collected_data[0]} if self.collected_data else {}

    def get_dataframe_dict(self) -> dict:
        """Return collected data as a dict of lists (column-oriented)."""
        if not self.collected_data:
            return {}
        keys = self.collected_data[0].keys()
        return {k: [d[k] for d in self.collected_data] for k in keys}
