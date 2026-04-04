'use client';

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Mock data for worst pages
const worstPagesData = [
  { page: '/products/catalog', mb: 8.4 },
  { page: '/dashboard', mb: 6.9 },
  { page: '/media/gallery', mb: 5.7 },
  { page: '/blog/archive', mb: 4.8 },
  { page: '/home', mb: 4.2 },
  { page: '/about/team', mb: 3.9 },
  { page: '/resources', mb: 3.4 },
  { page: '/pricing', mb: 2.8 },
  { page: '/docs', mb: 2.5 },
  { page: '/contact', mb: 2.1 },
];

// Mock actions
const actions = [
  {
    severity: 'high',
    title: 'Convert images to WebP on /products/catalog',
    impact: 'Saves est. 2.3 MB per visit',
    details: '47 unoptimized PNG/JPG images detected'
  },
  {
    severity: 'high',
    title: 'Remove unused JavaScript on /dashboard',
    impact: 'Saves est. 1.8 MB per visit',
    details: '3 large libraries detected with <30% utilization'
  },
  {
    severity: 'medium',
    title: 'Enable text compression across site',
    impact: 'Saves est. 890 KB per visit',
    details: 'CSS and JS files not gzipped'
  },
  {
    severity: 'medium',
    title: 'Lazy-load images on /media/gallery',
    impact: 'Saves est. 1.2 MB initial load',
    details: 'All 34 images load on page render'
  },
  {
    severity: 'low',
    title: 'Reduce third-party requests',
    impact: 'Saves est. 340 KB per visit',
    details: '12 analytics/tracking scripts detected'
  },
];

// Mock per-page data
const pageDetails = [
  { url: '/products/catalog', size: 8.4, images: 47, thirdParty: 8, consoleErrors: 0 },
  { url: '/dashboard', size: 6.9, images: 12, thirdParty: 15, consoleErrors: 3 },
  { url: '/media/gallery', size: 5.7, images: 34, thirdParty: 6, consoleErrors: 0 },
  { url: '/blog/archive', size: 4.8, images: 28, thirdParty: 9, consoleErrors: 1 },
  { url: '/home', size: 4.2, images: 18, thirdParty: 11, consoleErrors: 0 },
  { url: '/about/team', size: 3.9, images: 24, thirdParty: 7, consoleErrors: 0 },
  { url: '/resources', size: 3.4, images: 15, thirdParty: 8, consoleErrors: 2 },
  { url: '/pricing', size: 2.8, images: 9, thirdParty: 10, consoleErrors: 0 },
  { url: '/docs', size: 2.5, images: 6, thirdParty: 5, consoleErrors: 0 },
  { url: '/contact', size: 2.1, images: 4, thirdParty: 12, consoleErrors: 0 },
  { url: '/blog/post-1', size: 1.9, images: 8, thirdParty: 9, consoleErrors: 0 },
  { url: '/blog/post-2', size: 1.7, images: 7, thirdParty: 9, consoleErrors: 1 },
  { url: '/products/widget-a', size: 1.5, images: 5, thirdParty: 8, consoleErrors: 0 },
  { url: '/products/widget-b', size: 1.4, images: 6, thirdParty: 8, consoleErrors: 0 },
  { url: '/docs/getting-started', size: 1.2, images: 3, thirdParty: 5, consoleErrors: 0 },
];

