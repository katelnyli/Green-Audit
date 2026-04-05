"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  value: number;   // current CO2 grams
  baseline: number; // original CO2 grams for % calc
}

export default function LiveCO2Counter({ value, baseline }: Props) {
  const [displayed, setDisplayed] = useState<number | null>(null);
  const prevRef = useRef(value);

  useEffect(() => {
    if (displayed === null) {
      setDisplayed(value);
      prevRef.current = value;
      return;
    }

    const start = prevRef.current;
    const end = value;
    if (start === end) return;

    const duration = 600;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(start + (end - start) * eased);
      if (progress < 1) requestAnimationFrame(tick);
      else prevRef.current = end;
    }

    requestAnimationFrame(tick);
  }, [value]);

  const saved = baseline - value;
  const pctSaved = baseline > 0 ? Math.round((saved / baseline) * 100) : 0;

  if (displayed === null) {
    return (
      <div className="text-center">
        <p className="text-5xl font-bold tabular-nums text-[#7ec87e] font-sans">
          {value.toFixed(2)}
          <span className="text-2xl font-normal text-[#4a6a4a] ml-1">gCO₂</span>
        </p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <p className="text-5xl font-bold tabular-nums text-[#7ec87e] font-sans">
        {displayed.toFixed(2)}
        <span className="text-2xl font-normal text-[#4a6a4a] ml-1">gCO₂</span>
      </p>
      {saved > 0 && (
        <p className="mt-1 text-[#7ec87e] text-sm font-medium font-sans">
          ↓ {saved.toFixed(2)}g saved ({pctSaved}% reduction)
        </p>
      )}
    </div>
  );
}
