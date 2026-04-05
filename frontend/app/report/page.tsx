"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getAudit } from "@/app/lib/api";
import type { AuditResult } from "@/app/types/audit";
import ReportView from "@/app/components/ReportView";

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
        } else if (status.status === "done" && status.pages_discovered.length === 0) {
          setError("Audit was terminated before any pages were discovered");
        } else if (status.status === "done") {
          setError("Audit was terminated. No analysis data available yet.");
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
      <div className="relative flex items-center justify-center min-h-screen bg-[#0a0f0a] overflow-hidden">
        <div className="dot-grid absolute inset-0 pointer-events-none" />
        <div className="relative text-center space-y-4">
          <div className="w-12 h-12 border-2 border-[#7ec87e] border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-[#7ec87e] font-sans text-sm tracking-wider">Loading report…</div>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="relative flex items-center justify-center min-h-screen bg-[#0a0f0a] overflow-hidden">
        <div className="dot-grid absolute inset-0 pointer-events-none" />
        <div className="relative glass-card rounded-2xl p-10 text-center space-y-4 max-w-sm mx-auto">
          <div className="text-[#c87e7e] font-sans text-sm uppercase tracking-wider">Error</div>
          <div className="text-[#808080] text-sm">{error || "No data available"}</div>
          <a href="/" className="inline-block text-[#7ec87e] font-sans text-xs hover:opacity-80 transition-opacity">← New Audit</a>
        </div>
      </div>
    );
  }

  return <ReportView result={result} />;
}
