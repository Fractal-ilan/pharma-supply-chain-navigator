import { useState, useCallback } from "react";
import { Slider } from "@/components/ui/slider";

interface WeekRangeSliderProps {
  totalWeeks: number;
  value: [number, number];
  onChange: (range: [number, number]) => void;
}

export function WeekRangeSlider({ totalWeeks, value, onChange }: WeekRangeSliderProps) {
  const handleChange = useCallback(
    (vals: number[]) => {
      if (vals.length === 2) {
        onChange([vals[0], vals[1]]);
      }
    },
    [onChange],
  );

  return (
    <div className="flex items-center gap-4 px-1">
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        Week {value[0] + 1}
      </span>
      <Slider
        min={0}
        max={totalWeeks - 1}
        step={1}
        value={value}
        onValueChange={handleChange}
        className="flex-1"
      />
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        Week {value[1] + 1}
      </span>
    </div>
  );
}

/** Hook for week range state */
export function useWeekRange(totalWeeks: number): {
  range: [number, number];
  setRange: (r: [number, number]) => void;
  sliceArr: <T>(arr: T[]) => T[];
} {
  const [range, setRange] = useState<[number, number]>([0, totalWeeks - 1]);
  const sliceArr = useCallback(
    <T,>(arr: T[]) => arr.slice(range[0], range[1] + 1),
    [range],
  );
  return { range, setRange, sliceArr };
}
