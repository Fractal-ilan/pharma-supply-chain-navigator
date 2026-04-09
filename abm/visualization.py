"""
visualization.py — Dashboard and plotting for pharma supply chain ABM.
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import seaborn as sns
import numpy as np
from pathlib import Path
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)

sns.set_theme(style="whitegrid", palette="deep")
COLORS = {
    "primary": "#1a73e8", "danger": "#d93025", "warning": "#f9ab00",
    "success": "#1e8e3e", "neutral": "#5f6368",
    "tier3": "#e8f0fe", "tier2": "#c6dafc", "tier1": "#7baaf7",
    "manufacturer": "#1a73e8", "distributor": "#1e8e3e", "pharmacy": "#f9ab00",
}


def plot_simulation_dashboard(model, output_dir: str = ".") -> str:
    data = model.get_dataframe_dict()
    if not data:
        return ""
    output_path = Path(output_dir)
    steps = range(len(data["Service_Level"]))

    fig = plt.figure(figsize=(24, 32))
    fig.suptitle("Pharma Supply Chain ABM — Simulation Dashboard",
                 fontsize=22, fontweight="bold", y=0.98)
    gs = gridspec.GridSpec(5, 3, hspace=0.35, wspace=0.3, top=0.95, bottom=0.03)

    panels = [
        (gs[0, 0], "Service_Level", "Service Level Over Time", "Service Level", COLORS["primary"], True),
        (gs[0, 1], "Total_Inventory", "Total Network Inventory", "Units", COLORS["success"], False),
        (gs[0, 2], "Active_Disruptions", "Active Disruptions", "Count", COLORS["danger"], False),
        (gs[1, 0], "Batch_Failure_Rate", "Batch Failure Rate (Compliance)", "Rate", COLORS["warning"], False),
        (gs[1, 1], "Spoiled_Units", "Cumulative Spoiled Units (Cold Chain)", "Units", COLORS["danger"], False),
        (gs[1, 2], "Review_Time_Hours", "Cumulative Batch Review Time", "Hours", COLORS["neutral"], False),
        (gs[2, 0], "Shortage_Predictions", "Shortage Predictions", "Count", COLORS["warning"], False),
        (gs[2, 1], "Rebalance_Actions", "Inventory Rebalance Actions", "Actions", COLORS["success"], False),
        (gs[2, 2], "Network_Vulnerability", "Network Vulnerability Score", "Score", COLORS["danger"], False),
        (gs[3, 0], "Patients_Served", "Patients Served", "Cumulative", COLORS["success"], False),
        (gs[3, 1], "Compliance_Violations", "Compliance Violations", "Count", COLORS["danger"], False),
        (gs[3, 2], "Stockouts", "Cumulative Stockouts", "Events", COLORS["warning"], False),
    ]

    for gs_pos, key, title, ylabel, color, add_target in panels:
        ax = fig.add_subplot(gs_pos)
        values = data[key]
        if key == "Active_Disruptions":
            ax.bar(steps, values, color=color, alpha=0.7)
        else:
            ax.plot(steps, values, color=color, linewidth=2)
            ax.fill_between(steps, 0, values, alpha=0.15, color=color)
        if add_target:
            ax.axhline(y=0.95, color=COLORS["danger"], linestyle="--", alpha=0.7, label="95% target")
            ax.set_ylim(0, 1.05)
            ax.legend()
        ax.set_title(title, fontweight="bold")
        ax.set_xlabel("Step (weeks)")
        ax.set_ylabel(ylabel)

    # Network graph panel
    ax_net = fig.add_subplot(gs[4, :])
    _draw_supply_network(model, ax_net)

    filepath = output_path / "simulation_dashboard.png"
    fig.savefig(filepath, dpi=150, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return str(filepath)


def _draw_supply_network(model, ax):
    G = model.supply_network
    if G.number_of_nodes() == 0:
        ax.text(0.5, 0.5, "No network data", ha="center", va="center")
        return

    tier_colors = {
        "tier3": COLORS["tier3"], "tier2": COLORS["tier2"], "tier1": COLORS["tier1"],
        "manufacturer": COLORS["manufacturer"], "distributor": COLORS["distributor"],
        "pharmacy": COLORS["pharmacy"],
    }
    tier_x = {"tier3": 0, "tier2": 1, "tier1": 2, "manufacturer": 3, "distributor": 4, "pharmacy": 5}

    # Position nodes by tier
    tier_lists = defaultdict(list)
    for nid, attrs in G.nodes.items():
        tier_lists[attrs.get("tier", "unknown")].append(nid)

    pos = {}
    for tier, nodes in tier_lists.items():
        x = tier_x.get(tier, 3)
        for i, nid in enumerate(nodes):
            y = (i + 1) / (len(nodes) + 1)
            pos[nid] = (x, y)

    # Draw edges
    for src, dsts in G.edges.items():
        if src in pos:
            for dst in dsts:
                if dst in pos:
                    ax.annotate("", xy=pos[dst], xytext=pos[src],
                                arrowprops=dict(arrowstyle="->", color="#cccccc", lw=0.5))

    # Draw nodes
    for nid, (x, y) in pos.items():
        tier = G.nodes[nid].get("tier", "unknown")
        color = tier_colors.get(tier, "#cccccc")
        agent = model.get_agent(nid)
        ec = COLORS["danger"] if agent and getattr(agent, 'disrupted', False) else "#333333"
        ax.scatter(x, y, s=120, c=color, edgecolors=ec, linewidths=2, zorder=5)

    ax.set_xlim(-0.5, 5.5)
    ax.set_ylim(-0.05, 1.05)
    ax.set_xticks(range(6))
    ax.set_xticklabels(["Tier 3\n(Raw)", "Tier 2\n(Inter.)", "Tier 1\n(API)",
                        "Mfg", "Distrib.", "Pharmacy"])
    ax.set_title("Supply Chain Network  |  Red border = disrupted", fontweight="bold", fontsize=14)

    from matplotlib.patches import Patch
    legend_items = [Patch(facecolor=c, label=l) for l, c in [
        ("Tier 3", COLORS["tier3"]), ("Tier 2", COLORS["tier2"]),
        ("Tier 1", COLORS["tier1"]), ("Manufacturer", COLORS["manufacturer"]),
        ("Distributor", COLORS["distributor"]), ("Pharmacy", COLORS["pharmacy"]),
    ]]
    ax.legend(handles=legend_items, loc="lower right", fontsize=9)


def plot_vulnerability_report(model, output_dir: str = ".") -> str:
    vuln = model.analyze_vulnerabilities()
    output_path = Path(output_dir)

    fig, axes = plt.subplots(2, 2, figsize=(16, 12))
    fig.suptitle("Use Case 1: Supply Chain Vulnerability Analysis",
                 fontsize=18, fontweight="bold")

    # Critical nodes
    ax = axes[0, 0]
    if vuln["critical_nodes"]:
        names = [n["name"][:20] for n in vuln["critical_nodes"][:8]]
        scores = [n["centrality"] for n in vuln["critical_nodes"][:8]]
        colors = [COLORS["danger"] if n.get("risk_score", 0) > 0.5 else COLORS["warning"]
                  for n in vuln["critical_nodes"][:8]]
        ax.barh(names, scores, color=colors)
        ax.set_title("Critical Nodes (Betweenness Centrality)", fontweight="bold")
        ax.set_xlabel("Centrality Score")
    else:
        ax.text(0.5, 0.5, "No data", ha="center", va="center")

    # Geographic concentration
    ax = axes[0, 1]
    if vuln["concentration_risk"]:
        regions = list(vuln["concentration_risk"].keys())
        shares = list(vuln["concentration_risk"].values())
        ax.pie(shares, labels=regions, autopct='%1.0f%%', startangle=90)
        ax.set_title("Supplier Geographic Concentration", fontweight="bold")

    # Cascade impact
    ax = axes[1, 0]
    if vuln["cascade_impact"]:
        sorted_impact = sorted(vuln["cascade_impact"].items(), key=lambda x: x[1], reverse=True)[:10]
        names = [x[0][:20] for x in sorted_impact]
        impacts = [x[1] for x in sorted_impact]
        ax.barh(names, impacts, color=COLORS["warning"])
        ax.set_title("Tier-2 Failure Cascade Impact", fontweight="bold")
        ax.set_xlabel("Downstream Nodes Affected")

    # SPOFs
    ax = axes[1, 1]
    spof = vuln["single_points_of_failure"]
    if spof:
        text = "\n".join([f"  {s['name']} ({s['region']})" for s in spof[:10]])
        ax.text(0.05, 0.9, text, transform=ax.transAxes, fontsize=10,
                verticalalignment='top', fontfamily='monospace')
        ax.set_title(f"Single Points of Failure ({len(spof)})", fontweight="bold",
                     color=COLORS["danger"])
    else:
        ax.text(0.5, 0.5, "None found", ha="center", va="center")
    ax.axis("off")

    plt.tight_layout()
    filepath = output_path / "vulnerability_report.png"
    fig.savefig(filepath, dpi=150, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return str(filepath)


def plot_scenario_comparison(results: dict, output_dir: str = ".") -> str:
    output_path = Path(output_dir)
    fig, axes = plt.subplots(2, 3, figsize=(20, 10))
    fig.suptitle("Use Case 2: Disruption Scenario Comparison",
                 fontsize=18, fontweight="bold")

    metrics = [
        ("Service_Level", "Service Level", axes[0, 0]),
        ("Total_Inventory", "Total Inventory", axes[0, 1]),
        ("Stockouts", "Stockouts", axes[0, 2]),
        ("Spoiled_Units", "Spoiled Units", axes[1, 0]),
        ("Batch_Failure_Rate", "Batch Failure Rate", axes[1, 1]),
        ("Active_Disruptions", "Active Disruptions", axes[1, 2]),
    ]

    palette = sns.color_palette("Set1", len(results))
    for metric_key, metric_label, ax in metrics:
        for i, (name, data) in enumerate(results.items()):
            if metric_key in data:
                values = list(data[metric_key].values())
                ax.plot(range(len(values)), values, label=name.replace("_", " ").title(),
                        color=palette[i], linewidth=2)
        ax.set_title(metric_label, fontweight="bold")
        ax.set_xlabel("Step")
        ax.legend(fontsize=7)

    plt.tight_layout()
    filepath = output_path / "scenario_comparison.png"
    fig.savefig(filepath, dpi=150, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return str(filepath)


def generate_summary_report(model, output_dir: str = ".") -> str:
    data = model.get_dataframe_dict()
    vuln = model.analyze_vulnerabilities()

    def last(key): return data[key][-1] if data.get(key) else 0
    def avg(key): return np.mean(data[key]) if data.get(key) else 0
    def mn(key): return min(data[key]) if data.get(key) else 0

    lines = [
        "=" * 70,
        "PHARMA SUPPLY CHAIN ABM — SIMULATION SUMMARY REPORT",
        "=" * 70,
        "",
        f"Simulation Duration: {len(data.get('Service_Level', []))} steps (weeks)",
        f"Total Agents: {len(model.agents)}",
        "",
        "--- KEY METRICS ---",
        f"Average Service Level:      {avg('Service_Level'):.1%}",
        f"Min Service Level:          {mn('Service_Level'):.1%}",
        f"Total Stockout Events:      {int(last('Stockouts'))}",
        f"Batch Failure Rate:         {avg('Batch_Failure_Rate'):.2%}",
        f"Total Spoiled Units:        {last('Spoiled_Units'):.0f}",
        f"Compliance Violations:      {int(last('Compliance_Violations'))}",
        f"Patients Served:            {int(last('Patients_Served')):,}",
        f"Unfilled Prescriptions:     {int(last('Unfilled_Prescriptions'))}",
        "",
        "--- USE CASE 1: VULNERABILITY ANALYSIS ---",
        f"Critical Nodes:             {len(vuln['critical_nodes'])}",
        f"Single Points of Failure:   {len(vuln['single_points_of_failure'])}",
        f"Geographic Concentration:   {vuln['concentration_risk']}",
        "",
        "--- USE CASE 3: SHORTAGE PREDICTIONS ---",
        f"Shortage Predictions Made:  {int(last('Shortage_Predictions'))}",
        "",
        "--- USE CASE 4: AUTONOMOUS INVENTORY ---",
        f"Rebalance Actions Taken:    {int(last('Rebalance_Actions'))}",
        "",
        "--- USE CASE 5: COLD CHAIN ---",
        f"Cold Chain Spoilage:        {last('Spoiled_Units'):.0f} units",
        "",
        "--- USE CASE 6: REGULATORY COMPLIANCE ---",
        f"Total Review Time:          {last('Review_Time_Hours'):.0f} hours",
        f"Compliance Violations:      {int(last('Compliance_Violations'))}",
        "",
        "=" * 70,
    ]

    report = "\n".join(lines)
    filepath = Path(output_dir) / "simulation_report.txt"
    filepath.write_text(report)
    return str(filepath)
