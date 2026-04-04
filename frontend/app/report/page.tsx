"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

const MOCK_PAGES = [
  { path: "/", mb: 1.2, co2: 0.4, thirdParties: 2, issues: 3 },
  { path: "/products", mb: 8.4, co2: 2.9, thirdParties: 8, issues: 12 },
  { path: "/products/widget-pro", mb: 6.1, co2: 2.1, thirdParties: 7, issues: 9 },
  { path: "/dashboard", mb: 9.8, co2: 3.4, thirdParties: 12, issues: 15 },
  { path: "/checkout", mb: 4.1, co2: 1.4, thirdParties: 6, issues: 8 },
  { path: "/blog", mb: 3.2, co2: 1.1, thirdParties: 14, issues: 7 },
  { path: "/pricing", mb: 1.6, co2: 0.6, thirdParties: 3, issues: 4 },
  { path: "/about", mb: 1.1, co2: 0.4, thirdParties: 2, issues: 2 },
  { path: "/login", mb: 0.9, co2: 0.3, thirdParties: 1, issues: 1 },
  { path: "/settings", mb: 2.3, co2: 0.8, thirdParties: 5, issues: 5 },
  { path: "/settings/billing", mb: 1.8, co2: 0.6, thirdParties: 4, issues: 3 },
  { path: "/admin", mb: 3.5, co2: 1.2, thirdParties: 6, issues: 6 },
];

const ACTIONS = [
  {
    severity: "HIGH" as const,
    title: "Convert PNG/JPEG to WebP on /products",
    description: "Add loading=\"lazy\" to 14 img tags, replace .jpg → .webp",
    savings: "48MB/visit",
  },
  {
    severity: "HIGH" as const,
    title: "Remove unused JS bundles on /dashboard",
    description: "2.1MB of JavaScript never executed on page load",
    savings: "2.1MB/visit",
  },
  {
    severity: "MED" as const,
    title: "Reduce third-party requests on /blog",
    description: "14 external domains add 1.4MB overhead",
    savings: "1.4MB/visit",
  },
  {
    severity: "MED" as const,
    title: "Suppress console.log on /checkout",
    description: "427 console statements per page load",
    savings: "Minor CPU",
  },
  {
    severity: "LOW" as const,
    title: "Enable font subsetting",
    description: "Full font files loaded on 12 pages",
    savings: "0.3MB/visit",
  },
];

const SECTION_HEATMAP = [
  { name: "shop", score: 82 },
  { name: "dashboard", score: 96 },
  { name: "blog", score: 55 },
  { name: "checkout", score: 60 },
  { name: "marketing", score: 28 },
  { name: "auth", score: 18 },
];

