export type Impact = "high" | "medium" | "low";
export type Grade = "A" | "B" | "C" | "D" | "F";
export type AuditPhase =
  | "queued"
  | "crawling"
  | "scoring"
  | "generating_fixes"
  | "done"
  | "error";

export interface ImageResource {
  url: string;
  size_bytes: number;
  format: string;
  has_modern_alternative: boolean;
  flagged: boolean;
}

export interface ScriptResource {
  url: string;
  size_bytes: number;
  render_blocking: boolean;
}

export interface FontResource {
  url: string;
  size_bytes: number;
}

export interface Resources {
  images: ImageResource[];
  scripts: ScriptResource[];
  fonts: FontResource[];
  other: Record<string, unknown>[];
}

export interface LighthouseScores {
  performance: number;
  best_practices: number;
}

export interface Flag {
  type: string;
  detail: string;
  impact: Impact;
}

export interface Page {
  url: string;
  section: string;
  load_time_ms: number;
  transfer_size_bytes: number;
  request_count: number;
  resources: Resources;
  lighthouse: LighthouseScores;
  estimated_co2_grams: number;
  flags: Flag[];
}

export interface SectionSummary {
  section: string;
  co2_grams: number;
  page_count: number;
}

export interface TopFlag {
  type: string;
  occurrences: number;
  impact: Impact;
}

export interface Summary {
  total_pages_crawled: number;
  total_transfer_bytes: number;
  total_estimated_co2_grams: number;
  sections_ranked: SectionSummary[];
  top_flags: TopFlag[];
  grade: Grade;
}

export interface CodeFix {
  flag_type: string;
  page_url: string;
  description: string;
  code_snippet: string;
  estimated_co2_saved: number;
  injection_js: string;
}

export interface AuditResult {
  audit_id: string;
  target_url: string;
  crawled_at: string;
  pages: Page[];
  summary: Summary;
  fixes: CodeFix[];
}

export interface AuditStatus {
  audit_id: string;
  status: AuditPhase;
  progress: number | null;
  total: number | null;
  current_url: string | null;
  live_url: string | null;
  live_urls: string[];
  pages_discovered: string[];
  agent_status: string | null;
  result: AuditResult | null;
  error: string | null;
}
