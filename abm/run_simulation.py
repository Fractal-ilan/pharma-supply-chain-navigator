#!/usr/bin/env python3
"""
run_simulation.py — Main entry point for the Pharma Supply Chain ABM.

Runs the full simulation covering all 6 use cases:
  1. Mapping hidden vulnerabilities
  2. Testing mitigation strategies (scenario comparison)
  3. Drug shortage prediction
  4. Autonomous inventory and demand balancing
  5. Cold chain and logistics resilience
  6. Regulatory and compliance modeling

Calibrated with GDELT geopolitical data and FDA drug shortage data.

Usage:
    python run_simulation.py                          # Full run, live APIs
    python run_simulation.py --offline                # Fallback data only
    python run_simulation.py --steps 104 --scenarios  # 2-year + scenarios
"""

import argparse
import logging
import json
from pathlib import Path

from model import PharmaSupplyChainModel
from visualization import (
    plot_simulation_dashboard,
    plot_vulnerability_report,
    plot_scenario_comparison,
    generate_summary_report,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def run_baseline(args) -> PharmaSupplyChainModel:
    logger.info("=" * 60)
    logger.info("BASELINE RUN — All AI features enabled")
    logger.info("=" * 60)

    model = PharmaSupplyChainModel(
        n_tier1_suppliers=args.tier1,
        n_tier2_suppliers=args.tier2,
        n_tier3_suppliers=args.tier3,
        n_manufacturers=args.manufacturers,
        n_distributors=args.distributors,
        n_pharmacies=args.pharmacies,
        enable_ai_forecasting=True,
        enable_rbe=True,
        enable_predictive_maintenance=True,
        enable_autonomous_inventory=True,
        enable_cold_chain_ai=True,
        use_live_apis=not args.offline,
        seed=args.seed,
    )

    for step in range(args.steps):
        model.step()
        if (step + 1) % 10 == 0:
            d = model.collected_data[-1]
            logger.info(
                f"Step {step + 1}/{args.steps} | "
                f"Service Level: {d['Service_Level']:.1%} | "
                f"Disruptions: {int(d['Active_Disruptions'])} | "
                f"Inventory: {d['Total_Inventory']:.0f}"
            )
    return model


def run_no_ai_baseline(args) -> PharmaSupplyChainModel:
    logger.info("NO-AI BASELINE — All AI features disabled")
    model = PharmaSupplyChainModel(
        n_tier1_suppliers=args.tier1,
        n_tier2_suppliers=args.tier2,
        n_tier3_suppliers=args.tier3,
        n_manufacturers=args.manufacturers,
        n_distributors=args.distributors,
        n_pharmacies=args.pharmacies,
        enable_ai_forecasting=False,
        enable_rbe=False,
        enable_predictive_maintenance=False,
        enable_autonomous_inventory=False,
        enable_cold_chain_ai=False,
        use_live_apis=not args.offline,
        seed=args.seed,
    )
    for _ in range(args.steps):
        model.step()
    return model


def run_scenarios(args) -> dict:
    logger.info("SCENARIO COMPARISON")
    scenarios = ["india_export_ban", "china_lockdown", "hurricane_us",
                 "cyber_attack", "quality_crisis"]
    all_results = {}
    for scenario in scenarios:
        logger.info(f"Running scenario: {scenario}")
        model = PharmaSupplyChainModel(
            n_tier1_suppliers=args.tier1,
            n_tier2_suppliers=args.tier2,
            n_tier3_suppliers=args.tier3,
            n_manufacturers=args.manufacturers,
            n_distributors=args.distributors,
            n_pharmacies=args.pharmacies,
            enable_ai_forecasting=True, enable_rbe=True,
            enable_predictive_maintenance=True,
            enable_autonomous_inventory=True,
            enable_cold_chain_ai=True,
            use_live_apis=False,
            seed=args.seed,
        )
        results = model.run_scenario(scenario, steps=args.steps)
        all_results[scenario] = results
    return all_results


def main():
    parser = argparse.ArgumentParser(description="Pharma Supply Chain ABM")
    parser.add_argument("--steps", type=int, default=52)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--offline", action="store_true")
    parser.add_argument("--scenarios", action="store_true")
    parser.add_argument("--output-dir", type=str, default=".")
    parser.add_argument("--tier1", type=int, default=5)
    parser.add_argument("--tier2", type=int, default=15)
    parser.add_argument("--tier3", type=int, default=10)
    parser.add_argument("--manufacturers", type=int, default=3)
    parser.add_argument("--distributors", type=int, default=6)
    parser.add_argument("--pharmacies", type=int, default=20)
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # 1. Baseline
    model = run_baseline(args)

    # 2. Outputs
    logger.info("Generating dashboard...")
    plot_simulation_dashboard(model, str(output_dir))

    logger.info("Generating vulnerability report...")
    plot_vulnerability_report(model, str(output_dir))

    logger.info("Generating summary report...")
    report_path = generate_summary_report(model, str(output_dir))
    print("\n" + Path(report_path).read_text())

    # 3. Vulnerability JSON
    vuln = model.analyze_vulnerabilities()
    vuln_json = output_dir / "vulnerability_analysis.json"
    vuln_json.write_text(json.dumps(vuln, default=str, indent=2))

    # 4. Scenarios
    if args.scenarios:
        scenario_results = run_scenarios(args)
        plot_scenario_comparison(scenario_results, str(output_dir))
        logger.info("Scenario comparison saved.")

    # 5. AI vs No-AI comparison
    logger.info("Running no-AI baseline for comparison...")
    model_no_ai = run_no_ai_baseline(args)

    ai_data = model.get_dataframe_dict()
    no_ai_data = model_no_ai.get_dataframe_dict()

    import numpy as np
    comparison = {
        "AI_Enabled": {
            "avg_service_level": f"{np.mean(ai_data['Service_Level']):.1%}",
            "total_stockouts": int(ai_data["Stockouts"][-1]),
            "batch_failure_rate": f"{np.mean(ai_data['Batch_Failure_Rate']):.2%}",
            "spoiled_units": f"{ai_data['Spoiled_Units'][-1]:.0f}",
            "review_time_hours": f"{ai_data['Review_Time_Hours'][-1]:.0f}",
            "patients_served": int(ai_data["Patients_Served"][-1]),
        },
        "No_AI": {
            "avg_service_level": f"{np.mean(no_ai_data['Service_Level']):.1%}",
            "total_stockouts": int(no_ai_data["Stockouts"][-1]),
            "batch_failure_rate": f"{np.mean(no_ai_data['Batch_Failure_Rate']):.2%}",
            "spoiled_units": f"{no_ai_data['Spoiled_Units'][-1]:.0f}",
            "review_time_hours": f"{no_ai_data['Review_Time_Hours'][-1]:.0f}",
            "patients_served": int(no_ai_data["Patients_Served"][-1]),
        },
    }

    comp_path = output_dir / "ai_vs_no_ai_comparison.json"
    comp_path.write_text(json.dumps(comparison, indent=2))

    print("\n" + "=" * 70)
    print("AI-ENABLED vs NO-AI COMPARISON")
    print("=" * 70)
    for key in comparison["AI_Enabled"]:
        ai_val = str(comparison["AI_Enabled"][key])
        no_ai_val = str(comparison["No_AI"][key])
        print(f"  {key:30s}  AI: {ai_val:>12s}  |  No-AI: {no_ai_val:>12s}")

    logger.info("\nSimulation complete. All outputs saved to: %s", output_dir)


if __name__ == "__main__":
    main()
