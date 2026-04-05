"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { streamAudit } from "@/app/lib/api";
import type { AuditStatus } from "@/app/types/audit";

const PHASES = [
  { key: "crawling",         label: "Crawling" },
  { key: "scoring",          label: "Scoring" },
  { key: "generating_fixes", label: "Generating fixes" },
  { key: "done",             label: "Complete" },
];

function phaseIndex(status: string) {
  const i = PHASES.findIndex((p) => p.key === status);
  return i === -1 ? (status === "queued" ? -1 : PHASES.length) : i;
}

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
      (data) => { setStatus(data); setTimeout(() => router.push(`/report?audit_id=${auditId}`), 800); },
      (err) => setError(err),
    );
    return cleanup;
  }, [auditId, router]);

  useEffect(() => {
    pagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [status?.pages_discovered?.length]);

  const handleTerminate = async () => {
    if (!auditId || !window.confirm("Stop this audit?")) return;
    setIsTerminating(true);
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(`${BASE}/audit/${auditId}/terminate`, { method: "POST" });
      if (res.ok) setTimeout(() => router.push(`/report?audit_id=${auditId}`), 300);
    } catch {
      setIsTerminating(false);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#080d08]">
        <div className="text-center space-y-3">
          <p className="text-[#c87e7e] text-sm">{error}</p>
          <a href="/" className="text-[#3a5a3a] hover:text-[#6a9a6a] text-xs transition-colors">← New Audit</a>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#080d08]">
        <div className="w-5 h-5 border border-[#3a5a3a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const domain = (() => { try { return new URL(status.current_url ?? "").hostname; } catch { return "…"; } })();
  const pagesDiscovered = status.pages_discovered ?? [];
  const liveUrls = status.live_urls ?? [];
  const activeUrl = liveUrls[0] ?? status.live_url ?? null;
  const curPhaseIdx = phaseIndex(status.status);

  return (
    <div className="flex flex-col h-screen bg-[#080d08] overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#141f14] shrink-0">
        <div className="flex items-center gap-4">
          <a href="/" className="text-[#2e472e] hover:text-[#5a7a5a] text-xs transition-colors">← New Audit</a>
          <span className="text-[#1a2a1a] text-xs">|</span>
          <span className="text-[#4a6a4a] text-xs truncate max-w-xs">{domain}</span>
        </div>
        {status.status !== "done" && status.status !== "error" && (
          <button
            onClick={handleTerminate}
            disabled={isTerminating}
            className="text-xs text-[#2e472e] hover:text-[#c87e7e] transition-colors disabled:opacity-40"
          >
            {isTerminating ? "Stopping…" : "Stop"}
          </button>
        )}
      </div>

      {/* ── Live agent view — full width, tall ──────────────────────── */}
      <div className="shrink-0" style={{ height: "72vh" }}>
        {activeUrl && !iframeBlocked ? (
          <iframe
            src={activeUrl}
            className="w-full h-full"
            title="Live browser"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            onError={() => setIframeBlocked(true)}
          />
        ) : activeUrl && iframeBlocked ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            <p className="text-[#2e472e] text-xs">Preview blocked by site policy.</p>
            <a href={activeUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-[#5a8a5a] hover:text-[#7aac7a] transition-colors">
              Open in new tab ↗
            </a>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {status.status === "done" ? (
              <p className="text-[#2e472e] text-xs">Audit complete</p>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 border border-[#2e472e] border-t-transparent rounded-full animate-spin" />
                <span className="text-[#2e472e] text-xs">Waiting for preview…</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 3-column status panel ────────────────────────────────────── */}
      <div className="flex-1 border-t border-[#141f14] grid grid-cols-3 divide-x divide-[#141f14] overflow-hidden">

        {/* Col 1 — Pages discovered */}
        <div className="overflow-y-auto px-5 py-4">
          <div className="text-[#2e472e] text-xs uppercase tracking-widest mb-3">
            Pages discovered
            {pagesDiscovered.length > 0 && (
              <span className="ml-2 text-[#3a5a3a]">
                ({pagesDiscovered.length}{status.total && status.total > 0 ? `/${status.total}` : ""})
              </span>
            )}
          </div>
          {pagesDiscovered.length === 0 ? (
            <p className="text-[#1e2e1e] text-xs">None yet</p>
          ) : (
            <div className="space-y-1.5">
              {pagesDiscovered.map((u, i) => (
                <div key={u} className="flex items-start gap-2 text-xs text-[#3a5a3a]">
                  <span className="text-[#1e2e1e] shrink-0 w-4 text-right">{i + 1}</span>
                  <span className="break-all leading-snug">{u}</span>
                </div>
              ))}
              <div ref={pagesEndRef} />
            </div>
          )}
        </div>

        {/* Col 2 — Progress (highlighted) */}
        <div className="overflow-y-auto px-5 py-4 bg-[#0a110a]">
          <div className="text-[#4a7a4a] text-xs uppercase tracking-widest mb-4">Progress</div>
          <div className="space-y-3">
            {PHASES.map((phase, i) => {
              const done    = i < curPhaseIdx;
              const active  = i === curPhaseIdx;
              const pending = i > curPhaseIdx;
              return (
                <div key={phase.key} className="flex items-center gap-3">
                  <div className="shrink-0 w-5 flex items-center justify-center">
                    {done ? (
                      <span className="text-[#3a5a3a] text-xs">✓</span>
                    ) : active ? (
                      <div className="w-3 h-3 border border-[#5a9a5a] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-[#1a2a1a]" />
                    )}
                  </div>
                  <span className={`text-xs ${
                    done    ? "text-[#3a5a3a]" :
                    active  ? "text-[#8aba8a] font-medium" :
                              "text-[#1e2e1e]"
                  }`}>
                    {phase.label}
                  </span>
                  {active && status.progress !== undefined && status.total !== undefined && status.total > 0 && (
                    <span className="ml-auto text-[#3a5a3a] text-xs">
                      {status.progress}/{status.total}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {status.total !== undefined && status.total > 0 && status.progress !== undefined && (
            <div className="mt-5">
              <div className="h-px bg-[#141f14] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#3a5a3a] transition-all duration-500"
                  style={{ width: `${Math.round((status.progress / status.total) * 100)}%` }}
                />
              </div>
              <div className="text-[#2e472e] text-xs mt-1.5">
                {Math.round((status.progress / status.total) * 100)}%
              </div>
            </div>
          )}
        </div>

        {/* Col 3 — Activity */}
        <div className="overflow-y-auto px-5 py-4">
          <div className="text-[#2e472e] text-xs uppercase tracking-widest mb-3">Activity</div>
          <div className="space-y-4 text-xs">

            {status.agent_status && (
              <div>
                <div className="text-[#1e2e1e] uppercase tracking-widest mb-1.5">Agent</div>
                <p className="text-[#3a5a3a] leading-relaxed">{status.agent_status}</p>
              </div>
            )}

            {status.current_url && (
              <div>
                <div className="text-[#1e2e1e] uppercase tracking-widest mb-1.5">Current</div>
                <p className="text-[#3a5a3a] break-all leading-snug">{status.current_url}</p>
              </div>
            )}

            {status.result && status.result.pages.length > 0 && (
              <div>
                <div className="text-[#1e2e1e] uppercase tracking-widest mb-1.5">
                  Scanned ({status.result.pages.length})
                </div>
                <div className="space-y-1">
                  {status.result.pages.map((page, i) => (
                    <div key={i} className="flex justify-between gap-3 text-[#2e472e]">
                      <span className="truncate flex-1">{(() => { try { return new URL(page.url).pathname || "/"; } catch { return page.url; } })()}</span>
                      <span className="shrink-0">{(page.transfer_size_bytes / 1024 / 1024).toFixed(1)}MB</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!status.agent_status && !status.current_url && !status.result && (
              <p className="text-[#1e2e1e]">Waiting…</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
