import AuditForm from "@/app/components/AuditForm";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="mb-10 text-center">
        <span className="inline-block mb-4 text-4xl">🌿</span>
        <h1 className="text-4xl font-bold tracking-tight text-white mb-3">Green Audit</h1>
        <p className="text-zinc-400 max-w-md text-lg leading-relaxed">
          Full-site sustainability auditing. Point it at any URL — we crawl every page,
          score each one, and generate specific code fixes to reduce your carbon footprint.
        </p>
      </div>
      <AuditForm />
      <p className="mt-8 text-zinc-600 text-sm">
        Unlike single-page tools, Green Audit traverses your entire site automatically.
      </p>
    </main>
  );
}
