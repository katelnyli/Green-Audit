"use client";

import { useState } from "react";
import type { AuditResult, CodeFix, Impact, Grade } from "@/app/types/audit";
import SplitPreview from "@/app/components/SplitPreview";

const GRADE_COLORS: Record<Grade, string> = {
  A: "text-green-400 border-green-700 bg-green-950",
  B: "text-lime-400 border-lime-700 bg-lime-950",
  C: "text-yellow-400 border-yellow-700 bg-yellow-950",
  D: "text-orange-400 border-orange-700 bg-orange-950",
  F: "text-red-400 border-red-700 bg-red-950",
};

const IMPACT_COLORS: Record<Impact, string> = {
  high: "text-red-400 bg-red-950",
  medium: "text-yellow-400 bg-yellow-950",
  low: "text-blue-400 bg-blue-950",
};

function fmt(bytes: number) {
  if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000).toFixed(0)} KB`;
}

export default function ReportView({ result }: { result: AuditResult }) {
  const { summary, pages, fixes } = result;
  const [previewPage, setPreviewPage] = useState<string | null>(null);

  const fixesByPage = fixes.reduce<Record<string, CodeFix[]>>((acc, fix) => {
    (acc[fix.page_url] ??= []).push(fix);
    return acc;
  }, {});

  const previewPageData = pages.find((p) => p.url === previewPage);
  const previewFixes = previewPage ? (fixesByPage[previewPage] ?? []) : [];

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <a href="/" className="text-zinc-500 hover:text-white text-sm mb-2 inline-block">
            ← New audit
          </a>
          <h1 className="text-2xl font-bold text-white">{result.target_url}</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {summary.total_pages_crawled} pages · {new Date(result.crawled_at).toLocaleString()}
          </p>
        </div>
        <div className={`text-6xl font-black border-2 rounded-2xl w-24 h-24 flex items-center justify-center ${GRADE_COLORS[summary.grade]}`}>
          {summary.grade}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total CO₂", value: `${summary.total_estimated_co2_grams.toFixed(2)}g` },
          { label: "Total transfer", value: fmt(summary.total_transfer_bytes) },
          { label: "Pages crawled", value: summary.total_pages_crawled },
          { label: "Total fixes", value: fixes.length },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
            <p className="text-zinc-500 text-xs mb-1">{label}</p>
            <p className="text-white text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Sections ranked */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Sections by CO₂ impact</h2>
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-900 text-zinc-400 text-left">
                <th className="px-4 py-3 font-medium">Section</th>
                <th className="px-4 py-3 font-medium">Pages</th>
                <th className="px-4 py-3 font-medium">CO₂</th>
                <th className="px-4 py-3 font-medium">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {summary.sections_ranked.map((s) => {
                const pct = summary.total_estimated_co2_grams > 0
                  ? Math.round((s.co2_grams / summary.total_estimated_co2_grams) * 100)
                  : 0;
                return (
                  <tr key={s.section} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="px-4 py-3 text-white font-mono">/{s.section}</td>
                    <td className="px-4 py-3 text-zinc-400">{s.page_count}</td>
                    <td className="px-4 py-3 text-zinc-300">{s.co2_grams.toFixed(4)}g</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 rounded-full bg-zinc-800 flex-1 max-w-[80px]">
                          <div
                            className="h-full rounded-full bg-green-600"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-zinc-500 text-xs w-8">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Top flags */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Most common issues</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {summary.top_flags.map((f) => (
            <div key={f.type} className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 flex items-center justify-between gap-4">
              <div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${IMPACT_COLORS[f.impact]}`}>
                  {f.impact}
                </span>
                <p className="mt-1.5 text-white text-sm font-mono">{f.type}</p>
              </div>
              <span className="text-2xl font-bold text-zinc-300">{f.occurrences}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Per-page breakdown */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Page breakdown</h2>
        <div className="space-y-3">
          {pages
            .slice()
            .sort((a, b) => b.estimated_co2_grams - a.estimated_co2_grams)
            .map((page) => (
              <div
                key={page.url}
                className="rounded-xl bg-zinc-900 border border-zinc-800 p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-white text-sm font-mono truncate">{page.url}</p>
                    <div className="flex gap-4 mt-1 text-xs text-zinc-500">
                      <span>{page.estimated_co2_grams.toFixed(4)}g CO₂</span>
                      <span>{fmt(page.transfer_size_bytes)}</span>
                      <span>{page.load_time_ms}ms</span>
                      <span>LH {page.lighthouse.performance}</span>
                    </div>
                  </div>
                  {fixesByPage[page.url]?.length > 0 && (
                    <button
                      onClick={() =>
                        setPreviewPage(previewPage === page.url ? null : page.url)
                      }
                      className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-white font-medium transition-colors"
                    >
                      {previewPage === page.url ? "Close preview" : `Preview ${fixesByPage[page.url].length} fixes`}
                    </button>
                  )}
                </div>

                {page.flags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {page.flags.map((flag, i) => (
                      <span
                        key={i}
                        className={`text-xs px-2 py-0.5 rounded font-medium ${IMPACT_COLORS[flag.impact]}`}
                        title={flag.detail}
                      >
                        {flag.type}
                      </span>
                    ))}
                  </div>
                )}

                {previewPage === page.url && (
                  <SplitPreview
                    pageUrl={page.url}
                    fixes={previewFixes}
                    baselineCo2={page.estimated_co2_grams}
                  />
                )}
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
