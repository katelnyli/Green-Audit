import type { AuditStatus } from "@/app/types/audit";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function startAudit(
  url: string,
  credentials?: { username: string; password: string }
): Promise<{ audit_id: string }> {
  const res = await fetch(`${BASE}/audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, credentials: credentials ?? null }),
  });
  if (!res.ok) throw new Error(`Failed to start audit: ${res.statusText}`);
  return res.json();
}

export async function getAudit(id: string): Promise<AuditStatus> {
  const res = await fetch(`${BASE}/audit/${id}`);
  if (!res.ok) throw new Error(`Audit not found: ${res.statusText}`);
  return res.json();
}

export function streamAudit(
  id: string,
  onUpdate: (status: AuditStatus) => void,
  onDone: (status: AuditStatus) => void,
  onError: (err: string) => void
): () => void {
  const es = new EventSource(`${BASE}/audit/${id}/stream`);

  es.onmessage = (e) => {
    const data: AuditStatus = JSON.parse(e.data);
    if (data.status === "done") {
      onDone(data);
      es.close();
    } else if (data.status === "error") {
      onError(data.error ?? "Unknown error");
      es.close();
    } else {
      onUpdate(data);
    }
  };

  es.onerror = () => {
    onError("Stream disconnected");
    es.close();
  };

  return () => es.close();
}
