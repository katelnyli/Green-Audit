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

  return <ReportView result={result} />;
}
