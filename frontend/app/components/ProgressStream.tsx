"use client";

import { useEffect, useState } from "react";
import { streamAudit } from "@/app/lib/api";
import type { AuditStatus } from "@/app/types/audit";
import ReportView from "@/app/components/ReportView";

const PHASE_LABELS: Record<string, string> = {
  queued: "Queued…",
  crawling: "Crawling pages",
  scoring: "Running Lighthouse",
  generating_fixes: "Generating code fixes with Claude",
  done: "Complete",
  error: "Error",
};

export default function ProgressStream({ auditId }: { auditId: string }) {
  const [status, setStatus] = useState<AuditStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const stop = streamAudit(
      auditId,
      setStatus,
      setStatus,
      setError
    );
    return stop;
  }, [auditId]);

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg">{error}</p>
          <a href="/" className="mt-4 inline-block text-zinc-400 hover:text-white text-sm">
            ← Start new audit
          </a>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-zinc-500">Connecting…</p>
      </div>
    );
  }

  if (status.status === "done" && status.result) {
    return <ReportView result={status.result} />;
  }

  const phase = PHASE_LABELS[status.status] ?? status.status;
  const pct =
    status.progress && status.total
      ? Math.round((status.progress / status.total) * 100)
      : null;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="w-full max-w-lg space-y-6 text-center">
        <span className="inline-block text-5xl animate-pulse">🌿</span>
        <div>
          <p className="text-white text-xl font-medium">{phase}</p>
          {status.current_url && (
            <p className="mt-1 text-zinc-500 text-sm truncate">{status.current_url}</p>
          )}
        </div>

        {pct !== null && (
          <div className="space-y-2">
            <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-green-600 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-zinc-500 text-sm">
              {status.progress} / {status.total} pages
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
