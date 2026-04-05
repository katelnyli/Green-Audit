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
  const [isTerminating, setIsTerminating] = useState(false);
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

  useEffect(() => {
    pagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [status?.pages_discovered?.length]);

  const handleTerminate = async () => {
    if (!auditId || !window.confirm("Are you sure you want to stop this audit?")) return;
    setIsTerminating(true);
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const response = await fetch(`${BASE}/audit/${auditId}/terminate`, { method: "POST" });
      if (response.ok) {
        setTimeout(() => router.push(`/report?audit_id=${auditId}`), 300);
      }
    } catch {
      setIsTerminating(false);
    }
  };

  const LoadingScreen = ({ message }: { message: string }) => (
    <div className="relative flex items-center justify-center min-h-screen bg-[#0a0f0a] overflow-hidden">
      <div className="dot-grid absolute inset-0 pointer-events-none" />
      <div className="relative text-center space-y-4">
        <div className="w-12 h-12 border-2 border-[#7ec87e] border-t-transparent rounded-full animate-spin mx-auto" />
        <div className="text-[#7ec87e] font-mono text-sm tracking-wider">{message}</div>
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="relative flex items-center justify-center min-h-screen bg-[#0a0f0a] overflow-hidden">
        <div className="dot-grid absolute inset-0 pointer-events-none" />
        <div className="relative glass-card rounded-2xl p-10 text-center space-y-4 max-w-sm mx-auto">
          <div className="text-[#c87e7e] font-mono text-sm uppercase tracking-wider">Error</div>
          <div className="text-[#808080] text-sm">{error}</div>
          <a href="/" className="inline-block text-[#7ec87e] font-mono text-xs hover:opacity-80 transition-opacity">← New Audit</a>
        </div>
      </div>
    );
  }

  if (!status) return <LoadingScreen message="Connecting…" />;

  const domain = (() => {
    try { return new URL(status.current_url ?? "").hostname; } catch { return "…"; }
  })();

  const pagesDiscovered = status.pages_discovered ?? [];
  const liveUrls = status.live_urls ?? [];

  const phaseLabel: Record<string, string> = {
    queued:           "Queued…",
    crawling:         "Crawling pages…",
    scoring:          "Running Lighthouse audits…",
    generating_fixes: "Generating code fixes…",
    done:             "Complete!",
    error:            "Error",
  };

  const activeUrl = liveUrls[0] ?? status.live_url ?? null;

  return (
    <div className="relative flex h-screen bg-[#0a0f0a] overflow-hidden">
      {/* Dot grid */}
      <div className="dot-grid absolute inset-0 pointer-events-none opacity-50" />

      {/* ── LEFT: Status feed ─────────────────────────────────────────── */}
      <div className="relative z-10 w-[38%] border-r border-[#1a2a1a] flex flex-col shrink-0">

        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1a2a1a] shrink-0 bg-[#0a0f0a]/80 backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-3 items-center shrink-0">
              <a href="/" className="text-[#404040] hover:text-[#7ec87e] text-xs font-mono transition-colors">← New Audit</a>
              {status.status !== "done" && status.status !== "error" && (
                <button
                  onClick={handleTerminate}
                  disabled={isTerminating}
                  className="px-2.5 py-1 text-xs bg-[#2a0f0f] hover:bg-[#3a1414] text-[#c87e7e] border border-[#4a1a1a] rounded font-mono transition-colors disabled:opacity-50"
                >
                  {isTerminating ? "Stopping…" : "Stop"}
                </button>
              )}
            </div>
          </div>
          <div className="font-mono text-sm text-[#ededed] truncate mb-1">
            {status.status === "done" ? "Audit complete" : `Scanning ${domain}`}
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${status.status === "done" ? "bg-[#7ec87e]" : "bg-[#7ec87e] animate-pulse"}`} />
            <span className="text-[#7ec87e] font-mono text-xs">
              {phaseLabel[status.status] ?? status.status}
            </span>
          </div>
        </div>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 font-mono text-xs">

          {status.agent_status && status.status === "crawling" && (
            <div className="glass-card rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#7ec87e] animate-pulse" />
                <span className="text-[#7ec87e] text-xs uppercase tracking-wider">Agent</span>
              </div>
              <div className="text-[#c0c0c0] leading-snug">{status.agent_status}</div>
            </div>
          )}

          {status.current_url && status.status !== "crawling" && (
            <div>
              <div className="text-[#404040] mb-1 uppercase tracking-wider">Current URL</div>
              <div className="text-[#808080] break-all">{status.current_url}</div>
            </div>
          )}

          {pagesDiscovered.length > 0 && (
            <div>
              <div className="text-[#404040] mb-2 uppercase tracking-wider">
                Pages Discovered ({pagesDiscovered.length})
              </div>
              <div className="space-y-1.5">
                {pagesDiscovered.map((url, i) => (
                  <div key={url} className="flex items-center gap-2 text-[#606060]">
                    <span className="text-[#7ec87e] w-4 text-right shrink-0">{i + 1}</span>
                    <span className="truncate flex-1">{url}</span>
                    <span className="text-[#7ec87e] shrink-0">✓</span>
                  </div>
                ))}
                <div ref={pagesEndRef} />
              </div>
            </div>
          )}

          {status.result && status.result.pages.length > 0 && (
            <div>
              <div className="text-[#404040] mb-2 uppercase tracking-wider">Pages Scanned</div>
              <div className="space-y-1.5">
                {status.result.pages.map((page, i) => (
                  <div key={i} className="flex items-center gap-2 text-[#606060]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#7ec87e] shrink-0" />
                    <span className="flex-1 truncate">{page.url}</span>
                    <span className="text-[#404040]">
                      {(page.transfer_size_bytes / 1024 / 1024).toFixed(2)}MB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Live agent view ─────────────────────────────────────── */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0">

        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1a2a1a] shrink-0 bg-[#0a0f0a]/80 backdrop-blur">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${activeUrl ? "bg-[#7ec87e] animate-pulse" : "bg-[#252525]"}`} />
            <span className="text-xs font-mono text-[#404040] uppercase tracking-wider">Live Browser</span>
          </div>
          {activeUrl && (
            <a href={activeUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs font-mono text-[#404040] hover:text-[#7ec87e] transition-colors">
              Open in new tab ↗
            </a>
          )}
        </div>

        {/* URL bar */}
        <div className="px-4 py-2 border-b border-[#1a2a1a] shrink-0 bg-[#0a0f0a]/60">
          <div className="bg-[#070c07] border border-[#1a2a1a] rounded-lg px-3 py-1.5 font-mono text-xs text-[#505050] truncate">
            {activeUrl || (status.status === "crawling" ? "Waiting for agent…" : "No preview available")}
          </div>
        </div>

        {/* Iframe panel */}
        {activeUrl && !iframeBlocked ? (
          <iframe
            src={activeUrl}
            className="flex-1 w-full"
            title="Live browser"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            onError={() => setIframeBlocked(true)}
          />
        ) : activeUrl && iframeBlocked ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[#0a0f0a]">
            <div className="text-[#505050] text-sm font-mono">Preview blocked by site security policy.</div>
            <a href={activeUrl} target="_blank" rel="noopener noreferrer"
              className="px-5 py-2.5 shimmer-btn text-[#0a0f0a] text-sm font-bold rounded-xl shadow-[0_4px_24px_rgba(126,200,126,0.25)]">
              Watch live in new tab ↗
            </a>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[#0a0f0a] relative">
            <div className="dot-grid absolute inset-0 opacity-30 pointer-events-none" />
            <div className="relative text-center space-y-3">
              {status.status === "done" ? (
                <>
                  <div className="w-14 h-14 border-2 border-[#7ec87e] rounded-full flex items-center justify-center mx-auto">
                    <div className="text-[#7ec87e] text-xl">✓</div>
                  </div>
                  <div className="text-[#7ec87e] font-mono text-sm">audit complete</div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 border-2 border-[#7ec87e] border-t-transparent rounded-full animate-spin mx-auto" />
                  <div className="text-[#505050] font-mono text-sm">Waiting for live preview…</div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