export default function Report() {
  const searchParams = useSearchParams();
  const targetUrl = searchParams.get("url") || "https://example.com";
  const domain = new URL(targetUrl).hostname;

  const [previewMode, setPreviewMode] = useState<"before" | "after">("before");
  const [selectedActions, setSelectedActions] = useState<boolean[]>(
    ACTIONS.map(() => true)
  );
  const [fixesApplied, setFixesApplied] = useState(false);

  const totalMb = MOCK_PAGES.reduce((sum, p) => sum + p.mb, 0);
  const totalCo2 = MOCK_PAGES.reduce((sum, p) => sum + p.co2, 0);
  const grade = "D";

  const worstPages = [...MOCK_PAGES]
    .sort((a, b) => b.mb - a.mb)
    .slice(0, 8);

  const handlePreviewFixes = () => {
    setFixesApplied(true);
    setPreviewMode("after");
  };

  const handleExportPatch = () => {
    const content = `=== GREEN AUDIT PATCH — ${domain} ===
Generated: ${new Date().toLocaleDateString()}

${ACTIONS.filter((_, i) => selectedActions[i])
  .map((action) => {
    if (action.title.includes("Convert PNG/JPEG")) {
      return `[${action.severity}] /products — Convert images to WebP
  Add loading="lazy" to 14 img tags
  Replace src extensions: .jpg → .webp where available`;
    } else if (action.title.includes("unused JS")) {
      return `[${action.severity}] /dashboard — Remove unused JS
  Add defer attribute to 3 script tags`;
    } else if (action.title.includes("console.log")) {
      return `[${action.severity}] /checkout — Suppress console.log
  Wrap console.log calls in: if (window.__DEV__) { ... }`;
    } else if (action.title.includes("third-party")) {
      return `[${action.severity}] /blog — Reduce third-party requests
  Self-host: fonts.googleapis.com/css2?family=Inter`;
    } else {
      return `[${action.severity}] /settings — Enable font subsetting
  Subset custom fonts to used glyphs only`;
    }
  })
  .join("\n\n")}`;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `green-audit-patch-${domain}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-[#0a0f0a]">
      {/* LEFT: Audit Results */}
      <div className="w-[350px] border-r border-[#1a2a1a] flex flex-col overflow-y-auto">
        {/* Summary */}
        <div className="p-6 border-b border-[#1a2a1a] space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-[#606060] text-xs">Pages</div>
              <div className="text-[#ededed] font-mono">{MOCK_PAGES.length}</div>
            </div>
            <div>
              <div className="text-[#606060] text-xs">Transfer</div>
              <div className="text-[#ededed] font-mono">{totalMb.toFixed(1)}MB</div>
            </div>
            <div>
              <div className="text-[#606060] text-xs">CO₂</div>
              <div className="text-[#ededed] font-mono">{totalCo2.toFixed(1)}g</div>
            </div>
            <div>
              <div className="text-[#606060] text-xs">Grade</div>
              <div className="text-[#ff6b6b] font-bold text-lg">{grade}</div>
            </div>
          </div>
        </div>

        {/* Worst Pages */}
        <div className="p-6 border-b border-[#1a2a1a]">
          <h2 className="text-sm font-semibold text-[#ededed] mb-4">Worst Pages</h2>
          <div className="space-y-2">
            {worstPages.map((page) => {
              const widthPercent = (page.mb / worstPages[0].mb) * 100;
              const color =
                page.mb > 7
                  ? "#ff6b6b"
                  : page.mb > 3
                  ? "#ffb84d"
                  : "#7ec87e";
              return (
                <div key={page.path} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#a0a0a0] truncate font-mono">
                      {page.path}
                    </span>
                    <span className="text-[#606060] font-mono">{page.mb.toFixed(1)}MB</span>
                  </div>
                  <div className="h-2 bg-[#0f1a0f] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${widthPercent}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Prioritized Actions */}
        <div className="flex-1 p-6">
          <h2 className="text-sm font-semibold text-[#ededed] mb-4">
            Prioritized Actions
          </h2>
          <div className="space-y-3">
            {ACTIONS.map((action, i) => {
              const severityClasses = {
                HIGH: "bg-[#2d0f0f] text-[#ff6b6b] border-[#ff6b6b]",
                MED: "bg-[#2d2010] text-[#ffb84d] border-[#ffb84d]",
                LOW: "bg-[#0f2d0f] text-[#7ec87e] border-[#7ec87e]",
              };

              return (
                <div
                  key={i}
                  className="bg-[#0f1a0f] border border-[#1a2a1a] rounded p-3 space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selectedActions[i]}
                      onChange={(e) => {
                        const newSelected = [...selectedActions];
                        newSelected[i] = e.target.checked;
                        setSelectedActions(newSelected);
                      }}
                      className="mt-1 accent-[#7ec87e]"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-mono px-2 py-0.5 rounded border ${
                            severityClasses[action.severity]
                          }`}
                        >
                          {action.severity}
                        </span>
                      </div>
                      <div className="text-sm text-[#ededed] font-medium">
                        {action.title}
                      </div>
                      <div className="text-xs text-[#606060]">
                        {action.description}
                      </div>
                      <div className="text-xs text-[#7ec87e] font-mono">
                        Est. {action.savings}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 border-t border-[#1a2a1a] space-y-3">
          <button
            onClick={handlePreviewFixes}
            className="w-full py-3 bg-[#7ec87e] text-[#0a0f0a] font-semibold rounded hover:bg-[#6db86d] transition-colors"
          >
            Preview Fixes
          </button>
          <button
            onClick={handleExportPatch}
            className="w-full py-3 bg-transparent border border-[#7ec87e] text-[#7ec87e] font-semibold rounded hover:bg-[#7ec87e]/10 transition-colors"
          >
            Export Patch
          </button>
        </div>
      </div>

      {/* CENTER: Site Preview */}
      <div className="flex-1 flex flex-col">
        <div className="p-6 border-b border-[#1a2a1a]">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs uppercase tracking-wider text-[#606060]">
              Site Preview
            </div>
            {/* Before/After Toggle */}
            <div className="flex bg-[#0f1a0f] border border-[#1a2a1a] rounded overflow-hidden">
              <button
                onClick={() => setPreviewMode("before")}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  previewMode === "before"
                    ? "bg-[#7ec87e] text-[#0a0f0a]"
                    : "text-[#a0a0a0] hover:text-[#ededed]"
                }`}
              >
                Before
              </button>
              <button
                onClick={() => setPreviewMode("after")}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  previewMode === "after"
                    ? "bg-[#7ec87e] text-[#0a0f0a]"
                    : "text-[#a0a0a0] hover:text-[#ededed]"
                }`}
              >
                After
              </button>
            </div>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 relative bg-[#0f1a0f]">
          {/* Mock iframe */}
          <div className="absolute inset-0 flex items-center justify-center text-[#606060]">
            <div className="text-center">
              <div className="text-2xl mb-2">{targetUrl}</div>
              <div className="text-sm">
                {/* TODO: replace with real iframe pointing to {targetUrl} */}
                [iframe preview placeholder]
              </div>
            </div>
          </div>

          {/* Green banner overlay when "After" + fixes applied */}
          {previewMode === "after" && fixesApplied && (
            <div className="absolute top-0 left-0 right-0 bg-[#7ec87e]/20 backdrop-blur-sm border-b-2 border-[#7ec87e] p-3 text-center">
              <div className="text-[#7ec87e] font-semibold">
                Fixes previewed — changes are not permanent
              </div>
              {/* TODO: replace overlay with real postMessage injection once proxy is ready */}
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="p-4 border-t border-[#1a2a1a] text-xs text-[#606060] text-center">
          Preview shows your live site. Fixes shown are non-destructive and temporary.
        </div>
      </div>

      {/* RIGHT: Score + Details */}
      <div className="w-[350px] border-l border-[#1a2a1a] flex flex-col overflow-y-auto">
        {/* Circular Score */}
        <div className="p-6 border-b border-[#1a2a1a] flex flex-col items-center">
          <div className="relative w-32 h-32">
            <svg className="w-full h-full -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="#1a2a1a"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="#ff6b6b"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${(42 / 100) * 2 * Math.PI * 56} ${
                  2 * Math.PI * 56
                }`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-3xl font-bold text-[#ededed]">42</div>
                <div className="text-xs text-[#606060]">/100</div>
              </div>
            </div>
          </div>
          <div className="text-sm text-[#a0a0a0] mt-4">Sustainability Score</div>
        </div>

        {/* Score Breakdown */}
        <div className="p-6 border-b border-[#1a2a1a]">
          <h3 className="text-sm font-semibold text-[#ededed] mb-4">
            Score Breakdown
          </h3>
          <div className="space-y-3">
            {[
              { label: "Image efficiency", score: 28 },
              { label: "Transfer size", score: 35 },
              { label: "Third parties", score: 50 },
              { label: "JS efficiency", score: 60 },
              { label: "Font loading", score: 72 },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#a0a0a0]">{item.label}</span>
                  <span className="text-[#ededed] font-mono">{item.score}</span>
                </div>
                <div className="h-1.5 bg-[#0f1a0f] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#7ec87e]"
                    style={{ width: `${item.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section Heatmap */}
        <div className="p-6 border-b border-[#1a2a1a]">
          <h3 className="text-sm font-semibold text-[#ededed] mb-4">
            Section Heatmap
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {SECTION_HEATMAP.map((section) => {
              const color =
                section.score > 70
                  ? "#ff6b6b"
                  : section.score > 40
                  ? "#ffb84d"
                  : "#7ec87e";
              return (
                <div
                  key={section.name}
                  className="bg-[#0f1a0f] border border-[#1a2a1a] rounded p-3 text-center"
                >
                  <div className="text-xs text-[#a0a0a0] mb-1 font-mono">
                    {section.name}
                  </div>
                  <div
                    className="text-xl font-bold font-mono"
                    style={{ color }}
                  >
                    {section.score}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Per-Page Table */}
        <div className="flex-1 p-6">
          <h3 className="text-sm font-semibold text-[#ededed] mb-4">
            Per-Page Details
          </h3>
          <div className="space-y-2 text-xs">
            {MOCK_PAGES.map((page) => (
              <div
                key={page.path}
                className="bg-[#0f1a0f] border border-[#1a2a1a] rounded p-2 space-y-1"
              >
                <div className="text-[#ededed] font-mono truncate">
                  {page.path}
                </div>
                <div className="flex gap-3 text-[#606060]">
                  <span>{page.mb.toFixed(1)}MB</span>
                  <span>{page.co2.toFixed(1)}g CO₂</span>
                  <span>{page.thirdParties} 3P</span>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: page.issues }).map((_, i) => (
                    <span
                      key={i}
                      className="text-[10px] bg-[#2d0f0f] text-[#ff6b6b] px-1 rounded"
                    >
                      !
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
