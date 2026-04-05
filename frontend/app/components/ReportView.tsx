"use client";

import { useState } from "react";
import type { AuditResult, Impact } from "@/app/types/audit";

// ── Projection constants ──────────────────────────────────────────────────────
const MONTHLY_VISITORS = 100_000;
const ANNUAL_LOADS = MONTHLY_VISITORS * 12; // 1.2 M page loads/year
const TREE_GRAMS = 22_000;      // grams CO₂ absorbed per tree per year
const CAR_GRAMS_PER_KM = 120;   // grams CO₂ per km driven (avg car)


const IMPACT_BADGE: Record<Impact, string> = {
  high:   "bg-[#2a0f0f] text-[#c87e7e] border-[#4a1a1a]",
  medium: "bg-[#2a1f0a] text-[#c8a87e] border-[#4a3a1a]",
  low:    "bg-[#0a1f0a] text-[#7ea87e] border-[#1a3a1a]",
};

function humanFlag(f: string) {
  const map: Record<string, string> = {
    suboptimal_image_format: "Unoptimized Images",
    render_blocking_script:  "Render-Blocking Scripts",
    oversized_page:          "Oversized Page",
    high_request_count:      "Too Many Requests",
    unoptimized_font:        "Unoptimized Fonts",
    slow_load_time:          "Slow Load Time",
  };
  return map[f] ?? f.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function fmtGrams(grams: number): string {
  if (grams >= 1_000_000) return `${(grams / 1_000_000).toFixed(1)}t`;
  if (grams >= 1_000) return `${(grams / 1_000).toFixed(1)} kg`;
  if (grams >= 1) return `${Math.round(grams)}g`;
  return `${grams.toFixed(2)}g`;
}

function fmtKm(km: number): string {
  if (km >= 10000) return `${(km / 1000).toFixed(0)}k km`;
  if (km >= 1000)  return `${(km / 1000).toFixed(1)}k km`;
  return `${Math.round(km)} km`;
}

function fmt(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000).toFixed(0)} KB`;
}

function safePct(n: number, d: number) {
  if (!d || !isFinite(d)) return 0;
  return Math.min(100, (n / d) * 100);
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ReportView({ result }: { result: AuditResult }) {
  const { summary, pages, fixes } = result;
  const [expandedFix, setExpandedFix] = useState<number | null>(0);

  const numPages      = Math.max(1, summary.total_pages_crawled);
  const avgCo2PerPage = summary.total_estimated_co2_grams / numPages;

  // Annual projections — guaranteed non-zero for display
  const annualCo2Grams = Math.max(1, avgCo2PerPage * ANNUAL_LOADS);
  const treesNeeded = Math.max(1, Math.ceil(annualCo2Grams / TREE_GRAMS));
  const drivingKm   = Math.max(1, Math.round(annualCo2Grams / CAR_GRAMS_PER_KM));

  const avgPerf = pages.length > 0
    ? Math.round(pages.reduce((s, p) => s + p.lighthouse.performance, 0) / pages.length)
    : 0;
  const showPerf = avgPerf > 0;

  const sortedFixes   = [...fixes].map((fix, i) => ({ fix, i })).sort((a, b) => b.fix.estimated_co2_saved - a.fix.estimated_co2_saved);
  const totalSavingsG = fixes.reduce((s, f) => s + f.estimated_co2_saved, 0);
  const savingsPct    = safePct(totalSavingsG, summary.total_estimated_co2_grams || 1);

  const afterCo2Grams    = Math.max(1, annualCo2Grams * (1 - savingsPct / 100));
  const afterTreesNeeded = Math.max(1, Math.ceil(afterCo2Grams / TREE_GRAMS));

  const domain = (() => { try { return new URL(result.target_url).hostname; } catch { return result.target_url; } })();

  const exportPatch = () => {
    const timestamp = new Date().toISOString();
    const used = new Set<string>();
    const tags = fixes.map((fix, tagId) => {
      const rawPath = (() => { try { return new URL(fix.page_url).pathname || "/"; } catch { return "/"; } })();
      const norm = rawPath === "/" ? "home" : rawPath.replace(/^\//, "").replace(/\//g, "-");
      let name = `${fix.flag_type} - ${norm}`; let s = 2;
      while (used.has(name)) name = `${fix.flag_type} - ${norm} (${s++})`;
      used.add(name);
      return { tagId: String(tagId + 1), name, type: "html", parameter: [{ type: "TEMPLATE", key: "html", value: fix.injection_js || fix.code_snippet }], firingTriggerId: ["1"] };
    });
    const blob = new Blob([JSON.stringify({ exportFormatVersion: 2, exportTime: timestamp, containerVersion: { name: `Green Audit - ${domain}`, container: { name: `Green Audit GTM - ${domain}`, publicId: `GTM-${domain.replace(/\./g, "-").toUpperCase()}`, usageContext: ["WEB"] }, tag: tags, trigger: [{ name: "All Pages", type: "PAGEVIEW", triggerId: "1" }], variable: [], folder: [], builtInVariable: [] } }, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `green-audit-${domain}-${timestamp.split("T")[0]}.json` });
    a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div className="relative min-h-screen bg-[#0a0f0a] text-[#e8ede8] overflow-x-hidden">
      {/* Dot grid */}
      <div className="dot-grid fixed inset-0 pointer-events-none opacity-50" />
      {/* Top glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(126,200,126,0.08) 0%, transparent 70%)" }} />

      {/* ── Sticky top bar ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-[#0a0f0a]/90 backdrop-blur border-b border-[#1a2a1a] px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/" className="text-[#404040] hover:text-[#7ec87e] text-xs font-mono transition-colors">← New audit</a>
          <span className="text-[#1a2a1a]">|</span>
          <span className="text-[#606060] font-mono text-xs truncate max-w-sm">{domain}</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportPatch} disabled={fixes.length === 0}
            className="px-4 py-1.5 shimmer-btn text-[#0a0f0a] font-mono text-xs font-bold rounded-lg transition-colors disabled:bg-[#3a5a3a] disabled:opacity-40 disabled:cursor-not-allowed">
            Export {fixes.length} fixes ↓
          </button>
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-8 py-8 space-y-8">

        {/* ── Hero cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4">
          <MetricCard label="Annual CO₂" value={fmtGrams(annualCo2Grams)} sub="at 100k visitors/month" accent="#7ec87e" />
          <MetricCard label="Trees to Offset" value={`${treesNeeded}`} sub="new trees needed per year" accent="#7ec87e" />
          <MetricCard label="Car Equivalent" value={fmtKm(drivingKm)} sub="of driving per year" accent="#c8a87e" />
          <MetricCard
            label={fixes.length > 0 ? "Reducible With Fixes" : "Pages Scanned"}
            value={fixes.length > 0 ? `−${Math.round(savingsPct)}%` : `${pages.length}`}
            sub={fixes.length > 0 ? `${fixes.length} fixes available` : "fully audited"}
            accent="#a87ec8"
          />
        </div>

        {/* ── Before / After ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">

          {/* Before */}
          <div className="glass-card rounded-xl p-6">
            <div className="text-xs font-mono uppercase text-[#404040] mb-5 tracking-wider">Current State</div>
            <div className="space-y-2.5">
              <Stat label="Annual CO₂" value={fmtGrams(annualCo2Grams)} color="#c8a87e" />
              <Stat label="Trees to offset" value={`${treesNeeded} trees/yr`} color="#c8a87e" />
              <Stat label="Total transfer" value={fmt(summary.total_transfer_bytes)} color="#7ec87e" />
              {showPerf && <Stat label="Avg performance" value={`${avgPerf}/100`} color={avgPerf >= 70 ? "#7ec87e" : avgPerf >= 50 ? "#c8a87e" : "#c87e7e"} />}
            </div>
          </div>

          {/* After */}
          <div className="glass-card rounded-xl p-6 relative overflow-hidden border-[#1a4a1a]">
            <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
              style={{ backgroundImage: "radial-gradient(ellipse at 80% 40%, #7ec87e, transparent 65%)" }} />
            <div className="relative">
              <div className="text-xs font-mono uppercase text-[#404040] mb-5 tracking-wider">
                With {fixes.length} Fixes Applied
              </div>
              <div className="space-y-2.5">
                <StatDiff label="Annual CO₂" before={fmtGrams(annualCo2Grams)} after={fmtGrams(afterCo2Grams)} saved={`−${Math.round(savingsPct)}%`} />
                <StatDiff label="Trees needed" before={`${treesNeeded}`} after={`${afterTreesNeeded}`} saved={treesNeeded > afterTreesNeeded ? `−${treesNeeded - afterTreesNeeded}` : "same"} />
                <Stat label="CO₂ saved/year" value={fmtGrams(Math.max(1, annualCo2Grams - afterCo2Grams))} color="#7ec87e" />
                {showPerf && <Stat label="Performance" value={`${Math.min(100, avgPerf + Math.round(savingsPct * 0.3))}/100`} color="#7ec87e" />}
              </div>
            </div>
          </div>
        </div>

        {fixes.length > 0 && (
          <div>
            <div className="text-xs font-mono uppercase text-[#404040] mb-4 tracking-wider">
              AI-Generated Code Fixes — ranked by impact
            </div>
            <div className="space-y-2">
              {sortedFixes.map(({ fix, i }) => {
                const impact = (summary.top_flags.find(f => f.type === fix.flag_type)?.impact ?? "medium") as Impact;
                const fixAnnualGrams = Math.max(1, fix.estimated_co2_saved * ANNUAL_LOADS);
                const isOpen = expandedFix === i;
                const pagePath = (() => { try { return new URL(fix.page_url).pathname || "/"; } catch { return fix.page_url; } })();
                return (
                  <div key={i} className="glass-card rounded-lg overflow-hidden">
                    <button
                      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#0f1a0f]/60 transition-colors text-left"
                      onClick={() => setExpandedFix(isOpen ? null : i)}
                    >
                      <span className={`text-xs px-2 py-0.5 rounded border font-mono shrink-0 ${IMPACT_BADGE[impact]}`}>
                        {impact.toUpperCase()}
                      </span>
                      <span className="flex-1 font-mono text-sm text-[#e8ede8] min-w-0">{humanFlag(fix.flag_type)}</span>
                      <span className="text-xs font-mono text-[#5a8a5a] shrink-0 hidden sm:block max-w-[200px] truncate">{pagePath}</span>
                      <span className="text-xs font-mono text-[#7ec87e] shrink-0 ml-4 whitespace-nowrap">saves ~{fmtGrams(fixAnnualGrams)}/yr</span>
                      <span className="text-[#3a5a3a] text-xs ml-2 shrink-0">{isOpen ? "▲" : "▼"}</span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-[#1a2a1a] px-5 pb-5 pt-4 space-y-4">
                        <div className="flex items-center gap-2 text-xs font-mono">
                          <span className="text-[#3a5a3a]">Page:</span>
                          <span className="text-[#5a8a5a]">{fix.page_url}</span>
                        </div>
                        <p className="text-sm text-[#7a9a7a] leading-relaxed">{fix.description}</p>
                        <div className="rounded-lg bg-[#060d06] border border-[#1a2a1a] overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2 border-b border-[#1a2a1a]">
                            <span className="text-xs font-mono text-[#3a5a3a]">code fix</span>
                            <button onClick={() => navigator.clipboard?.writeText(fix.code_snippet)}
                              className="text-xs font-mono text-[#3a5a3a] hover:text-[#7ec87e] transition-colors">
                              copy
                            </button>
                          </div>
                          <pre className="p-4 text-xs font-mono text-[#a8c8a8] overflow-x-auto leading-relaxed whitespace-pre-wrap max-h-64">{fix.code_snippet}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Page breakdown ───────────────────────────────────────────── */}
        {pages.length > 0 && (
          <div>
            <div className="text-xs font-mono uppercase text-[#404040] mb-4 tracking-wider">CO₂ Per Page</div>
            <div className="glass-card rounded-xl overflow-hidden">
              {pages.slice().sort((a, b) => b.estimated_co2_grams - a.estimated_co2_grams).map((page, i, arr) => {
                const maxCo2 = Math.max(...arr.map(p => p.estimated_co2_grams), 0.0001);
                const pct = safePct(page.estimated_co2_grams, maxCo2);
                const co2Str = page.estimated_co2_grams >= 0.01
                  ? `${page.estimated_co2_grams.toFixed(2)}g`
                  : `${(page.estimated_co2_grams * 1000).toFixed(2)}mg`;
                const path = (() => { try { return new URL(page.url).pathname || "/"; } catch { return page.url; } })();
                const barColor = pct > 70 ? "#c87e7e" : pct > 40 ? "#c8a87e" : "#7ec87e";
                return (
                  <div key={i} className={`px-5 py-3 flex items-center gap-4 ${i < arr.length - 1 ? "border-b border-[#1a2a1a]" : ""}`}>
                    <div className="w-44 font-mono text-xs text-[#5a8a5a] truncate shrink-0">{path}</div>
                    <div className="flex-1 h-2 bg-[#0a0f0a] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(2, pct)}%`, backgroundColor: barColor }} />
                    </div>
                    <div className="w-16 text-right font-mono text-xs shrink-0" style={{ color: barColor }}>{co2Str}</div>
                    <div className="w-16 text-right font-mono text-xs text-[#3a5a3a] shrink-0">{fmt(page.transfer_size_bytes)}</div>
                    <div className="w-6 shrink-0">
                      {page.flags.length > 0 && (
                        <span className="text-xs font-mono text-[#c87e7e]">{page.flags.length}⚑</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="stat-card glass-card rounded-xl p-5">
      <div className="text-xs font-mono uppercase text-[#404040] mb-2 tracking-wider">{label}</div>
      <div className="text-3xl font-mono font-bold mb-1 leading-none" style={{ color: accent }}>{value}</div>
      <div className="text-xs text-[#404040] font-mono mt-1">{sub}</div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-mono text-[#3a5a3a]">{label}</span>
      <span className="text-sm font-mono font-semibold" style={{ color }}>{value}</span>
    </div>
  );
}

function StatDiff({ label, before, after, saved }: { label: string; before: string; after: string; saved: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-mono text-[#3a5a3a]">{label}</span>
      <div className="flex items-center gap-2 text-xs font-mono">
        <span className="text-[#5a3a3a] line-through">{before}</span>
        <span className="text-[#7ec87e] font-semibold">{after}</span>
        <span className="text-[#3a6a3a]">{saved}</span>
      </div>
    </div>
  );
}
