export const calibrationData = {
  regional_risk_scores: { IN: 0.65, CN: 0.72, US: 0.35, IE: 0.28, CH: 0.22 },
  baseline_shortage_rate: 0.05,
  tier2_disruption_share: 0.85,
  cold_chain_breach_rate: 0.08,
  batch_failure_rate: 0.02,
  rbe_time_reduction: 0.70,
  forecast_mape_baseline: 0.117,
  forecast_mape_ai: 0.06,
  demand_seasonality: [1.05, 0.95, 1.0, 1.1, 1.15, 1.2, 0.9, 0.85, 1.0, 1.1, 1.15, 1.25],
  avg_lead_time_days: { IN: 45, CN: 42, US: 14, IE: 21, CH: 18 },
  event_probabilities: {
    export_ban: 0.05, lockdown: 0.08, hurricane: 0.12,
    cyber_attack: 0.06, quality_event: 0.10,
  },
};
