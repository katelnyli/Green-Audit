"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { streamAudit } from "@/app/lib/api";
import type { AuditStatus } from "@/app/types/audit";

export default function Progress() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auditId = searchParams.get("audit_id");

  const [status, setStatus] = useState<AuditStatus | null>(null);
  const [error, setError] = useState("");
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const pagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!auditId) { setError("No audit ID provided"); return; }

    const cleanup = streamAudit(
      auditId,
      (data) => setStatus(data),
      (data) => {
        setStatus(data);
        setTimeout(() => router.push(`/report?audit_id=${auditId}`), 800);
      },
      (err) => setError(err),
    );
    return cleanup;
  }, [auditId, router]);

  // Auto-scroll page list
  useEffect(() => {
    pagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [status?.pages_discovered?.length]);


  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0f0a]">
        <div className="text-center space-y-4">
          <div className="text-[#ff6b6b] text-xl">Error</div>
          <div className="text-[#a0a0a0]">{error}</div>
          <a href="/" className="text-[#7ec87e] text-sm underline">← New Audit</a>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0f0a]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#7ec87e] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <div className="text-[#7ec87e] font-mono">Connecting...</div>
        </div>
      </div>
    );
  }

  const domain = (() => {
    try { return new URL(status.current_url ?? "").hostname; } catch { return "..."; }
  })();

  const pagesDiscovered = status.pages_discovered ?? [];
  const liveUrls = status.live_urls ?? [];

  const phaseLabel: Record<string, string> = {
    queued: "Queued...",
    crawling: "Crawling pages...",
    scoring: "Running Lighthouse audits...",
    generating_fixes: "Generating code fixes...",
    done: "Complete!",
    error: "Error",
  };

  const activeUrl = liveUrls[0] ?? status.live_url ?? null;

  return (
    <div className="flex h-screen bg-[#0a0f0a]">

      {/* ── LEFT: Status feed (narrower) ──────────────────────────────────── */}
      <div className="w-[38%] border-r border-[#1a2a1a] flex flex-col shrink-0">

        {/* Header */}
        <div className="p-5 border-b border-[#1a2a1a] shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${
                status.status === "done" ? "bg-[#7ec87e]" : "bg-[#7ec87e] animate-pulse"
              }`} />
              <h1 className="text-base font-semibold text-[#ededed] truncate">
                {status.status === "done" ? "Completed" : `Scanning ${domain}`}
              </h1>
            </div>
            <a href="/" className="text-[#606060] hover:text-[#7ec87e] text-xs transition-colors shrink-0 ml-2">
              ← New Audit
            </a>
          </div>
          <div className="text-[#7ec87e] font-mono text-xs">
            {phaseLabel[status.status] ?? status.status}
          </div>
        </div>

        {/* Live feed */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 font-mono text-xs">

          {/* Agent status */}
          {status.agent_status && status.status === "crawling" && (
            <div className="bg-[#0f1a0f] border border-[#1a2a1a] rounded p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#7ec87e] animate-pulse" />
                <span className="text-[#7ec87e] text-xs uppercase tracking-wider">Agent activity</span>
              </div>
              <div className="text-[#ededed] leading-snug">{status.agent_status}</div>
            </div>
          )}

          {/* Current URL (non-crawl phases) */}
          {status.current_url && status.status !== "crawling" && (
            <div>
              <div className="text-[#7ec87e] mb-1 uppercase tracking-wider">Current URL</div>
              <div className="text-[#a0a0a0] break-all">{status.current_url}</div>
            </div>
          )}

          {/* Pages discovered */}
          {pagesDiscovered.length > 0 && (
            <div>
              <div className="text-[#7ec87e] mb-2 uppercase tracking-wider">
                Pages Discovered ({pagesDiscovered.length})
              </div>
              <div className="space-y-1">
                {pagesDiscovered.map((url, i) => (
                  <div key={url} className="flex items-center gap-2 text-[#a0a0a0]">
                    <span className="text-[#7ec87e] w-4 text-right shrink-0">{i + 1}</span>
                    <span className="truncate flex-1">{url}</span>
                    <span className="text-[#7ec87e] shrink-0">✓</span>
                  </div>
                ))}
                <div ref={pagesEndRef} />
              </div>
            </div>
          )}

          {/* Pages from completed result */}
          {status.result && status.result.pages.length > 0 && (
            <div>
              <div className="text-[#7ec87e] mb-2 uppercase tracking-wider">Pages Scanned</div>
              <div className="space-y-1">
                {status.result.pages.map((page, i) => (
                  <div key={i} className="flex items-center gap-2 text-[#a0a0a0]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#7ec87e] shrink-0" />
                    <span className="flex-1 truncate">{page.url}</span>
                    <span className="text-[#606060]">
                      {(page.transfer_size_bytes / 1024 / 1024).toFixed(2)}MB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Live agent view ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a2a1a] shrink-0 bg-[#0a0f0a]">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${activeUrl ? "bg-[#7ec87e] animate-pulse" : "bg-[#303030]"}`} />
            <span className="text-xs font-mono text-[#606060] uppercase tracking-wider">Live Browser</span>
          </div>
          {activeUrl && (
            <a
              href={activeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#606060] hover:text-[#7ec87e] text-xs transition-colors"
            >
              Open in new tab ↗
            </a>
          )}
        </div>

        {/* URL bar */}
        <div className="px-4 py-2 border-b border-[#1a2a1a] bg-[#0f1a0f] shrink-0">
          <div className="bg-[#0a0f0a] border border-[#1a2a1a] rounded px-3 py-1.5 font-mono text-xs text-[#a0a0a0] truncate">
            {activeUrl || (status.status === "crawling" ? "Waiting for agent…" : "No preview available")}
          </div>
        </div>

        {/* Iframe panel */}
        {activeUrl && !iframeBlocked ? (
          <iframe
            src={activeUrl}
            className="flex-1 w-full bg-[#0f1a0f]"
            title="Live browser"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            onError={() => setIframeBlocked(true)}
          />
        ) : activeUrl && iframeBlocked ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[#0f1a0f]">
            <div className="text-[#606060] text-sm">Preview blocked by site security policy.</div>
            <a
              href={activeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-[#7ec87e] text-[#0a0f0a] text-sm font-semibold rounded hover:bg-[#6db86d] transition-colors"
            >
              Watch live in new tab ↗
            </a>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[#0f1a0f] relative">
            <div className="absolute inset-0 opacity-5" style={{
              backgroundImage: `linear-gradient(#7ec87e 1px, transparent 1px), linear-gradient(90deg, #7ec87e 1px, transparent 1px)`,
              backgroundSize: "40px 40px",
            }} />
            <div className="relative text-center space-y-3">
              {status.status === "done" ? (
                <>
                  <div className="w-14 h-14 border-4 border-[#7ec87e] rounded-full flex items-center justify-center mx-auto">
                    <div className="text-[#7ec87e] text-xl">✓</div>
                  </div>
                  <div className="text-[#7ec87e] font-mono text-sm">audit complete</div>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 border-4 border-[#7ec87e] border-t-transparent rounded-full animate-spin mx-auto" />
                  <div className="text-[#7ec87e] font-mono text-sm">
                    Waiting for live preview…
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
