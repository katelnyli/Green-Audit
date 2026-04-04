"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getAudit } from "@/app/lib/api";
import type { AuditResult } from "@/app/types/audit";

export default function Report() {
  const searchParams = useSearchParams();
  const auditId = searchParams.get("audit_id");

  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auditId) {
      setError("No audit ID provided");
      setLoading(false);
      return;
    }

    getAudit(auditId)
      .then((status) => {
        if (status.result) {
          setResult(status.result);
        } else {
          setError("Audit not complete yet");
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load audit");
      })
      .finally(() => setLoading(false));
  }, [auditId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0f0a]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#7ec87e] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <div className="text-[#7ec87e] font-mono">Loading report...</div>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0f0a]">
        <div className="text-center">
          <div className="text-[#ff6b6b] text-xl mb-4">Error</div>
          <div className="text-[#a0a0a0]">{error || "No data available"}</div>
        </div>
      </div>
    );
  }

  const gradeColors = {
    A: "text-[#7ec87e]",
    B: "text-[#7ec87e]",
    C: "text-[#ffb84d]",
    D: "text-[#ff6b6b]",
    F: "text-[#ff6b6b]",
  };

  const impactColors = {
    high: "bg-[#2d0f0f] text-[#ff6b6b] border-[#3d1f1f]",
    medium: "bg-[#2d2010] text-[#ffb84d] border-[#3d3020]",
    low: "bg-[#0f2d0f] text-[#7ec87e] border-[#1f3d1f]",
  };

  return (
    <div className="min-h-screen bg-[#0a0f0a] text-[#ededed]">
      {/* Header */}
      <div className="border-b border-[#1a2a1a] bg-[#0f1a0f]">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Audit Report</h1>
              <div className="text-[#a0a0a0] font-mono text-sm">{result.target_url}</div>
              <div className="text-[#606060] text-xs mt-1">
                Scanned {new Date(result.crawled_at).toLocaleString()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[#606060] text-sm mb-1">Overall Grade</div>
              <div className={`text-6xl font-bold ${gradeColors[result.summary.grade]}`}>
                {result.summary.grade}
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-6 mt-8">
            <div className="bg-[#0a0f0a] border border-[#1a2a1a] rounded-lg p-4">
              <div className="text-[#606060] text-sm mb-1">Pages Crawled</div>
              <div className="text-2xl font-mono font-bold">{result.summary.total_pages_crawled}</div>
            </div>
            <div className="bg-[#0a0f0a] border border-[#1a2a1a] rounded-lg p-4">
              <div className="text-[#606060] text-sm mb-1">Total Transfer</div>
              <div className="text-2xl font-mono font-bold">
                {(result.summary.total_transfer_bytes / 1024 / 1024).toFixed(1)} MB
              </div>
            </div>
            <div className="bg-[#0a0f0a] border border-[#1a2a1a] rounded-lg p-4">
              <div className="text-[#606060] text-sm mb-1">Est. CO₂ Emissions</div>
              <div className="text-2xl font-mono font-bold">
                {result.summary.total_estimated_co2_grams.toFixed(1)}g
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Top Flags */}
        {result.summary.top_flags.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Top Issues</h2>
            <div className="space-y-3">
              {result.summary.top_flags.map((flag, i) => (
                <div
                  key={i}
                  className={`border rounded-lg p-4 ${impactColors[flag.impact]}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold">{flag.type}</div>
                      <div className="text-sm opacity-80 mt-1">
                        Found in {flag.occurrences} {flag.occurrences === 1 ? "page" : "pages"}
                      </div>
                    </div>
                    <div className="text-xs uppercase tracking-wider opacity-60">
                      {flag.impact}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Code Fixes */}
        {result.fixes.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Recommended Fixes</h2>
            <div className="space-y-4">
              {result.fixes.map((fix, i) => (
                <div key={i} className="bg-[#0f1a0f] border border-[#1a2a1a] rounded-lg p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-[#7ec87e] text-sm font-mono mb-1">{fix.flag_type}</div>
                      <div className="font-semibold">{fix.description}</div>
                      <div className="text-[#606060] text-sm mt-1">{fix.page_url}</div>
                    </div>
                    <div className="text-[#7ec87e] text-sm">
                      Save {fix.estimated_co2_saved.toFixed(2)}g CO₂
                    </div>
                  </div>
                  <div className="bg-[#0a0f0a] border border-[#1a2a1a] rounded p-4 font-mono text-xs overflow-x-auto">
                    <pre className="text-[#a0a0a0]">{fix.code_snippet}</pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pages List */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Pages Scanned ({result.pages.length})</h2>
          <div className="space-y-2">
            {result.pages.map((page, i) => (
              <div
                key={i}
                className="bg-[#0f1a0f] border border-[#1a2a1a] rounded-lg p-4 hover:border-[#2a3a2a] transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-mono text-sm text-[#7ec87e] mb-1">{page.url}</div>
                    <div className="grid grid-cols-4 gap-4 text-xs text-[#a0a0a0]">
                      <div>
                        <span className="text-[#606060]">Size:</span>{" "}
                        {(page.transfer_size_bytes / 1024 / 1024).toFixed(2)}MB
                      </div>
                      <div>
                        <span className="text-[#606060]">Requests:</span> {page.request_count}
                      </div>
                      <div>
                        <span className="text-[#606060]">Load:</span> {page.load_time_ms}ms
                      </div>
                      <div>
                        <span className="text-[#606060]">CO₂:</span> {page.estimated_co2_grams.toFixed(2)}g
                      </div>
                    </div>
                    {page.flags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {page.flags.map((flag, j) => (
                          <span
                            key={j}
                            className={`text-xs px-2 py-1 rounded ${
                              flag.impact === "high"
                                ? "bg-[#2d0f0f] text-[#ff6b6b]"
                                : flag.impact === "medium"
                                ? "bg-[#2d2010] text-[#ffb84d]"
                                : "bg-[#0f2d0f] text-[#7ec87e]"
                            }`}
                          >
                            {flag.type}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="ml-4">
                    <div className="text-right">
                      <div className="text-xs text-[#606060]">Performance</div>
                      <div className="text-lg font-mono">{page.lighthouse.performance}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section Summary */}
        {result.summary.sections_ranked.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">CO₂ by Section</h2>
            <div className="space-y-2">
              {result.summary.sections_ranked.map((section, i) => (
                <div
                  key={i}
                  className="bg-[#0f1a0f] border border-[#1a2a1a] rounded-lg p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold">{section.section}</div>
                    <div className="text-xs text-[#606060]">{section.page_count} pages</div>
                  </div>
                  <div className="text-[#7ec87e] font-mono">{section.co2_grams.toFixed(1)}g</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
