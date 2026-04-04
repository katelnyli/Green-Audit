"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const MOCK_PAGES = [
  { path: "/", mb: 1.2 },
  { path: "/products", mb: 8.4 },
  { path: "/products/widget-pro", mb: 6.1 },
  { path: "/dashboard", mb: 9.8 },
  { path: "/checkout", mb: 4.1 },
  { path: "/blog", mb: 3.2 },
  { path: "/pricing", mb: 1.6 },
  { path: "/about", mb: 1.1 },
  { path: "/login", mb: 0.9 },
  { path: "/settings", mb: 2.3 },
  { path: "/settings/billing", mb: 1.8 },
  { path: "/admin", mb: 3.5 },
];

type LogEntry = {
  path: string;
  mb: number;
  status: "scanning" | "done" | "error";
};

export default function Progress() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetUrl = searchParams.get("url") || "https://example.com";
  const domain = new URL(targetUrl).hostname;

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [totalMb, setTotalMb] = useState(0);
  const [totalCo2, setTotalCo2] = useState(0);

  useEffect(() => {
    if (currentPageIndex >= MOCK_PAGES.length) {
      // Navigate to report after all pages scanned
      setTimeout(() => {
        router.push(`/report?url=${encodeURIComponent(targetUrl)}`);
      }, 1000);
      return;
    }

    const timer = setInterval(() => {
      const page = MOCK_PAGES[currentPageIndex];
      const isError = currentPageIndex === 3; // Dashboard page has error

      setLogs((prev) => [
        ...prev,
        {
          path: page.path,
          mb: page.mb,
          status: isError ? "error" : "done",
        },
      ]);

      if (!isError) {
        setTotalMb((prev) => prev + page.mb);
        setTotalCo2((prev) => prev + page.mb * 0.35); // rough estimate
      }

      setCurrentPageIndex((prev) => prev + 1);
    }, 800);

    return () => clearInterval(timer);
  }, [currentPageIndex, router, targetUrl]);

  return (
    <div className="flex h-screen bg-[#0a0f0a]">
      {/* LEFT: Log Feed */}
      <div className="w-1/2 border-r border-[#1a2a1a] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[#1a2a1a]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 bg-[#7ec87e] rounded-full animate-pulse" />
            <h1 className="text-xl font-semibold text-[#ededed]">
              Scanning {domain}
            </h1>
          </div>

          {/* Counters */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-[#606060]">Pages</div>
              <div className="text-[#ededed] font-mono text-lg">
                {logs.length}/{MOCK_PAGES.length}
              </div>
            </div>
            <div>
              <div className="text-[#606060]">Transfer</div>
              <div className="text-[#ededed] font-mono text-lg">
                {totalMb.toFixed(1)} MB
              </div>
            </div>
            <div>
              <div className="text-[#606060]">Est. CO₂</div>
              <div className="text-[#ededed] font-mono text-lg">
                {totalCo2.toFixed(1)}g
              </div>
            </div>
          </div>
        </div>

        {/* Log Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2 font-mono text-sm">
          {logs.map((log, i) => (
            <div
              key={i}
              className="flex items-center gap-3 text-[#a0a0a0] hover:bg-[#0f1a0f] p-2 rounded"
            >
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  log.status === "error"
                    ? "bg-[#ff6b6b]"
                    : log.status === "done"
                    ? "bg-[#7ec87e]"
                    : "bg-[#ffb84d]"
                }`}
              />
              <div className="flex-1 truncate">{log.path}</div>
              <div className="text-[#606060]">
                {log.status === "error" ? "error" : `${log.mb.toFixed(1)}MB`}
              </div>
            </div>
          ))}
          {/* TODO: replace mock with real SSE stream from backend */}
        </div>
      </div>

      {/* RIGHT: Browser Preview */}
      <div className="w-1/2 flex flex-col">
        <div className="p-6 border-b border-[#1a2a1a]">
          <div className="text-xs uppercase tracking-wider text-[#606060] mb-4">
            Live Browser Preview
          </div>

          {/* Mock URL bar */}
          <div className="bg-[#0f1a0f] border border-[#1a2a1a] rounded px-4 py-2 font-mono text-sm text-[#a0a0a0]">
            {targetUrl}
            {logs.length > 0 && logs[logs.length - 1].path}
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
            <div className="w-16 h-16 border-4 border-[#7ec87e] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <div className="text-[#7ec87e] font-mono">browser agent active</div>
          </div>

          {/* TODO: replace with <iframe src={liveUrl} /> when backend provides live_url in first SSE event */}
        </div>
      </div>
    </div>
  );
}
