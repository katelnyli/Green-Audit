"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startAudit } from "@/app/lib/api";

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [showCredentials, setShowCredentials] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [maxPages, setMaxPages] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const creds = showCredentials && username ? { username, password } : undefined;
      const { audit_id } = await startAudit(url, creds, maxPages);
      router.push(`/progress?audit_id=${audit_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start audit");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f0a]">
      {/* Hero Section */}
      <main className="flex flex-col items-center justify-center flex-1 px-6 py-20">
        <div className="max-w-4xl w-full text-center space-y-8">
          <h1 className="text-5xl md:text-6xl font-bold text-[#ededed] leading-tight">
            Full-site green audits at the click of a button
          </h1>
          <p className="text-xl text-[#a0a0a0] max-w-3xl mx-auto">
            Existing tools scan one page. Green Audit crawls your entire site — including authenticated pages — and shows you exactly where your carbon footprint comes from.
          </p>

          {/* Form Card */}
          <div className="bg-[#0f1a0f] border border-[#1a2a1a] rounded-lg p-8 max-w-2xl mx-auto mt-12">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  required
                  className="w-full px-4 py-3 bg-[#0a0f0a] border border-[#1a2a1a] rounded text-[#ededed] font-mono placeholder:text-[#606060] focus:outline-none focus:border-[#7ec87e]"
                />
              </div>

              {/* Collapsible Credentials */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowCredentials(!showCredentials)}
                  className="text-[#7ec87e] text-sm hover:underline"
                >
                  {showCredentials ? "− Hide" : "+ Add"} login credentials
                </button>
                {showCredentials && (
                  <div className="mt-4 space-y-3">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Username"
                      className="w-full px-4 py-3 bg-[#0a0f0a] border border-[#1a2a1a] rounded text-[#ededed] placeholder:text-[#606060] focus:outline-none focus:border-[#7ec87e]"
                    />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full px-4 py-3 bg-[#0a0f0a] border border-[#1a2a1a] rounded text-[#ededed] placeholder:text-[#606060] focus:outline-none focus:border-[#7ec87e]"
                    />
                  </div>
                )}
              </div>

              {/* Page count selector */}
              <div>
                <div className="text-[#606060] text-sm mb-3">Pages to crawl</div>
                <div className="flex gap-2">
                  {[5, 10, 15, 20].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMaxPages(n)}
                      className={`flex-1 py-2 rounded font-mono text-sm border transition-colors ${
                        maxPages === n
                          ? "bg-[#7ec87e] text-[#0a0f0a] border-[#7ec87e]"
                          : "bg-[#0a0f0a] text-[#606060] border-[#1a2a1a] hover:border-[#7ec87e] hover:text-[#7ec87e]"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="text-[#ff6b6b] text-sm">{error}</div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-[#7ec87e] text-[#0a0f0a] font-semibold rounded hover:bg-[#6db86d] transition-colors disabled:bg-[#3a5a3a] disabled:cursor-not-allowed"
              >
                {loading ? "Starting..." : "Run Audit"}
              </button>
            </form>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            <div className="bg-[#0f1a0f] border border-[#1a2a1a] rounded-lg p-6">
              <div className="text-3xl font-bold text-[#7ec87e] font-mono">~3x</div>
              <div className="text-[#a0a0a0] mt-2">more coverage</div>
            </div>
            <div className="bg-[#0f1a0f] border border-[#1a2a1a] rounded-lg p-6">
              <div className="text-3xl font-bold text-[#7ec87e] font-mono">0</div>
              <div className="text-[#a0a0a0] mt-2">setup required</div>
            </div>
            <div className="bg-[#0f1a0f] border border-[#1a2a1a] rounded-lg p-6">
              <div className="text-3xl font-bold text-[#7ec87e] font-mono">CO₂</div>
              <div className="text-[#a0a0a0] mt-2">per page estimates</div>
            </div>
          </div>

          {/* Impact Statement */}
          <div className="mt-16 border-l-[3px] border-[#7ec87e] pl-10 py-8">
            <p className="text-[28px] leading-tight text-[#ededed] font-mono mb-6">
              &ldquo;By optimizing just 10% of the top 1,000 websites&apos; checkout flows, we could save the equivalent energy of powering <span className="text-[#7ec87e]">10,000 homes</span> for a year.&rdquo;
            </p>
            <p className="text-base text-[#a0a0a0] mb-6">
              We aren&apos;t just cleaning up code. We&apos;re decarbonizing the digital economy.
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-[#7ec87e] font-mono">
              <div className="flex items-center gap-4">
                <span>① &ldquo;Top 1,000 sites serve billions of monthly visits&rdquo; — Semrush, 2026</span>
                <div className="w-px h-4 bg-[#1a2a1a]" />
              </div>
              <div className="flex items-center gap-4">
                <span>② &ldquo;Median page weight: 2.6MB. Optimizations cut 30–60% of that.&rdquo; — HTTP Archive / World Bank-ITU ICT Report, 2024</span>
                <div className="w-px h-4 bg-[#1a2a1a]" />
              </div>
              <div>
                <span>③ &ldquo;Avg. US home uses ~10,500 kWh/year&rdquo; — U.S. Energy Information Administration, 2024</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-[#606060] border-t border-[#1a2a1a]">
        Powered by Browser Use
      </footer>
    </div>
  );
}
