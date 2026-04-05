"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startAudit } from "@/app/lib/api";

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const router   = useRouter();
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
    <div className="relative flex flex-col min-h-screen bg-[#080d08] overflow-hidden">
      <main className="relative z-10 flex flex-col items-center justify-center flex-1 px-6 gap-10">

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yourwebsite.com"
            required
            className="w-full px-4 py-3 bg-[#0d140d] border border-[#1e301e] rounded-lg text-[#c8dcc8] text-sm placeholder:text-[#2e472e] focus:outline-none focus:border-[#3a5a3a] transition-colors"
          />

          <div className="space-y-2">
            <div className="text-xs text-[#3a553a] tracking-widest uppercase">
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
                      ? "bg-[#1e351e] text-[#8ab88a] border-[#2e4e2e]"
                      : "bg-transparent text-[#3a533a] border-[#1a2a1a] hover:border-[#2e472e] hover:text-[#5a7a5a]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-[#c87e7e] text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#1a2e1a] hover:bg-[#213821] border border-[#2a422a] text-[#7aac7a] text-sm font-medium rounded-lg transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border border-[#7aac7a] border-t-transparent rounded-full animate-spin" />
                Starting…
              </span>
            ) : (
              "Run Audit"
            )}
          </button>
        </form>
      </main>

      <footer className="relative z-10 py-5 text-center text-[#1e301e] text-xs tracking-wider">
        Powered by Browser Use
      </footer>
    </div>
  );
}
