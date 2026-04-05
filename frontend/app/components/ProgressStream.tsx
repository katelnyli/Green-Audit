"use client";

import { useEffect, useRef, useState } from "react";
import { streamAudit } from "@/app/lib/api";
import type { AuditStatus } from "@/app/types/audit";
import ReportView from "@/app/components/ReportView";

// ── Phase config ─────────────────────────────────────────────────────────────

const PHASES = [
  { key: "crawling",         label: "Crawling",       step: 1 },
  { key: "scoring",          label: "Lighthouse",     step: 2 },
  { key: "generating_fixes", label: "Claude fixes",   step: 3 },
  { key: "done",             label: "Complete",       step: 4 },
] as const;

type PhaseKey = (typeof PHASES)[number]["key"] | "queued" | "error";

function phaseStep(phase: PhaseKey): number {
  return PHASES.find((p) => p.key === phase)?.step ?? 0;
}

// ── Log entry ────────────────────────────────────────────────────────────────

interface LogEntry {
  ts: number;
  phase: string;
  url: string | null;
}

// ── CO2 estimate per byte (same formula as backend) ──────────────────────────
const CO2_PER_BYTE = 0.000000000072 * 442; // kWh/byte × gCO2/kWh

function estimateCo2(pages: string[]): number {
  // Very rough estimate: 500 KB average page for discovered URLs during crawl
  return pages.length * 500_000 * CO2_PER_BYTE;
}

// ── Main component ───────────────────────────────────────────────────────────

