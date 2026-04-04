'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [showCredentials, setShowCredentials] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pageCap, setPageCap] = useState(50);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: wire up backend - send audit request with url, credentials, pageCap
    router.push('/progress');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5]">
      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-6 pt-16 pb-12">
        <div className="mb-12">
          <div className="inline-block px-3 py-1 mb-6 text-xs font-mono border border-[#27272a] rounded text-gray-400">
            SUSTAINABILITY AUDIT TOOL
          </div>
          <h1 className="text-6xl font-bold mb-6 tracking-tight leading-tight">
            Measure the carbon<br/>cost of your website
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl">
            Every page load burns energy. Every image transferred emits CO₂.
            Most audit tools only check your homepage—we crawl your entire site
            to show you the real environmental impact.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="border border-[#27272a] rounded p-6 mb-16">
          <div className="mb-5">
            <label htmlFor="url" className="block text-sm mb-2 text-gray-400">
              Target URL
            </label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              required
              className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#27272a] rounded focus:outline-none focus:border-[#10b981] font-mono text-sm"
            />
          </div>

          <div className="mb-5">
            <button
              type="button"
              onClick={() => setShowCredentials(!showCredentials)}
              className="text-sm text-gray-500 hover:text-gray-300"
            >
              {showCredentials ? '−' : '+'} Authentication {!showCredentials && '(optional)'}
            </button>

            {showCredentials && (
              <div className="mt-3 space-y-3 pl-3 border-l border-[#27272a]">
                <div>
                  <input
                    type="text"
                    id="username"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#27272a] rounded focus:outline-none focus:border-[#10b981] font-mono text-sm"
                  />
                </div>
                <div>
                  <input
                    type="password"
                    id="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#27272a] rounded focus:outline-none focus:border-[#10b981] font-mono text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <label htmlFor="pageCap" className="text-gray-400">
                Page limit
              </label>
              <span className="font-mono text-[#10b981]">{pageCap}</span>
            </div>
            <input
              type="range"
              id="pageCap"
              min="10"
              max="500"
              step="10"
              value={pageCap}
              onChange={(e) => setPageCap(Number(e.target.value))}
              className="w-full h-1 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-[#10b981]"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>10</span>
              <span>500</span>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-[#10b981] hover:bg-[#059669] text-black font-semibold py-3 rounded transition-colors"
          >
            Start audit
          </button>
        </form>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 mb-16 text-center">
          <div className="border-l border-[#27272a] pl-4">
            <div className="text-sm text-gray-500 mb-1">Avg website emits</div>
            <div className="text-2xl font-bold font-mono">1.76g</div>
            <div className="text-xs text-gray-600">CO₂ per page view</div>
          </div>
          <div className="border-l border-[#27272a] pl-4">
            <div className="text-sm text-gray-500 mb-1">Most sites transfer</div>
            <div className="text-2xl font-bold font-mono">2.2MB</div>
            <div className="text-xs text-gray-600">per page load</div>
          </div>
          <div className="border-l border-[#27272a] pl-4">
            <div className="text-sm text-gray-500 mb-1">Digital carbon is</div>
            <div className="text-2xl font-bold font-mono">3.7%</div>
            <div className="text-xs text-gray-600">of global emissions</div>
          </div>
        </div>

        {/* Why this matters */}
        <div className="border-t border-[#27272a] pt-12">
          <h2 className="text-sm font-mono text-gray-500 mb-6">Why full-site audits matter</h2>
          <div className="space-y-4 text-gray-400">
            <p>
              Single-page audits miss 90% of your carbon footprint. Your product pages, docs, blog posts—they all transfer data, consume energy, and emit CO₂.
            </p>
            <p>
              We use Browser Use agents to crawl every accessible page on your site, measuring real data transfer and computing the actual environmental cost.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#27272a] py-6 text-center text-sm text-gray-600">
        <div className="max-w-4xl mx-auto px-6">
          Built for the sustainability track
        </div>
      </footer>
    </div>
  );
}
