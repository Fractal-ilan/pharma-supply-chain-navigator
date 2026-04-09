function generateScenario(disruptionStart: number, severity: number, recovery: number) {
  const base = {
    Service_Level: Array.from({ length: 52 }, (_, i) => {
      if (i < disruptionStart) return 0.95 - Math.random() * 0.02;
      const drop = severity * Math.exp(-((i - disruptionStart) / recovery));
      return Math.max(0.4, 0.95 - drop + (Math.random() * 0.01));
    }),
    Total_Inventory: Array.from({ length: 52 }, (_, i) => {
      if (i < disruptionStart) return 50000 - Math.floor(Math.random() * 2000);
      const drop = severity * 30000 * Math.exp(-((i - disruptionStart) / recovery));
      return Math.max(20000, Math.floor(50000 - drop + Math.random() * 1000));
    }),
    Stockouts: Array.from({ length: 52 }, (_, i) => {
      let acc = 0;
      for (let j = 0; j <= i; j++) {
        if (j >= disruptionStart && j < disruptionStart + recovery * 2) acc += Math.floor(severity * 8);
        else acc += Math.floor(Math.random() * 2);
      }
      return acc;
    }),
    Spoiled_Units: Array.from({ length: 52 }, (_, i) => {
      let acc = 0;
      for (let j = 0; j <= i; j++) acc += Math.floor(severity * 15 * Math.max(0.2, Math.exp(-((j - disruptionStart) / (recovery * 1.5)))));
      return acc;
    }),
    Batch_Failure_Rate: Array.from({ length: 52 }, (_, i) => {
      if (i < disruptionStart) return 0.02 + Math.random() * 0.01;
      const spike = severity * 0.08 * Math.exp(-((i - disruptionStart) / recovery));
      return Math.min(0.15, 0.02 + spike);
    }),
    Active_Disruptions: Array.from({ length: 52 }, (_, i) => {
      if (i < disruptionStart) return Math.floor(Math.random() * 3) + 1;
      const peak = Math.floor(severity * 15 * Math.exp(-((i - disruptionStart) / recovery)));
      return Math.max(1, peak);
    }),
    Shortage_Predictions: Array.from({ length: 52 }, (_, i) => Math.floor(i * severity * 6)),
    Rebalance_Actions: Array.from({ length: 52 }, (_, i) => Math.floor(i * severity * 10)),
    Compliance_Violations: Array.from({ length: 52 }, (_, i) => Math.floor(i * severity * 1.5)),
    Review_Time_Hours: Array.from({ length: 52 }, (_, i) => Math.floor(i * 12)),
    Network_Vulnerability: Array.from({ length: 52 }, (_, i) => {
      if (i < disruptionStart) return 0.35;
      return Math.min(0.9, 0.35 + severity * 0.5 * Math.exp(-((i - disruptionStart) / recovery)));
    }),
    Patients_Served: Array.from({ length: 52 }, (_, i) => i * 1500),
    Unfilled_Prescriptions: Array.from({ length: 52 }, (_, i) => Math.floor(i * severity * 20)),
  };
  return base;
}

export const scenarioData = {
  india_export_ban: generateScenario(8, 0.8, 12),
  china_lockdown: generateScenario(6, 0.9, 15),
  hurricane_us: generateScenario(10, 0.6, 8),
  cyber_attack: generateScenario(5, 0.7, 10),
  quality_crisis: generateScenario(12, 0.5, 20),
};

export const scenarioLabels: Record<string, string> = {
  india_export_ban: "India Export Ban",
  china_lockdown: "China Lockdown",
  hurricane_us: "US Hurricane",
  cyber_attack: "Cyber Attack",
  quality_crisis: "Quality Crisis",
};

export const scenarioColors: Record<string, string> = {
  india_export_ban: "#F59E0B",
  china_lockdown: "#EF4444",
  hurricane_us: "#3B82F6",
  cyber_attack: "#8B5CF6",
  quality_crisis: "#10B981",
};