export default function ReportPage() {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const totalPages = pageDetails.length;
  const totalMB = pageDetails.reduce((sum, p) => sum + p.size, 0);
  const totalCO2 = (totalMB * 0.5).toFixed(1); // Rough estimate: 0.5g CO2 per MB

  const toggleRow = (idx: number) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(idx)) {
        newSet.delete(idx);
      } else {
        newSet.add(idx);
      }
      return newSet;
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5]">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="inline-block px-2 py-1 mb-3 text-xs font-mono border border-[#27272a] rounded text-gray-500">
            REPORT
          </div>
          <h1 className="text-3xl font-bold mb-1">Carbon footprint analysis</h1>
          <p className="text-gray-500 text-sm">Site-wide environmental impact assessment</p>
        </div>

        {/* Summary Bar */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          <div className="border border-[#27272a] rounded p-4">
            <div className="text-xs text-gray-500 mb-2">Pages scanned</div>
            <div className="text-3xl font-bold font-mono">{totalPages}</div>
          </div>
          <div className="border border-[#27272a] rounded p-4">
            <div className="text-xs text-gray-500 mb-2">Data transferred</div>
            <div className="text-3xl font-bold font-mono">
              {totalMB.toFixed(1)}<span className="text-lg text-gray-500">MB</span>
            </div>
          </div>
          <div className="border border-[#27272a] rounded p-4">
            <div className="text-xs text-gray-500 mb-2">CO₂ emissions</div>
            <div className="text-3xl font-bold font-mono">
              {totalCO2}<span className="text-lg text-gray-500">g</span>
            </div>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="border border-[#27272a] rounded p-5 mb-10">
          <h2 className="text-base font-semibold mb-5 text-gray-400">Heaviest pages by transfer size</h2>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={worstPagesData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="page"
                angle={-45}
                textAnchor="end"
                height={100}
                tick={{ fill: '#9ca3af', fontSize: 12, fontFamily: 'monospace' }}
                stroke="#27272a"
              />
              <YAxis
                label={{ value: 'MB', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                stroke="#27272a"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '8px',
                  color: '#e5e5e5',
                }}
                formatter={(value: number) => [`${value} MB`, 'Size']}
                labelStyle={{ color: '#10b981', fontFamily: 'monospace' }}
              />
              <Bar dataKey="mb" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Action Items */}
        <div className="border border-[#27272a] rounded p-5 mb-10">
          <h2 className="text-base font-semibold mb-5 text-gray-400">Recommended optimizations</h2>
          <div className="space-y-3">
            {actions.map((action, idx) => (
              <div
                key={idx}
                className="border border-[#27272a] rounded p-4 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border uppercase ${getSeverityColor(
                      action.severity
                    )}`}
                  >
                    {action.severity}
                  </span>
                  <div className="flex-1">
                    <h3 className="font-medium mb-1">{action.title}</h3>
                    <p className="text-[#10b981] mb-1 font-mono text-xs">{action.impact}</p>
                    <p className="text-gray-500 text-xs">{action.details}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Per-Page Drilldown Table */}
        <div className="border border-[#27272a] rounded p-5">
          <h2 className="text-base font-semibold mb-5 text-gray-400">Page-by-page breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#27272a]">
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Page</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Size</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Img</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">3rd</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Err</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody>
                {pageDetails.map((page, idx) => (
                  <>
                    <tr
                      key={idx}
                      className="border-b border-[#27272a] hover:bg-[#18181b]/20 transition-colors"
                    >
                      <td className="py-2 px-3 font-mono">{page.url}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold">
                        {page.size}MB
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-gray-500">{page.images}</td>
                      <td className="py-2 px-3 text-right font-mono text-gray-500">{page.thirdParty}</td>
                      <td
                        className={`py-2 px-3 text-right font-mono ${
                          page.consoleErrors > 0 ? 'text-red-400' : 'text-gray-600'
                        }`}
                      >
                        {page.consoleErrors}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => toggleRow(idx)}
                          className="text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          {expandedRows.has(idx) ? '−' : '+'}
                        </button>
                      </td>
                    </tr>
                    {expandedRows.has(idx) && (
                      <tr key={`${idx}-expanded`} className="border-b border-[#27272a] bg-[#18181b]/10">
                        <td colSpan={6} className="py-3 px-4">
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="text-gray-500">Images:</span>
                              <p className="mt-0.5 text-gray-400">
                                {page.images > 20
                                  ? 'High count — consider lazy loading'
                                  : 'Within normal range'}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">Third-party:</span>
                              <p className="mt-0.5 text-gray-400">
                                {page.thirdParty > 10
                                  ? 'Excessive external requests'
                                  : 'Requests under control'}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">Console:</span>
                              <p className="mt-0.5 text-gray-400">
                                {page.consoleErrors > 0
                                  ? `${page.consoleErrors} error(s) logged`
                                  : 'No errors detected'}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">Score:</span>
                              <p className="mt-0.5 font-mono">
                                {Math.max(20, 100 - Math.floor(page.size * 10))}/100
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-8">
          <a
            href="/"
            className="inline-block text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← New audit
          </a>
        </div>
      </div>
    </div>
  );
}
