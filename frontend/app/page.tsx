"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startAudit } from "@/app/lib/api";

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { audit_id } = await startAudit(url, undefined, maxPages);
      router.push(`/progress?audit_id=${audit_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start audit");
      setLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col min-h-screen bg-[#0a0f0a] overflow-hidden">
      {/* Dot grid */}
      <div className="dot-grid absolute inset-0 pointer-events-none" />

      {/* Aurora blobs */}
      <div className="aurora-blob-1 absolute pointer-events-none"
        style={{
          top: "-10%", left: "10%",
          width: "680px", height: "580px",
          background: "radial-gradient(ellipse, rgba(74,219,110,0.28) 0%, rgba(74,219,110,0.08) 45%, transparent 70%)",
          filter: "blur(72px)",
        }}
      />
      <div className="aurora-blob-2 absolute pointer-events-none"
        style={{
          top: "-5%", right: "5%",
          width: "560px", height: "500px",
          background: "radial-gradient(ellipse, rgba(45,212,191,0.2) 0%, rgba(45,212,191,0.06) 45%, transparent 70%)",
          filter: "blur(90px)",
        }}
      />
      <div className="aurora-blob-3 absolute pointer-events-none"
        style={{
          top: "20%", left: "35%",
          width: "500px", height: "400px",
          background: "radial-gradient(ellipse, rgba(126,200,126,0.15) 0%, rgba(126,200,126,0.04) 50%, transparent 70%)",
          filter: "blur(100px)",
        }}
      />


      {/* Hero */}
      <main className="relative z-10 flex flex-col items-center justify-center flex-1 px-6 py-16">
        <div className="max-w-4xl w-full text-center space-y-6">

          {/* Badge */}
          <div className="animate-fade-up inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#1a2a1a] bg-[#0f1a0f] text-xs font-mono text-[#7ec87e] tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7ec87e] animate-pulse" />
            Powered by Browser Use + Claude AI
          </div>

          {/* Headline */}
          <h1 className="animate-fade-up-1 text-5xl md:text-7xl font-bold text-[#ededed] leading-[1.1] tracking-tight">
            Full-site{" "}
            <span className="gradient-text">green audits</span>
            <br />
            at a click
          </h1>

          {/* Sub */}
          <p className="animate-fade-up-2 text-lg text-[#606060] max-w-2xl mx-auto leading-relaxed">
            Existing tools scan one page.{" "}
            <span className="text-[#a0a0a0]">Green Audit crawls your entire site</span> — including
            authenticated pages — and shows you exactly where your carbon footprint comes from.
          </p>

          {/* Form Card */}
          <div className="animate-fade-up-3 glass-card rounded-2xl p-8 max-w-xl mx-auto mt-6 transition-all duration-300">
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* URL input */}
              <div className="relative">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  required
                  className="input-glow w-full px-4 py-3.5 bg-[#070c07] border border-[#1a2a1a] rounded-lg text-[#ededed] font-mono text-sm placeholder:text-[#404040] transition-all duration-200"
                />
              </div>

              {/* Pages to crawl */}
              <div>
                <div className="text-[#505050] text-xs font-mono uppercase tracking-wider mb-2.5">
                  Pages to crawl
                </div>
                <div className="flex gap-2">
                  {[5, 10, 15, 20].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMaxPages(n)}
                      className={`flex-1 py-2 rounded-lg font-mono text-sm border transition-all duration-150 ${
                        maxPages === n
                          ? "bg-[#7ec87e] text-[#0a0f0a] border-[#7ec87e] shadow-[0_0_16px_rgba(126,200,126,0.3)]"
                          : "bg-transparent text-[#505050] border-[#1a2a1a] hover:border-[#7ec87e] hover:text-[#7ec87e]"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="text-[#ff6b6b] text-sm font-mono">{error}</div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-4 text-[#0a0f0a] font-bold rounded-xl transition-all duration-200 text-sm tracking-wide ${
                  loading
                    ? "bg-[#3a5a3a] cursor-not-allowed"
                    : "shimmer-btn hover:scale-[1.01] active:scale-[0.99] shadow-[0_4px_24px_rgba(126,200,126,0.25)]"
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-[#0a0f0a] border-t-transparent rounded-full animate-spin" />
                    Starting audit…
                  </span>
                ) : (
                  "Run Audit →"
                )}
              </button>
            </form>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-5 text-center text-[#303030] border-t border-[#111a11] text-xs font-mono tracking-wider">
        Powered by Browser Use
      </footer>
    </div>
  );
}
