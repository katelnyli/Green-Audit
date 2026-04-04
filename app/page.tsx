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
      <div className="max-w-5xl mx-auto px-6 pt-20 pb-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4 tracking-tight">
            Green Audit
          </h1>
          <p className="text-2xl text-gray-400 mb-2">
            Full-site green audits at the click of a button
          </p>
          <p className="text-lg text-gray-500">
            Existing tools only scan single pages. We scan everything.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-[#18181b] border border-[#27272a] rounded-lg p-8 mb-20">
          <div className="mb-6">
            <label htmlFor="url" className="block text-sm font-medium mb-2">
              Website URL
            </label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              required
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#27272a] rounded-md focus:outline-none focus:border-[#10b981] font-mono text-sm"
            />
          </div>

          <div className="mb-6">
            <button
              type="button"
              onClick={() => setShowCredentials(!showCredentials)}
              className="text-sm text-gray-400 hover:text-[#10b981] transition-colors"
            >
              {showCredentials ? '− Hide' : '+ Add'} login credentials (optional)
            </button>

            {showCredentials && (
              <div className="mt-4 space-y-4 pl-4 border-l-2 border-[#27272a]">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#27272a] rounded-md focus:outline-none focus:border-[#10b981] font-mono text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#27272a] rounded-md focus:outline-none focus:border-[#10b981] font-mono text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="mb-8">
            <label htmlFor="pageCap" className="block text-sm font-medium mb-2">
              Page limit: <span className="font-mono text-[#10b981]">{pageCap}</span>
            </label>
            <input
              type="range"
              id="pageCap"
              min="10"
              max="500"
              step="10"
              value={pageCap}
              onChange={(e) => setPageCap(Number(e.target.value))}
              className="w-full h-2 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-[#10b981]"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>10</span>
              <span>500</span>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-[#10b981] hover:bg-[#059669] text-black font-semibold py-4 rounded-md transition-colors text-lg"
          >
            Run Audit
          </button>
        </form>

        {/* How It Works */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-8 text-center">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-[#18181b] border border-[#27272a] rounded-lg flex items-center justify-center mx-auto mb-4 font-mono text-[#10b981] font-bold">
                01
              </div>
              <h3 className="font-semibold mb-2">Enter URL</h3>
              <p className="text-sm text-gray-400">
                Provide your website URL and optional authentication credentials
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-[#18181b] border border-[#27272a] rounded-lg flex items-center justify-center mx-auto mb-4 font-mono text-[#10b981] font-bold">
                02
              </div>
              <h3 className="font-semibold mb-2">Agent crawls</h3>
              <p className="text-sm text-gray-400">
                Our Browser Use agent autonomously navigates your entire site
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-[#18181b] border border-[#27272a] rounded-lg flex items-center justify-center mx-auto mb-4 font-mono text-[#10b981] font-bold">
                03
              </div>
              <h3 className="font-semibold mb-2">Get report</h3>
              <p className="text-sm text-gray-400">
                View detailed sustainability metrics and actionable improvements
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#27272a] py-8 text-center text-sm text-gray-500">
        Built by Team Green Audit
      </footer>
    </div>
  );
}
