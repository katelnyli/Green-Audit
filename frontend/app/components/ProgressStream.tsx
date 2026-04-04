"use client";

import { useEffect, useRef, useState } from "react";
import { streamAudit } from "@/app/lib/api";
import type { AuditStatus } from "@/app/types/audit";
import ReportView from "@/app/components/ReportView";

// ── Phase config ────────────────────────────────────────────────────────────

const PHASES = [
  { key: "queued",           label: "Queued",              icon: "○" },
  { key: "crawling",         label: "Crawling pages",      icon: "◎" },
  { key: "scoring",          label: "Lighthouse scoring",  icon: "◎" },
  { key: "generating_fixes", label: "Claude code fixes",   icon: "◎" },
  { key: "done",             label: "Complete",            icon: "●" },
] as const;

const PHASE_ORDER = PHASES.map((p) => p.key);

function phaseIndex(phase: string) {
  const i = PHASE_ORDER.indexOf(phase as (typeof PHASE_ORDER)[number]);
  return i === -1 ? 0 : i;
}

// ── Activity log entry ───────────────────────────────────────────────────────

interface LogEntry {
  ts: number;
  phase: string;
  url: string | null;
  progress: number | null;
  total: number | null;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ProgressStream({ auditId }: { auditId: string }) {
  const [status, setStatus] = useState<AuditStatus | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [error, setError] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stop = streamAudit(
      auditId,
      (s) => {
        setStatus(s);
        setLog((prev) => [
          ...prev,
          { ts: Date.now(), phase: s.status, url: s.current_url ?? null, progress: s.progress ?? null, total: s.total ?? null },
        ]);
      },
      (s) => setStatus(s),
      setError,
    );
    return stop;
  }, [auditId]);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  // ── Error state ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400 text-lg">{error}</p>
          <a href="/" className="inline-block text-zinc-400 hover:text-white text-sm underline">
            ← Start new audit
          </a>
        </div>
      </div>
    );
  }

  // ── Done — show report ───────────────────────────────────────────────────
  if (status?.status === "done" && status.result) {
    return <ReportView result={status.result} />;
  }

  // ── In progress ──────────────────────────────────────────────────────────
  const currentPhase = status?.status ?? "queued";
  const currentPhaseIdx = phaseIndex(currentPhase);

  const pct =
    status?.progress && status?.total
      ? Math.round((status.progress / status.total) * 100)
      : null;

  // Deduplicate log lines by URL+phase for cleaner display
  const dedupedLog: LogEntry[] = [];
  for (const entry of log) {
    const last = dedupedLog[dedupedLog.length - 1];
    if (last && last.phase === entry.phase && last.url === entry.url) continue;
    dedupedLog.push(entry);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl space-y-8">

        {/* Header */}
        <div className="text-center">
          <span className="inline-block text-4xl mb-3" style={{ animation: "pulse 2s infinite" }}>🌿</span>
          <h1 className="text-xl font-semibold text-white">Auditing site…</h1>
          <p className="text-zinc-500 text-sm mt-1 font-mono truncate">
            {status?.current_url ?? "Starting up"}
          </p>
        </div>

        {/* Phase timeline */}
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
          <div className="flex items-center justify-between gap-2">
            {PHASES.filter((p) => p.key !== "queued").map((phase, i) => {
              const idx = phaseIndex(phase.key);
              const done = currentPhaseIdx > idx;
              const active = currentPhaseIdx === idx;
              return (
                <div key={phase.key} className="flex flex-1 items-center gap-2">
                  {/* connector line before each item except the first */}
                  {i > 0 && (
                    <div className={`h-px flex-1 transition-colors duration-700 ${done || active ? "bg-green-600" : "bg-zinc-700"}`} />
                  )}
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-500 ${
                      done
                        ? "bg-green-600 border-green-600 text-white"
                        : active
                        ? "border-green-500 text-green-400 animate-pulse"
                        : "border-zinc-700 text-zinc-600"
                    }`}>
                      {done ? "✓" : i + 1}
                    </div>
                    <span className={`text-xs text-center leading-tight max-w-[72px] transition-colors duration-300 ${
                      active ? "text-green-400 font-medium" : done ? "text-zinc-400" : "text-zinc-600"
                    }`}>
                      {phase.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress bar (only when progress data available) */}
        {pct !== null && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-zinc-500">
              <span>{status?.progress} / {status?.total} pages</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-green-600 transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Activity log */}
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
          <div className="px-4 py-2 border-b border-zinc-800 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-zinc-400 font-medium">Live activity</span>
          </div>
          <div className="h-48 overflow-y-auto px-4 py-3 space-y-1.5 font-mono text-xs">
            {dedupedLog.length === 0 && (
              <p className="text-zinc-600">Connecting to stream…</p>
            )}
            {dedupedLog.map((entry, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-zinc-600 shrink-0 tabular-nums">
                  {new Date(entry.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span className={`shrink-0 font-medium ${
                  entry.phase === "crawling"         ? "text-blue-400" :
                  entry.phase === "scoring"          ? "text-yellow-400" :
                  entry.phase === "generating_fixes" ? "text-purple-400" :
                  "text-zinc-400"
                }`}>
                  [{entry.phase}]
                </span>
                <span className="text-zinc-300 truncate">
                  {entry.url ?? (entry.progress !== null ? `${entry.progress}/${entry.total}` : "…")}
                </span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>

      </div>
    </div>
  );
}
