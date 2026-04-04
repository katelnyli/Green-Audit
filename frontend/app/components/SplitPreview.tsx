"use client";

import { useState } from "react";
import type { CodeFix } from "@/app/types/audit";
import LiveCO2Counter from "@/app/components/LiveCO2Counter";

interface Props {
  pageUrl: string;
  fixes: CodeFix[];
  baselineCo2: number;
}

export default function SplitPreview({ pageUrl, fixes, baselineCo2 }: Props) {
  const [applied, setApplied] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<"code" | "js">("code");

  const currentCo2 =
    baselineCo2 -
    fixes.reduce((sum, fix, i) => sum + (applied.has(i) ? fix.estimated_co2_saved : 0), 0);

  function toggle(i: number) {
    setApplied((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* CO2 counter */}
      <div className="rounded bg-[#0f1a0f] border border-[#1a2a1a] p-6">
        <p className="text-[#4a6a4a] text-sm mb-3 text-center font-mono">
          Live CO₂ estimate — toggle fixes to see impact
        </p>
        <LiveCO2Counter value={currentCo2} baseline={baselineCo2} />
      </div>

      {/* Split panes */}
      <div className="grid grid-cols-2 gap-4 h-[520px]">
        {/* Left: original site */}
        <div className="flex flex-col rounded overflow-hidden border border-[#1a2a1a]">
          <div className="px-4 py-2 bg-[#0f1a0f] border-b border-[#1a2a1a] text-xs text-[#4a6a4a] font-medium font-mono">
            Original
          </div>
          <iframe
            src={pageUrl}
            className="flex-1 w-full bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms"
            title="Original page"
          />
        </div>

        {/* Right: fix list */}
        <div className="flex flex-col rounded border border-[#1a2a1a] overflow-hidden">
          <div className="px-4 py-2 bg-[#0f1a0f] border-b border-[#1a2a1a] text-xs text-[#4a6a4a] font-medium font-mono">
            Code Fixes — click to apply
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-[#1a2a1a] bg-[#0a0f0a]">
            {fixes.map((fix, i) => (
              <div key={i} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-mono text-[#7ec87e] bg-[#0a1f0a] border border-[#1a3a1a] px-2 py-0.5 rounded">
                      {fix.flag_type}
                    </span>
                    <p className="mt-1.5 text-sm text-[#e8ede8] leading-snug">{fix.description}</p>
                    <p className="mt-1 text-xs text-[#7ec87e] font-mono">
                      Saves ~{fix.estimated_co2_saved.toFixed(4)}g CO₂
                    </p>
                  </div>
                  <button
                    onClick={() => toggle(i)}
                    className={`shrink-0 text-xs px-3 py-1.5 rounded font-medium font-mono transition-colors ${
                      applied.has(i)
                        ? "bg-[#7ec87e] text-[#0a0f0a]"
                        : "bg-[#0f1a0f] text-[#4a6a4a] border border-[#1a2a1a] hover:bg-[#1a2a1a]"
                    }`}
                  >
                    {applied.has(i) ? "Applied ✓" : "Apply"}
                  </button>
                </div>

                {/* Code snippet tabs */}
                <div className="rounded bg-[#0a0f0a] border border-[#1a2a1a] overflow-hidden">
                  <div className="flex text-xs border-b border-[#1a2a1a]">
                    {(["code", "js"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 py-1.5 transition-colors font-mono ${
                          activeTab === tab
                            ? "text-[#e8ede8] bg-[#0f1a0f]"
                            : "text-[#4a6a4a] hover:text-[#7ec87e]"
                        }`}
                      >
                        {tab === "code" ? "Fix code" : "Inject JS"}
                      </button>
                    ))}
                  </div>
                  <pre className="p-3 text-xs text-[#4a6a4a] overflow-x-auto max-h-32 leading-relaxed font-mono">
                    <code>{activeTab === "code" ? fix.code_snippet : fix.injection_js}</code>
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* TODO: connect to backend - live preview iframe injection not yet implemented */}
      {/* TODO: real postMessage injection for applying fixes to the live iframe */}
    </div>
  );
}
