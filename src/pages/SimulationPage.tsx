import { useState, useCallback } from "react";
import { SimulationControls } from "@/components/SimulationControls";
import { SimulationResults } from "@/components/SimulationResults";
import type { SimulationResult } from "@/lib/pharmaABM";

export default function SimulationPage() {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleSimulationComplete = useCallback((r: SimulationResult) => {
    setResult(r);
  }, []);

  return (
    <div className="space-y-6">
      <SimulationControls
        onSimulationComplete={handleSimulationComplete}
        isRunning={isRunning}
        setIsRunning={setIsRunning}
      />
      <SimulationResults result={result} />
    </div>
  );
}
