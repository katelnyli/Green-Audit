"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startAudit } from "@/app/lib/api";

export default function AuditForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [showCreds, setShowCreds] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const creds = showCreds && username ? { username, password } : undefined;
      const { audit_id } = await startAudit(url, creds);
      router.push(`/audit/${audit_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start audit");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl space-y-4">
      <div className="flex gap-2">
        <input
          type="url"
          required
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-green-900 disabled:text-green-700 px-6 py-3 font-semibold text-white transition-colors"
        >
          {loading ? "Starting…" : "Audit Site"}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setShowCreds((v) => !v)}
        className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        {showCreds ? "▲ Hide login" : "▼ Site requires login?"}
      </button>

      {showCreds && (
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-green-600"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-green-600"
          />
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
    </form>
  );
}
