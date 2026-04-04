'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type LogEntry = {
  url: string;
  status: 'scanning' | 'done' | 'error';
  timestamp: Date;
};

const mockUrls = [
  'https://example.com',
  'https://example.com/about',
  'https://example.com/products',
  'https://example.com/products/widget-a',
  'https://example.com/products/widget-b',
  'https://example.com/blog',
  'https://example.com/blog/post-1',
  'https://example.com/blog/post-2',
  'https://example.com/contact',
  'https://example.com/pricing',
  'https://example.com/docs',
  'https://example.com/docs/getting-started',
];

export default function ProgressPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pagesScanned, setPagesScanned] = useState(0);
  const [dataTransferred, setDataTransferred] = useState(0);
  const [estimatedCO2, setEstimatedCO2] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // TODO: replace with real SSE stream from backend
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex >= mockUrls.length) {
        setIsComplete(true);
        clearInterval(interval);
        // Mark last scanning entry as done
        setLogs((prev) =>
          prev.map((log, idx) =>
            idx === prev.length - 1 && log.status === 'scanning'
              ? { ...log, status: 'done' }
              : log
          )
        );
        return;
      }

      const url = mockUrls[currentIndex];
      const status = Math.random() > 0.9 ? 'error' : 'scanning';

      setLogs((prev) => {
        const newLogs = [...prev];
        // Mark previous scanning as done
        if (newLogs.length > 0 && newLogs[newLogs.length - 1].status === 'scanning') {
          newLogs[newLogs.length - 1].status = 'done';
        }
        return [...newLogs, { url, status, timestamp: new Date() }];
      });

      if (status !== 'error') {
        setPagesScanned((prev) => prev + 1);
        setDataTransferred((prev) => prev + Math.random() * 2 + 0.5);
        setEstimatedCO2((prev) => prev + Math.random() * 0.8 + 0.2);
      }

      currentIndex++;
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: LogEntry['status']) => {
    switch (status) {
      case 'scanning':
        return 'text-yellow-400';
      case 'done':
        return 'text-[#10b981]';
      case 'error':
        return 'text-red-400';
    }
  };

  const getStatusLabel = (status: LogEntry['status']) => {
    switch (status) {
      case 'scanning':
        return 'SCANNING';
      case 'done':
        return 'DONE';
      case 'error':
        return 'ERROR';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5]">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="inline-block px-2 py-1 mb-3 text-xs font-mono border border-[#27272a] rounded text-gray-500">
            CRAWLING
          </div>
          <h1 className="text-3xl font-bold mb-1">Audit in progress</h1>
          <p className="text-gray-500 text-sm">Measuring carbon cost across your site</p>
        </div>

        {/* Counters */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="border border-[#27272a] rounded p-4">
            <div className="text-xs text-gray-500 mb-2">Pages scanned</div>
            <div className="text-3xl font-bold font-mono">{pagesScanned}</div>
          </div>
          <div className="border border-[#27272a] rounded p-4">
            <div className="text-xs text-gray-500 mb-2">Data transferred</div>
            <div className="text-3xl font-bold font-mono">
              {dataTransferred.toFixed(1)}<span className="text-lg text-gray-500">MB</span>
            </div>
          </div>
          <div className="border border-[#27272a] rounded p-4">
            <div className="text-xs text-gray-500 mb-2">CO₂ emitted</div>
            <div className="text-3xl font-bold font-mono">
              {estimatedCO2.toFixed(1)}<span className="text-lg text-gray-500">g</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Panel: Live Log */}
          <div className="border border-[#27272a] rounded p-4 h-[600px] flex flex-col">
            <div className="flex items-center gap-2 mb-4 text-sm">
              <span className="inline-block w-1.5 h-1.5 bg-[#10b981] rounded-full animate-pulse"></span>
              <span className="text-gray-500">Activity log</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 font-mono text-xs">
              {logs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2 py-0.5">
                  <span className="text-gray-600 text-[10px] mt-0.5">
                    {log.timestamp.toLocaleTimeString()}
                  </span>
                  <span className={`${getStatusColor(log.status)} min-w-[60px] text-[10px]`}>
                    {getStatusLabel(log.status)}
                  </span>
                  <span className="text-gray-400 break-all">{log.url}</span>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-gray-600 text-center py-8">Starting crawler...</div>
              )}
            </div>
          </div>

          {/* Right Panel: Browser Preview */}
          <div className="border border-[#27272a] rounded p-4 h-[600px] flex flex-col">
            <div className="text-sm text-gray-500 mb-4">Browser preview</div>
            <div className="flex-1 bg-[#0a0a0a] border border-[#27272a] rounded flex items-center justify-center relative overflow-hidden">
              {/* TODO: replace with iframe pointing to Browser Use live_url */}
              <div className="text-center">
                <div className="w-12 h-12 border-2 border-[#27272a] border-t-[#10b981] rounded-full animate-spin mb-3 mx-auto"></div>
                <p className="text-gray-500 text-sm">Agent navigating site</p>
              </div>

              {/* Animated grid background */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0" style={{
                  backgroundImage: 'linear-gradient(#10b981 1px, transparent 1px), linear-gradient(90deg, #10b981 1px, transparent 1px)',
                  backgroundSize: '50px 50px',
                  animation: 'slide 20s linear infinite'
                }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Complete State */}
        {isComplete && (
          <div className="mt-8 border border-[#10b981] rounded p-6">
            <div className="text-3xl mb-3">✓</div>
            <h2 className="text-xl font-bold mb-2">Crawl complete</h2>
            <p className="text-gray-500 text-sm mb-6">
              {pagesScanned} pages • {dataTransferred.toFixed(1)}MB • {estimatedCO2.toFixed(1)}g CO₂
            </p>
            <button
              onClick={() => router.push('/report')}
              className="bg-[#10b981] hover:bg-[#059669] text-black font-semibold px-6 py-2 rounded transition-colors"
            >
              View report
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slide {
          0% {
            transform: translate(0, 0);
          }
          100% {
            transform: translate(50px, 50px);
          }
        }
      `}</style>
    </div>
  );
}
