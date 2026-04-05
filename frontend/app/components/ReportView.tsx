"use client";

import { useState } from "react";
import type { AuditResult, Impact } from "@/app/types/audit";

const IMPACT_COLORS: Record<Impact, string> = {
  high: "bg-[#2a0f0f] text-[#c87e7e] border-[#4a1a1a]",
  medium: "bg-[#2a1f0a] text-[#c8a87e] border-[#4a3a1a]",
  low: "bg-[#0a1f0a] text-[#7ea87e] border-[#1a3a1a]",
};

function getScoreColor(score: number): string {
  if (score < 50) return "#c87e7e";
  if (score < 70) return "#c8a87e";
  return "#7ec87e";
}

function fmt(bytes: number) {
  if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000).toFixed(0)} KB`;
}

function safePct(numerator: number, denominator: number): number {
  if (!denominator || !isFinite(denominator)) return 0;
  return (numerator / denominator) * 100;
}

export default function ReportView({ result }: { result: AuditResult }) {
  const { summary, pages, fixes } = result;
  const [selectedFixes, setSelectedFixes] = useState<Set<number>>(
    new Set(fixes.map((_, i) => i)) // all checked by default
  );
  const [previewMode, setPreviewMode] = useState<"before" | "after">("before");

  // Sort fixes by CO2 savings (highest to lowest)
  const sortedFixes = [...fixes]
    .map((fix, i) => ({ fix, index: i }))
    .sort((a, b) => b.fix.estimated_co2_saved - a.fix.estimated_co2_saved);

  // Calculate potential CO2 savings
  const totalPotentialSavings = fixes.reduce((sum, fix) => sum + fix.estimated_co2_saved, 0);
  const selectedSavings = Array.from(selectedFixes).reduce(
    (sum, idx) => sum + fixes[idx].estimated_co2_saved,
    0
  );
  // Calculate average performance score
  const avgPerformance = pages.length > 0
    ? Math.round(pages.reduce((sum, p) => sum + p.lighthouse.performance, 0) / pages.length)
    : 0;

  // Annual CO₂ projection at 1,000 daily visitors
  const avgCo2PerPage = summary.total_pages_crawled > 0
    ? summary.total_estimated_co2_grams / summary.total_pages_crawled
    : 0;
  const annualCo2Kg = (avgCo2PerPage * 1_000 * 365) / 1_000_000; // grams → kg

  // Calculate "after" stats
  const co2Total = summary.total_estimated_co2_grams || 1; // guard division by zero
  const afterCO2 = summary.total_estimated_co2_grams - selectedSavings;
  const afterAnnualCo2Kg = ((avgCo2PerPage - selectedSavings / (summary.total_pages_crawled || 1)) * 1_000 * 365) / 1_000_000;
  const afterPerformance = Math.min(100, avgPerformance + Math.round(safePct(selectedSavings, co2Total) * 0.3));

  const toggleFix = (idx: number) => {
    setSelectedFixes((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const exportPatch = () => {
    const domain = new URL(result.target_url).hostname;
    const timestamp = new Date().toISOString();
    const date = timestamp.split("T")[0];

    // Build GTM tags from selected fixes
    const tags: any[] = [];
    const usedTagNames = new Set<string>();
    selectedFixes.forEach((idx, tagId) => {
      const fix = fixes[idx];
      const rawPath = new URL(fix.page_url).pathname || "/";
      const normalizedPath = rawPath === "/" ? "home" : rawPath.replace(/^\//, "").replace(/\//g, "-");
      const baseName = `${fix.flag_type} - ${normalizedPath}`;
      let uniqueName = baseName;
      let suffix = 2;
      while (usedTagNames.has(uniqueName)) {
        uniqueName = `${baseName} (${suffix})`;
        suffix += 1;
      }
      usedTagNames.add(uniqueName);
      
      tags.push({
        tagId: String(tagId + 1),
        name: uniqueName,
        type: "html",
        parameter: [
          {
            type: "TEMPLATE",
            key: "html",
            value: fix.injection_js || fix.code_snippet
          }
        ],
        firingTriggerId: ["1"]
      });
    });

    // Build GTM container export
    const gtmExport = {
      exportFormatVersion: 2,
      exportTime: timestamp,
      containerVersion: {
        name: `Green Audit - ${domain}`,
        container: {
          name: `Green Audit GTM - ${domain}`,
          publicId: `GTM-${domain.replace(/\./g, '-').toUpperCase()}`,
          usageContext: ["WEB"]
        },
        tag: tags,
        trigger: [
          {
            name: "All Pages",
            type: "PAGEVIEW",
            triggerId: "1"
          }
        ],
        variable: [],
        folder: [],
        builtInVariable: []
      },
      metadata: {
        domain,
        auditId: result.audit_id,
        auditUrl: result.target_url,
        generatedAt: timestamp,
        totalFixes: selectedFixes.size,
        avgCO2: summary.total_estimated_co2_grams / summary.total_pages_crawled,
        grade: summary.grade
      }
    };

    const blob = new Blob([JSON.stringify(gtmExport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `green-audit-gtm-${domain}-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-[#0a0f0a] text-[#e8ede8]">
      {/* LEFT COLUMN - 300px */}
      <div className="w-[300px] border-r border-[#1a2a1a] flex flex-col overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Back link */}
          <a href="/" className="text-[#4a6a4a] hover:text-[#7ec87e] text-xs font-mono inline-block">
            ← New audit
          </a>

          {/* Summary Data */}
          <div>
            <div className="text-xs font-mono uppercase text-[#4a6a4a] mb-3">Summary</div>
            <div className="space-y-2">
              <div className="bg-[#0f1a0f] border border-[#1a2a1a] rounded p-3">
                <div className="text-[#2a4a2a] text-xs font-mono uppercase">Pages</div>
                <div className="text-xl font-mono font-bold text-[#7ec87e]">{summary.total_pages_crawled}</div>
              </div>
              <div className="bg-[#0f1a0f] border border-[#1a2a1a] rounded p-3">
                <div className="text-[#2a4a2a] text-xs font-mono uppercase">Transfer</div>
                <div className="text-xl font-mono font-bold text-[#7ec87e]">{fmt(summary.total_transfer_bytes)}</div>
              </div>
              <div className="bg-[#0f1a0f] border border-[#1a2a1a] rounded p-3">
                <div className="text-[#2a4a2a] text-xs font-mono uppercase">CO₂ Emissions</div>
                <div className="text-xl font-mono font-bold text-[#7ec87e]">{summary.total_estimated_co2_grams.toFixed(1)}g</div>
              </div>
              <div className="bg-[#0f1a0f] border border-[#1a2a1a] rounded p-3">
                <div className="text-[#2a4a2a] text-xs font-mono uppercase">Grade</div>
                <div className="text-xl font-mono font-bold text-[#7ec87e]">{summary.grade}</div>
              </div>
            </div>
          </div>

          {/* Potential Savings */}
          {totalPotentialSavings > 0 && (
            <div className="bg-[#0f1a0f] border border-[#1a2a1a] rounded p-4">
              <div className="text-xs font-mono uppercase text-[#4a6a4a] mb-2">Potential Savings</div>
              <div className="text-2xl font-mono font-bold text-[#7ec87e]">
                {totalPotentialSavings.toFixed(4)}g
              </div>
              <div className="text-xs text-[#2a4a2a] mt-1">
                {safePct(totalPotentialSavings, co2Total).toFixed(0)}% reduction
              </div>
            </div>
          )}

          {/* Prioritized Actions (sorted highest to lowest) */}
          <div className="flex-1">
            <div className="text-xs font-mono uppercase text-[#4a6a4a] mb-3">
              Actions (by impact)
            </div>
            <div className="space-y-2">
              {sortedFixes.map(({ fix, index }, i) => {
                const impact = summary.top_flags.find(f => f.type === fix.flag_type)?.impact || "medium";
                return (
                  <div key={index} className="bg-[#0f1a0f] border border-[#1a2a1a] rounded p-3">
                    <div className="flex items-start gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={selectedFixes.has(index)}
                        onChange={() => toggleFix(index)}
                        className="mt-0.5 w-3.5 h-3.5 rounded border-[#1a2a1a] bg-[#0a0f0a] text-[#7ec87e]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs px-1.5 py-0.5 rounded inline-block font-mono border mb-1 ${IMPACT_COLORS[impact]}`}>
                          {impact.toUpperCase()}
                        </div>
                        <div className="text-xs font-mono text-[#e8ede8] leading-snug">{fix.flag_type}</div>
                        <div className="text-xs text-[#4a6a4a] mt-1 line-clamp-2">{fix.description}</div>
                        <div className="text-xs text-[#7ec87e] font-mono mt-1">
                          ~{fix.estimated_co2_saved.toFixed(4)}g saved
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Export button at bottom */}
        <div className="p-4 border-t border-[#1a2a1a] space-y-2">
          <button
            onClick={() => setPreviewMode("after")}
            className="w-full py-2.5 bg-[#7ec87e] text-[#0a0f0a] font-mono text-sm font-semibold rounded hover:bg-[#6db86d] transition-colors"
          >
            Preview fixes
          </button>
          <button
            onClick={exportPatch}
            disabled={selectedFixes.size === 0}
            className="w-full py-2.5 border border-[#1a2a1a] text-[#7ec87e] font-mono text-sm font-semibold rounded hover:bg-[#0f1a0f] transition-colors disabled:opacity-40"
          >
            Export patch ({selectedFixes.size})
          </button>
        </div>
      </div>

      {/* CENTER COLUMN - Stats comparison */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with Before/After toggle */}
        <div className="p-4 border-b border-[#1a2a1a] flex items-center justify-between">
          <div className="flex gap-1 bg-[#0f1a0f] border border-[#1a2a1a] rounded p-1">
            <button
              onClick={() => setPreviewMode("before")}
              className={`px-4 py-1.5 rounded text-sm font-mono transition-colors ${
                previewMode === "before"
                  ? "bg-[#7ec87e] text-[#0a0f0a]"
                  : "text-[#4a6a4a] hover:text-[#7ec87e]"
              }`}
            >
              Before
            </button>
            <button
              onClick={() => setPreviewMode("after")}
              className={`px-4 py-1.5 rounded text-sm font-mono transition-colors ${
                previewMode === "after"
                  ? "bg-[#7ec87e] text-[#0a0f0a]"
                  : "text-[#4a6a4a] hover:text-[#7ec87e]"
              }`}
            >
              After
            </button>
          </div>
          <div className="text-xs font-mono text-[#4a6a4a]">{result.target_url}</div>
        </div>

        {/* Stats comparison view */}
        <div className="flex-1 flex items-center justify-center bg-[#0f1a0f] p-8">
          <div className="max-w-2xl w-full space-y-8">
            {/* Header */}
            <div className="text-center">
              <h2 className="text-2xl font-mono font-bold text-[#7ec87e] mb-2">
                {previewMode === "before" ? "Current Impact" : "Projected Impact"}
              </h2>
              <p className="text-sm text-[#4a6a4a] font-mono">
                {previewMode === "after" && `With ${selectedFixes.size} fixes applied`}
              </p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-6">
              {/* CO2 Emissions */}
              <div className="bg-[#0a0f0a] border border-[#1a2a1a] rounded-lg p-6 text-center">
                <div className="text-xs font-mono uppercase text-[#4a6a4a] mb-3">CO₂ Emissions</div>
                <div className="text-4xl font-mono font-bold text-[#7ec87e] mb-2">
                  {previewMode === "before"
                    ? summary.total_estimated_co2_grams.toFixed(4)
                    : afterCO2.toFixed(4)}g
                </div>
                {previewMode === "after" && selectedSavings > 0 && (
                  <div className="text-xs font-mono text-[#7ec87e]">
                    ↓ {safePct(selectedSavings, co2Total).toFixed(0)}% reduction
                  </div>
                )}
              </div>

              {/* Performance Score */}
              <div className="bg-[#0a0f0a] border border-[#1a2a1a] rounded-lg p-6 text-center">
                <div className="text-xs font-mono uppercase text-[#4a6a4a] mb-3">Performance</div>
                <div className="text-4xl font-mono font-bold text-[#7ec87e] mb-2">
                  {previewMode === "before" ? avgPerformance : afterPerformance}
                  <span className="text-xl text-[#4a6a4a]">/100</span>
                </div>
                {previewMode === "after" && afterPerformance > avgPerformance && (
                  <div className="text-xs font-mono text-[#7ec87e]">
                    ↑ +{afterPerformance - avgPerformance} points
                  </div>
                )}
              </div>

              {/* Annual CO₂ projection */}
              <div className="bg-[#0a0f0a] border border-[#1a2a1a] rounded-lg p-6 text-center">
                <div className="text-xs font-mono uppercase text-[#4a6a4a] mb-3">Annual CO₂</div>
                <div className="text-4xl font-mono font-bold text-[#7ec87e] mb-2">
                  {previewMode === "before"
                    ? `${annualCo2Kg.toFixed(1)} kg`
                    : `${Math.max(0, afterAnnualCo2Kg).toFixed(1)} kg`}
                </div>
                <div className="text-xs font-mono text-[#4a6a4a]">at 1k daily visitors</div>
                {previewMode === "after" && afterAnnualCo2Kg < annualCo2Kg && (
                  <div className="text-xs font-mono text-[#7ec87e] mt-1">
                    ↓ {(annualCo2Kg - Math.max(0, afterAnnualCo2Kg)).toFixed(1)} kg/yr saved
                  </div>
                )}
              </div>
            </div>

            {/* Visual comparison */}
            {previewMode === "after" && selectedSavings > 0 && (
              <div className="bg-[#0a0f0a] border border-[#1a2a1a] rounded-lg p-6">
                <div className="text-xs font-mono uppercase text-[#4a6a4a] mb-4">Impact Reduction</div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-2">
                      <span className="text-[#4a6a4a]">Before</span>
                      <span className="text-[#c87e7e]">{summary.total_estimated_co2_grams.toFixed(4)}g</span>
                    </div>
                    <div className="h-3 bg-[#0f1a0f] rounded-full overflow-hidden">
                      <div className="h-full bg-[#c87e7e]" style={{ width: "100%" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-2">
                      <span className="text-[#4a6a4a]">After</span>
                      <span className="text-[#7ec87e]">{afterCO2.toFixed(4)}g</span>
                    </div>
                    <div className="h-3 bg-[#0f1a0f] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#7ec87e]"
                        style={{ width: `${safePct(afterCO2, co2Total)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Call to action */}
            <div className="text-center">
              <p className="text-sm text-[#4a6a4a] font-mono mb-4">
                {previewMode === "before"
                  ? "Select fixes in the left panel to see projected improvements"
                  : "Export the patch file to implement these optimizations"}
              </p>
              {previewMode === "after" && (
                <button
                  onClick={exportPatch}
                  disabled={selectedFixes.size === 0}
                  className="px-6 py-3 bg-[#7ec87e] text-[#0a0f0a] font-mono text-sm font-semibold rounded hover:bg-[#6db86d] transition-colors disabled:opacity-40"
                >
                  Export patch ({selectedFixes.size} fixes)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN - 280px */}
      <div className="w-[280px] border-l border-[#1a2a1a] flex flex-col overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Circular sustainability score */}
          <div className="flex flex-col items-center">
            <div className="text-xs font-mono uppercase text-[#4a6a4a] mb-4">Sustainability Score</div>
            <div
              className="w-32 h-32 rounded-full flex items-center justify-center"
              style={{
                border: `6px solid ${getScoreColor(avgPerformance)}`,
              }}
            >
              <div className="text-center">
                <div className="text-3xl font-mono font-bold" style={{ color: getScoreColor(avgPerformance) }}>
                  {avgPerformance}
                </div>
                <div className="text-xs font-mono text-[#4a6a4a]">/100</div>
              </div>
            </div>
            <div className="text-xs font-mono text-[#2a4a2a] mt-2">Avg Lighthouse performance</div>
          </div>

          {/* Score breakdown bars */}
          <div>
            <div className="text-xs font-mono uppercase text-[#4a6a4a] mb-3">Score Breakdown</div>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-[#4a6a4a]">Performance</span>
                  <span style={{ color: getScoreColor(avgPerformance) }}>{avgPerformance}</span>
                </div>
                <div className="h-1.5 bg-[#0f1a0f] rounded-full overflow-hidden">
                  <div
                    className="h-full"
                    style={{ width: `${avgPerformance}%`, backgroundColor: getScoreColor(avgPerformance) }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section heatmap */}
          {summary.sections_ranked.length > 0 && (
            <div>
              <div className="text-xs font-mono uppercase text-[#4a6a4a] mb-3">CO₂ by Section</div>
              <div className="space-y-2">
                {summary.sections_ranked.map((section, i) => {
                  const pct = safePct(section.co2_grams, co2Total);
                  const color = pct > 40 ? "#c87e7e" : pct > 20 ? "#c8a87e" : "#7ea87e";
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs font-mono mb-1">
                        <span className="text-[#4a6a4a]">/{section.section}</span>
                        <span style={{ color }}>{pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-[#0f1a0f] rounded-full overflow-hidden">
                        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Per-page breakdown */}
          <div className="flex-1">
            <div className="text-xs font-mono uppercase text-[#4a6a4a] mb-3">Per-page Breakdown</div>
            <div className="space-y-2">
              {pages.map((page, i) => (
                <div key={i} className="bg-[#0f1a0f] border border-[#1a2a1a] rounded p-2">
                  <div className="text-xs font-mono text-[#7ec87e] truncate">{new URL(page.url).pathname || "/"}</div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1">
                    <div className="text-xs font-mono text-[#2a4a2a]">
                      {fmt(page.transfer_size_bytes)}
                    </div>
                    <div className="text-xs font-mono text-[#2a4a2a]">
                      {page.estimated_co2_grams.toFixed(1)}g
                    </div>
                  </div>
                  {page.flags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {page.flags.slice(0, 2).map((flag, j) => (
                        <div
                          key={j}
                          className={`text-xs px-1 py-0.5 rounded font-mono border ${IMPACT_COLORS[flag.impact]}`}
                        >
                          {flag.impact[0].toUpperCase()}
                        </div>
                      ))}
                      {page.flags.length > 2 && (
                        <div className="text-xs text-[#4a6a4a] font-mono">+{page.flags.length - 2}</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
