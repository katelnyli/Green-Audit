"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startAudit } from "@/app/lib/api";

// ── Beam config (matches React Bits reference settings) ───────────────────────
const BEAM_COUNT      = 35;
const BEAM_HEIGHT_PCT = 0.30;   // 30 % of viewport height
const BEAM_WIDTH_MUL  = 2;      // beam width = slot_width × this
const SPEED           = 2;      // px / frame  (~120 px/s at 60 fps)
const NOISE_INTENSITY = 1.75;   // x-displacement in slot-width units
const NOISE_SCALE     = 0.2;    // oscillation frequency

function BeamsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0, H = 0;

    const resize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Golden-ratio stagger so beams start spread evenly across the viewport
    const slot = W / BEAM_COUNT;
    const beams = Array.from({ length: BEAM_COUNT }, (_, i) => ({
      x:     i * slot + slot * 0.5,
      y:     ((i * 0.618033988) % 1) * H,
      phase: i * 1.2345,
    }));

    let t = 0;
    let raf: number;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      const bh = H * BEAM_HEIGHT_PCT;
      const bw = slot * BEAM_WIDTH_MUL;

      for (const b of beams) {
        b.y += SPEED;
        if (b.y > H + bh) b.y = -bh;

        // Sinusoidal noise on x — gives the organic wobble
        const nx = Math.sin(t * NOISE_SCALE * 0.015 + b.phase) * NOISE_INTENSITY * slot;
        const bx = b.x + nx;

        // Vertical soft-edge gradient in muted dark green
        const g = ctx.createLinearGradient(0, b.y, 0, b.y + bh);
        g.addColorStop(0,    "rgba(32, 75, 42, 0)");
        g.addColorStop(0.25, "rgba(44,105, 54, 0.65)");
        g.addColorStop(0.5,  "rgba(54,125, 65, 0.92)");
        g.addColorStop(0.75, "rgba(44,105, 54, 0.65)");
        g.addColorStop(1,    "rgba(32, 75, 42, 0)");

        ctx.fillStyle = g;
        ctx.fillRect(bx - bw * 0.5, b.y, bw, bh);
      }

      t++;
      raf = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // CSS blur spreads each narrow canvas beam into a wide soft column.
  // willChange: transform keeps the canvas on its own GPU layer.
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ filter: "blur(55px)", opacity: 0.75, willChange: "transform" }}
    />
  );
}

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
      <BeamsBackground />

      <main className="relative z-10 flex flex-col items-center justify-center flex-1 px-6 gap-10">

        {/* Heading — single line, no wrap */}
        <p className="whitespace-nowrap text-xl font-bold uppercase tracking-widest text-[#c8dcc8]">
          Find your website&apos;s carbon footprint
        </p>

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
