"use client";

import { useState } from "react";
import type { AuditResult, Impact, Page, CodeFix } from "@/app/types/audit";

const IMPACT_COLORS: Record<Impact, string> = {
  high: "bg-[#2a0f0f] text-[#c87e7e] border-[#4a1a1a]",
  medium: "bg-[#2a1f0a] text-[#c8a87e] border-[#4a3a1a]",
  low: "bg-[#0a1f0a] text-[#7ea87e] border-[#1a3a1a]",
};

function fmt(bytes: number) {
  if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000).toFixed(0)} KB`;
}

function getScoreColor(score: number): string {
  if (score < 50) return "#c87e7e";
  if (score < 70) return "#c8a87e";
  return "#7ec87e";
}

export default function ReportView({ result }: { result: AuditResult }) {
  const { summary, pages, fixes } = result;
  const [selectedFixes, setSelectedFixes] = useState<Set<number>>(
    new Set(fixes.map((_, i) => i)) // all checked by default
  );
  const [previewMode, setPreviewMode] = useState<"before" | "after">("before");
  const [activeTab, setActiveTab] = useState(0);

  const toggleFix = (idx: number) => {
    setSelectedFixes((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const exportPatch = () => {
    const domain = new URL(result.target_url).hostname;
    const date = new Date().toISOString().split("T")[0];

    let patch = `=== GREEN AUDIT PATCH — ${domain} ===\nGenerated: ${date}\n\n`;

    selectedFixes.forEach((idx) => {
      const fix = fixes[idx];
      const impact = summary.top_flags.find(f => f.type === fix.flag_type)?.impact || "medium";
      const impactLabel = impact.toUpperCase();

      const pageUrl = new URL(fix.page_url).pathname || "/";
      patch += `[${impactLabel}] ${pageUrl} — ${fix.description}\n${fix.code_snippet}\n\n`;
    });

    const blob = new Blob([patch], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `green-audit-${domain}-${date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Sort pages by transfer size for "worst pages" bar chart
  const sortedPages = [...pages].sort((a, b) => b.transfer_size_bytes - a.transfer_size_bytes).slice(0, 10);
  const maxTransfer = sortedPages[0]?.transfer_size_bytes || 1;

  // Calculate average score for circular display
  const avgPerformance = pages.length > 0
    ? Math.round(pages.reduce((sum, p) => sum + p.lighthouse.performance, 0) / pages.length)
    : 0;

  // Get selected fixes for tabs
  const activeFixes = fixes.filter((_, i) => selectedFixes.has(i));

  return (
    <div className="flex h-screen bg-[#0a0f0a] text-[#e8ede8]">
      {/* LEFT COLUMN */}
      <div className="w-[300px] border-r border-[#1a2a1a] flex flex-col overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Summary chips */}
          <div>
            <a href="/" className="text-[#4a6a4a] hover:text-[#7ec87e] text-xs font-mono mb-4 inline-block">
              ← New audit
            </a>
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
                <div className="text-[#2a4a2a] text-xs font-mono uppercase">CO₂</div>
                <div className="text-xl font-mono font-bold text-[#7ec87e]">{summary.total_estimated_co2_grams.toFixed(1)}g</div>
              </div>
              <div className="bg-[#0f1a0f] border border-[#1a2a1a] rounded p-3">
                <div className="text-[#2a4a2a] text-xs font-mono uppercase">Grade</div>
                <div className="text-xl font-mono font-bold text-[#7ec87e]">{summary.grade}</div>
              </div>
            </div>
          </div>

          {/* Worst pages bar chart */}
          <div>
            <div className="text-xs font-mono uppercase text-[#4a6a4a] mb-3">Worst Pages</div>
            <div className="space-y-1.5">
              {sortedPages.map((page, i) => {
                const pct = (page.transfer_size_bytes / maxTransfer) * 100;
                const color = pct > 80 ? "#c87e7e" : pct > 50 ? "#c8a87e" : "#7ea87e";
                return (
                  <div key={i}>
                    <div className="text-xs font-mono text-[#4a6a4a] truncate">{new URL(page.url).pathname || "/"}</div>
                    <div className="h-1.5 bg-[#0f1a0f] rounded-full overflow-hidden">
                      <div className="h-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Prioritized actions */}
          <div className="flex-1">
            <div className="text-xs font-mono uppercase text-[#4a6a4a] mb-3">Prioritized Actions</div>
            <div className="space-y-2">
              {fixes.map((fix, i) => {
                const impact = summary.top_flags.find(f => f.type === fix.flag_type)?.impact || "medium";
                return (
                  <div key={i} className="bg-[#0f1a0f] border border-[#1a2a1a] rounded p-3">
                    <div className="flex items-start gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={selectedFixes.has(i)}
                        onChange={() => toggleFix(i)}
                        className="mt-0.5 w-3.5 h-3.5 rounded border-[#1a2a1a] bg-[#0a0f0a] text-[#7ec87e]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs px-1.5 py-0.5 rounded inline-block font-mono border ${IMPACT_COLORS[impact]}`}>
                          {impact.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs font-mono text-[#e8ede8] leading-snug">{fix.flag_type}</div>
                    <div className="text-xs text-[#4a6a4a] mt-1">{fix.description}</div>
                    {fix.estimated_co2_saved > 0 && (
                      <div className="text-xs text-[#7ec87e] font-mono mt-1">
                        ~{fix.estimated_co2_saved.toFixed(2)}g saved
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Buttons pinned to bottom */}
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
            Export patch
          </button>
        </div>
      </div>

      {/* CENTER COLUMN - Full website comparison */}
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

        {/* Full height website preview */}
        <div className="flex-1 flex flex-col bg-[#0f1a0f] p-4">
          {previewMode === "after" && (
            <div className="bg-[#7ec87e] text-[#0a0f0a] px-4 py-2 text-xs font-mono rounded mb-2 flex items-center justify-between">
              <span>Fixes previewed — changes are non-destructive and temporary.</span>
              {selectedFixes.size > 0 && (
                <span className="font-bold">{selectedFixes.size} fixes applied</span>
              )}
            </div>
          )}
          <div className="flex-1 bg-white border border-[#1a2a1a] rounded overflow-hidden">
            <iframe
              src={result.target_url}
              className="w-full h-full"
              sandbox="allow-scripts allow-same-origin allow-forms"
              title={previewMode === "before" ? "Original site" : "Preview with fixes"}
            />
          </div>
          <div className="text-xs font-mono text-[#2a4a2a] mt-2 text-center">
            Some sites block iframe embedding. If preview is blank, use Export Patch to apply fixes directly.
          </div>
          {/* TODO: replace iframe overlay with real postMessage injection once proxy is ready */}
        </div>
      </div>

      {/* RIGHT COLUMN */}
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
            <div className="text-xs font-mono text-[#2a4a2a] mt-2">Avg performance score</div>
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
              {/* TODO: backend does not yet return category-level scores - showing only performance */}
            </div>
          </div>

          {/* Section heatmap */}
          {summary.sections_ranked.length > 0 && (
            <div>
              <div className="text-xs font-mono uppercase text-[#4a6a4a] mb-3">Where is the carbon coming from?</div>
              <div className="space-y-2">
                {summary.sections_ranked.map((section, i) => {
                  const pct = (section.co2_grams / summary.total_estimated_co2_grams) * 100;
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

          {/* Per-page breakdown table */}
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

        {/* Export button at bottom */}
        <div className="p-4 border-t border-[#1a2a1a]">
          <button
            onClick={exportPatch}
            className="w-full py-2.5 border border-[#1a2a1a] text-[#7ec87e] font-mono text-sm font-semibold rounded hover:bg-[#0f1a0f] transition-colors"
          >
            Export full report
          </button>
        </div>
      </div>
    </div>
  );
}
