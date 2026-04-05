"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { startAudit } from "@/app/lib/api";

// ── Beam config ───────────────────────────────────────────────────────────────
const BEAM_COUNT  = 35;
const BEAM_COLORS: [number, number, number][] = [
  [38, 110, 52],   // forest green
  [24, 95,  82],   // dark teal
  [62, 115, 30],   // olive
];
const NOISE_INTENSITY = 1.75;
const NOISE_SCALE     = 0.2;
const SPEED           = 2;
const BEAM_WIDTH      = 2;

interface Beam {
  x: number;        // 0–1 normalized
  y: number;        // current head (px)
  length: number;   // px
  speed: number;    // px/frame
  color: [number, number, number];
  phase: number;    // noise phase offset
}

function initBeams(w: number, h: number): Beam[] {
  return Array.from({ length: BEAM_COUNT }, (_, i) => {
    const color = BEAM_COLORS[i % BEAM_COLORS.length];
    return {
      x:      i / BEAM_COUNT + 0.5 / BEAM_COUNT,
      y:      -Math.random() * h * 2,
      length: h * (0.2 + Math.random() * 0.5),
      speed:  SPEED * (0.7 + Math.random() * 0.6),
      color,
      phase:  Math.random() * Math.PI * 2,
    };
  });
}

function drawBeams(
  ctx: CanvasRenderingContext2D,
  beams: Beam[],
  w: number,
  h: number,
  t: number,
  alpha: number,
) {
  ctx.clearRect(0, 0, w, h);
  for (const beam of beams) {
    // sinusoidal noise wobble
    const wobble = Math.sin(t * NOISE_SCALE + beam.phase) * NOISE_INTENSITY * (w / BEAM_COUNT) * 1.2;
    const bx = beam.x * w + wobble;

    const grad = ctx.createLinearGradient(bx, beam.y - beam.length, bx, beam.y);
    const [r, g, b] = beam.color;
    grad.addColorStop(0,   `rgba(${r},${g},${b},0)`);
    grad.addColorStop(0.3, `rgba(${r},${g},${b},${alpha * 0.6})`);
    grad.addColorStop(0.7, `rgba(${r},${g},${b},${alpha})`);
    grad.addColorStop(1,   `rgba(${r},${g},${b},${alpha * 0.2})`);

    ctx.fillStyle = grad;
    ctx.fillRect(bx - BEAM_WIDTH / 2, beam.y - beam.length, BEAM_WIDTH, beam.length);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Home() {
  const router   = useRouter();
  const [url, setUrl]           = useState("");
  const [maxPages, setMaxPages] = useState(10);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const glowRef = useRef<HTMLCanvasElement>(null);
  const coreRef = useRef<HTMLCanvasElement>(null);
  const beamsRef = useRef<Beam[]>([]);
  const rafRef   = useRef<number>(0);

  useEffect(() => {
    const glow = glowRef.current;
    const core = coreRef.current;
    if (!glow || !core) return;

    const glowCtx = glow.getContext("2d")!;
    const coreCtx = core.getContext("2d")!;

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      glow.width = core.width = w;
      glow.height = core.height = h;
      beamsRef.current = initBeams(w, h);
    };
    resize();
    window.addEventListener("resize", resize);

    let t = 0;
    const loop = () => {
      t += 0.016;
      const w = glow.width;
      const h = glow.height;

      for (const beam of beamsRef.current) {
        beam.y += beam.speed;
        if (beam.y - beam.length > h) {
          beam.y = -beam.length * 0.1;
        }
      }

      // Glow layer — wide soft aura
      drawBeams(glowCtx, beamsRef.current, w, h, t, 0.85);
      // Core layer — bright spine
      drawBeams(coreCtx, beamsRef.current, w, h, t, 1.0);

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

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

      {/* ── Glow canvas (wide soft aura) ─────────────────────────────────────── */}
      <canvas
        ref={glowRef}
        aria-hidden
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ filter: "blur(62px)", opacity: 0.68, willChange: "transform" }}
      />

      {/* ── Core canvas (bright spine) ────────────────────────────────────────── */}
      <canvas
        ref={coreRef}
        aria-hidden
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ filter: "blur(2.5px)", opacity: 0.38, willChange: "transform" }}
      />

      {/* ── Grain texture overlay ─────────────────────────────────────────────── */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundSize: "180px 180px",
          opacity: 0.038,
        }}
      />

      {/* ── Radial vignette ───────────────────────────────────────────────────── */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, transparent 28%, rgba(3,7,10,0.72) 100%)",
        }}
      />

      {/* ── Content ───────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex flex-col items-center justify-center flex-1 px-6 gap-8">

        {/* Heading */}
        <h1
          className="text-center font-bold tracking-[0.18em] whitespace-nowrap leading-none select-none"
          style={{
            fontFamily: "'Clash Display', sans-serif",
            fontSize: "clamp(1rem, 2.6vw, 1.8rem)",
            color: "#e4f0e4",
            textShadow: "0 0 40px rgba(38,110,52,0.45), 0 0 80px rgba(24,95,82,0.2)",
          }}
        >
          FIND YOUR WEBSITE&apos;S CARBON FOOTPRINT
        </h1>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yourwebsite.com"
            required
            className="w-full px-4 py-3 bg-[#0b1410]/80 border border-[#1e3428] rounded-lg text-[#d8eedd] text-sm placeholder:text-[#3a6048] focus:outline-none focus:border-[#2e5040] transition-colors backdrop-blur-sm"
          />

          <div className="space-y-2">
            <div className="text-xs text-[#4a7860] tracking-widest uppercase">
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
                      ? "bg-[#1a3828] text-[#96c8a0] border-[#2a5040]"
                      : "bg-transparent text-[#4a7060] border-[#182820] hover:border-[#2a4838] hover:text-[#6a9880]"
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
            className="w-full py-3 bg-[#152820]/80 hover:bg-[#1c3830]/80 border border-[#254838] text-[#88c09a] text-sm font-medium rounded-lg transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed backdrop-blur-sm"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border border-[#88c09a] border-t-transparent rounded-full animate-spin" />
                Starting…
              </span>
            ) : (
              "Run Audit"
            )}
          </button>
        </form>
      </main>

      <footer className="relative z-10 py-5 text-center text-[#233828] text-xs tracking-wider">
        Powered by Browser Use
      </footer>
    </div>
  );
}
