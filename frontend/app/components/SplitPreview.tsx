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
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
        <p className="text-zinc-500 text-sm mb-3 text-center">
          Live CO₂ estimate — toggle fixes to see impact
        </p>
        <LiveCO2Counter value={currentCo2} baseline={baselineCo2} />
      </div>

      {/* Split panes */}
      <div className="grid grid-cols-2 gap-4 h-[520px]">
        {/* Left: original site */}
        <div className="flex flex-col rounded-xl overflow-hidden border border-zinc-800">
          <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-400 font-medium">
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
        <div className="flex flex-col rounded-xl border border-zinc-800 overflow-hidden">
          <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-400 font-medium">
            Code Fixes — click to apply
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-800">
            {fixes.map((fix, i) => (
              <div key={i} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-mono text-green-500 bg-green-950 px-2 py-0.5 rounded">
                      {fix.flag_type}
                    </span>
                    <p className="mt-1.5 text-sm text-zinc-300 leading-snug">{fix.description}</p>
                    <p className="mt-1 text-xs text-green-600">
                      Saves ~{fix.estimated_co2_saved.toFixed(4)}g CO₂
                    </p>
                  </div>
                  <button
                    onClick={() => toggle(i)}
                    className={`shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      applied.has(i)
                        ? "bg-green-700 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    {applied.has(i) ? "Applied ✓" : "Apply"}
                  </button>
                </div>

                {/* Code snippet tabs */}
                <div className="rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden">
                  <div className="flex text-xs border-b border-zinc-800">
                    {(["code", "js"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 py-1.5 transition-colors ${
                          activeTab === tab
                            ? "text-white bg-zinc-800"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {tab === "code" ? "Fix code" : "Inject JS"}
                      </button>
                    ))}
                  </div>
                  <pre className="p-3 text-xs text-zinc-300 overflow-x-auto max-h-32 leading-relaxed">
                    <code>{activeTab === "code" ? fix.code_snippet : fix.injection_js}</code>
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