export default function ProgressStream({ auditId }: { auditId: string }) {
  const [status, setStatus] = useState<AuditStatus | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [error, setError] = useState("");
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const pagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stop = streamAudit(
      auditId,
      (s) => {
        setStatus(s);
        setLog((prev) => {
          const entry: LogEntry = { ts: Date.now(), phase: s.status, url: s.current_url ?? null };
          const last = prev[prev.length - 1];
          if (last && last.phase === entry.phase && last.url === entry.url) return prev;
          return [...prev, entry];
        });
      },
      (s) => setStatus(s),
      setError,
    );
    return stop;
  }, [auditId]);

  // Auto-scroll log and page list
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [log]);
  useEffect(() => { pagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [status?.pages_discovered]);

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400 text-lg">{error}</p>
          <a href="/" className="text-zinc-400 hover:text-white text-sm underline">← Start new audit</a>
        </div>
      </div>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  if (status?.status === "done" && status.result) {
    return <ReportView result={status.result} />;
  }

  const phase = status?.status ?? "queued";
  const currentStep = phaseStep(phase as PhaseKey);
  const isCrawling = phase === "crawling";
  const liveUrl = status?.live_url ?? null;
  const pages = status?.pages_discovered ?? [];
  const estimatedCo2 = estimateCo2(pages);

  const pct = status?.progress && status?.total
    ? Math.round((status.progress / status.total) * 100)
    : null;

  // ── Split-screen crawl view ───────────────────────────────────────────────
  if (isCrawling && liveUrl) {
    return (
      <div className="flex flex-col h-screen bg-zinc-950">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-zinc-600 text-sm">—</span>
            <span className="text-zinc-400 text-sm font-sans truncate max-w-xs">
              {status?.current_url ?? "Crawling…"}
            </span>
          </div>
          <PhaseStepper currentStep={currentStep} />
        </div>

        {/* Split panes */}
        <div className="flex flex-1 min-h-0">
          {/* Left: live browser */}
          <div className="flex flex-col w-3/5 border-r border-zinc-800">
            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-zinc-400 font-medium">Live browser — browser-use agent</span>
              {!iframeBlocked && (
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 underline"
                >
                  Open in new tab ↗
                </a>
              )}
            </div>
            {iframeBlocked ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-900">
                <p className="text-zinc-500 text-sm">Browser preview blocked by site policy.</p>
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-white text-sm font-medium transition-colors"
                >
                  Watch live in new tab ↗
                </a>
              </div>
            ) : (
              <iframe
                src={liveUrl}
                className="flex-1 w-full bg-zinc-900"
                title="Live browser"
                onError={() => setIframeBlocked(true)}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            )}
          </div>

          {/* Right: discovered pages */}
          <div className="flex flex-col w-2/5">
            {/* CO2 counter + agent status */}
            <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-900 shrink-0">
              <p className="text-xs text-zinc-500 mb-1">Estimated CO₂ so far</p>
              <p className="text-3xl font-bold tabular-nums text-green-400">
                {estimatedCo2.toFixed(3)}
                <span className="text-base font-normal text-zinc-500 ml-1">g CO₂</span>
              </p>
              <p className="text-xs text-zinc-600 mt-0.5">{pages.length} pages discovered</p>
              {status?.agent_status && (
                <div className="mt-3 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse mt-1 shrink-0" />
                  <p className="text-xs text-zinc-400 leading-snug line-clamp-2">
                    {status.agent_status}
                  </p>
                </div>
              )}
            </div>

            {/* Page list */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/50">
              {pages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 gap-2">
                  <span className="w-2 h-2 rounded-full bg-zinc-600 animate-pulse" />
                  <p className="text-zinc-600 text-sm">Agent exploring…</p>
                </div>
              )}
              {pages.map((pageUrl, i) => (
                <div
                  key={pageUrl}
                  className="flex items-center gap-3 px-5 py-3 transition-opacity duration-300"
                  style={{ animation: "fadeSlideIn 0.3s ease-out" }}
                >
                  <span className="text-green-500 text-xs font-sans shrink-0 w-5 text-right">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-zinc-300 text-xs font-sans truncate">{pageUrl}</p>
                  </div>
                  <span className="text-green-700 text-xs shrink-0">✓</span>
                </div>
              ))}
              <div ref={pagesEndRef} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Centered progress view (no live_url yet, or post-crawl phases) ─────────
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl space-y-8">

        {/* Header */}
        <div className="text-center">
          <span className="inline-block text-4xl mb-3 animate-pulse">🌿</span>
          <h1 className="text-xl font-semibold text-white">
            {isCrawling ? "Connecting to browser-use…" : phaseLabel(phase)}
          </h1>
          <p className="text-zinc-500 text-sm mt-1 font-sans truncate max-w-sm mx-auto">
            {status?.current_url ?? "Starting up"}
          </p>
          {status?.agent_status && (
            <p className="text-zinc-600 text-xs mt-2 max-w-sm mx-auto line-clamp-1">
              {status.agent_status}
            </p>
          )}
        </div>

        {/* Phase stepper (full width) */}
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
          <PhaseStepper currentStep={currentStep} wide />
        </div>

        {/* Progress bar */}
        {pct !== null && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-zinc-500">
              <span>{status?.progress} / {status?.total} pages</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full bg-green-600 transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {/* Activity log */}
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
          <div className="px-4 py-2 border-b border-zinc-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-zinc-400 font-medium">Live activity</span>
            {pages.length > 0 && (
              <span className="ml-auto text-xs text-zinc-600">{pages.length} pages found</span>
            )}
          </div>
          <div className="h-52 overflow-y-auto px-4 py-3 space-y-1.5 font-sans text-xs">
            {log.length === 0 && <p className="text-zinc-600">Connecting to stream…</p>}
            {log.map((entry, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-zinc-600 shrink-0 tabular-nums">
                  {new Date(entry.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span className={`shrink-0 font-medium ${phaseColor(entry.phase)}`}>
                  [{entry.phase}]
                </span>
                <span className="text-zinc-300 truncate">{entry.url ?? "…"}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Phase stepper sub-component ───────────────────────────────────────────────

function PhaseStepper({ currentStep, wide = false }: { currentStep: number; wide?: boolean }) {
  return (
    <div className={`flex items-center ${wide ? "justify-between" : "gap-4"}`}>
      {PHASES.map((phase, i) => {
        const done = currentStep > phase.step;
        const active = currentStep === phase.step;
        return (
          <div key={phase.key} className="flex flex-1 items-center gap-2">
            {i > 0 && (
              <div className={`h-px flex-1 transition-colors duration-700 ${done || active ? "bg-green-600" : "bg-zinc-700"}`} />
            )}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-500 ${
                done    ? "bg-green-600 border-green-600 text-white" :
                active  ? "border-green-500 text-green-400 animate-pulse" :
                          "border-zinc-700 text-zinc-600"
              }`}>
                {done ? "✓" : phase.step}
              </div>
              {wide && (
                <span className={`text-xs text-center leading-tight max-w-[72px] transition-colors ${
                  active ? "text-green-400 font-medium" : done ? "text-zinc-400" : "text-zinc-600"
                }`}>
                  {phase.label}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function phaseLabel(phase: string): string {
  const map: Record<string, string> = {
    queued: "Queued…",
    crawling: "Crawling pages",
    scoring: "Running Lighthouse",
    generating_fixes: "Generating code fixes with Claude",
    done: "Complete",
    error: "Error",
  };
  return map[phase] ?? phase;
}

function phaseColor(phase: string): string {
  if (phase === "crawling") return "text-blue-400";
  if (phase === "scoring") return "text-yellow-400";
  if (phase === "generating_fixes") return "text-purple-400";
  return "text-zinc-400";
}
