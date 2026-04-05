"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startAudit } from "@/app/lib/api";
import DarkVeil from "@/app/components/DarkVeil";

export default function Home() {
  const router = useRouter();
  const [url, setUrl]           = useState("");
  const [maxPages, setMaxPages] = useState(10);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

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
    <div className="relative flex flex-col min-h-screen bg-[#03070a] overflow-hidden">

      {/* ── Dark Veil background ─────────────────────────────────────────────── */}
      <div className="fixed pointer-events-none" aria-hidden style={{ zIndex: 0, top: 0, left: 0, right: 0, height: "200%" }}>
        <DarkVeil
          hueShift={130}
          speed={0.5}
          noiseIntensity={0.04}
          warpAmount={0.08}
          resolutionScale={0.6}
        />
      </div>

      {/* ── Radial vignette to keep center readable ───────────────────────── */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          background:
            "radial-gradient(ellipse at 50% 45%, rgba(3,7,10,0.35) 0%, rgba(3,7,10,0.78) 100%)",
        }}
      />

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <main className="relative flex flex-col items-center justify-center flex-1 px-6 gap-8" style={{ zIndex: 2 }}>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yourwebsite.com"
            required
            className="w-full px-4 py-3 bg-[#0b1410]/80 border border-[#1e3428] rounded-lg text-[#f0faf2] text-sm placeholder:text-[#4a7860] focus:outline-none focus:border-[#2e5040] transition-colors backdrop-blur-sm"
          />

          <div className="space-y-2">
            <div className="text-xs text-[#7aaa90] tracking-widest uppercase">
              Pages to crawl
            </div>
            <div className="flex gap-2">
              {[5, 10, 15, 20].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMaxPages(n)}
                  className={`flex-1 py-2 rounded-lg text-sm border transition-all duration-150 ${
                    maxPages === n
                      ? "bg-[#1a3828] text-[#b8e8c0] border-[#2a5040]"
                      : "bg-transparent text-[#6a9880] border-[#182820] hover:border-[#2a4838] hover:text-[#9acc9a]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-[#d08888] text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#152820]/80 hover:bg-[#1c3830]/80 border border-[#254838] text-[#aadabb] text-sm font-medium rounded-lg transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed backdrop-blur-sm"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border border-[#aadabb] border-t-transparent rounded-full animate-spin" />
                Starting…
              </span>
            ) : (
              "Run Audit"
            )}
          </button>
        </form>
      </main>

      <footer className="relative py-5 text-center text-[#233828] text-xs tracking-wider" style={{ zIndex: 2 }}>
        Powered by Browser Use
      </footer>
    </div>
  );
}
