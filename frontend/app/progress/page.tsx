"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { streamAudit } from "@/app/lib/api";
import type { AuditStatus } from "@/app/types/audit";

export default function Progress() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auditId = searchParams.get("audit_id");

  const [status, setStatus] = useState<AuditStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auditId) {
      setError("No audit ID provided");
      return;
    }

    const cleanup = streamAudit(
      auditId,
      (data) => {
        setStatus(data);
      },
      (data) => {
        setStatus(data);
        // Navigate to report when done
        setTimeout(() => {
          router.push(`/report?audit_id=${auditId}`);
        }, 1000);
      },
      (err) => {
        setError(err);
      }
    );

    return cleanup;
  }, [auditId, router]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0f0a]">
        <div className="text-center">
          <div className="text-[#ff6b6b] text-xl mb-4">Error</div>
          <div className="text-[#a0a0a0]">{error}</div>
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

  const domain = status.current_url ? new URL(status.current_url).hostname : "...";
  const progress = status.progress ?? 0;
  const total = status.total ?? 0;
  const totalMb = ((status.result?.summary.total_transfer_bytes ?? 0) / 1024 / 1024).toFixed(1);
  const totalCo2 = (status.result?.summary.total_estimated_co2_grams ?? 0).toFixed(1);

  return (
    <div className="flex h-screen bg-[#0a0f0a]">
      {/* LEFT: Status Feed */}
      <div className="w-1/2 border-r border-[#1a2a1a] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[#1a2a1a]">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-3 h-3 rounded-full ${status.status === "done" ? "bg-[#7ec87e]" : "bg-[#7ec87e] animate-pulse"}`} />
            <h1 className="text-xl font-semibold text-[#ededed]">
              {status.status === "done" ? "Completed" : `Scanning ${domain}`}
            </h1>
          </div>

          {/* Counters */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-[#606060]">Pages</div>
              <div className="text-[#ededed] font-mono text-lg">
                {progress}{total > 0 ? `/${total}` : ""}
              </div>
            </div>
            <div>
              <div className="text-[#606060]">Transfer</div>
              <div className="text-[#ededed] font-mono text-lg">
                {totalMb} MB
              </div>
            </div>
            <div>
              <div className="text-[#606060]">Est. CO₂</div>
              <div className="text-[#ededed] font-mono text-lg">
                {totalCo2}g
              </div>
            </div>
          </div>
        </div>

        {/* Status Info */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 font-mono text-sm">
          <div className="text-[#a0a0a0]">
            <div className="text-[#7ec87e] mb-2">Current Phase:</div>
            <div className="text-[#ededed] text-base">
              {status.status === "queued" && "Queued"}
              {status.status === "crawling" && "Crawling pages..."}
              {status.status === "scoring" && "Running Lighthouse audits..."}
              {status.status === "generating_fixes" && "Generating code fixes..."}
              {status.status === "done" && "Complete!"}
              {status.status === "error" && "Error occurred"}
            </div>
          </div>

          {status.current_url && (
            <div className="text-[#a0a0a0]">
              <div className="text-[#7ec87e] mb-2">Current URL:</div>
              <div className="text-[#ededed] break-all">{status.current_url}</div>
            </div>
          )}

          {status.result && status.result.pages.length > 0 && (
            <div className="mt-6">
              <div className="text-[#7ec87e] mb-3">Pages Scanned:</div>
              <div className="space-y-2">
                {status.result.pages.map((page, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-[#a0a0a0] hover:bg-[#0f1a0f] p-2 rounded"
                  >
                    <div className="w-2 h-2 rounded-full bg-[#7ec87e] flex-shrink-0" />
                    <div className="flex-1 truncate text-sm">{page.url}</div>
                    <div className="text-[#606060] text-xs">
                      {(page.transfer_size_bytes / 1024 / 1024).toFixed(2)}MB
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Browser Preview */}
      <div className="w-1/2 flex flex-col">
        <div className="p-6 border-b border-[#1a2a1a]">
          <div className="text-xs uppercase tracking-wider text-[#606060] mb-4">
            Live Browser Preview
          </div>

          {/* URL bar */}
          <div className="bg-[#0f1a0f] border border-[#1a2a1a] rounded px-4 py-2 font-mono text-sm text-[#a0a0a0]">
            {status.current_url || "Waiting..."}
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 flex items-center justify-center bg-[#0f1a0f] relative">
          {/* Animated grid background */}
          <div className="absolute inset-0 opacity-10">
            <div
              className="w-full h-full"
              style={{
                backgroundImage: `
                  linear-gradient(#7ec87e 1px, transparent 1px),
                  linear-gradient(90deg, #7ec87e 1px, transparent 1px)
                `,
                backgroundSize: "50px 50px",
              }}
            />
          </div>

          {/* Center indicator */}
          <div className="relative text-center">
            {status.status === "done" ? (
              <>
                <div className="w-16 h-16 border-4 border-[#7ec87e] rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="text-[#7ec87e] text-2xl">✓</div>
                </div>
                <div className="text-[#7ec87e] font-mono">audit complete</div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 border-4 border-[#7ec87e] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <div className="text-[#7ec87e] font-mono">browser agent active</div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
