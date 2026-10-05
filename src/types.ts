// ─── Shared Types ──────────────────────────────────────────────────────────────

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface Finding {
  category: string;
  check: string;
  status: 'pass' | 'fail' | 'warn' | 'info';
  severity: Severity;
  message: string;
  detail?: string;
  recommendation?: string;
}

// ─── Security ──────────────────────────────────────────────────────────────────

export interface HeaderFinding extends Finding {
  headerName?: string;
  headerValue?: string;
}

export interface TlsFinding extends Finding {}

export interface ExposedFileFinding extends Finding {
  path?: string;
  statusCode?: number;
}

export interface DnsFinding extends Finding {}

export interface SecurityReport {
  target: string;
  timestamp: string;
  headers: HeaderFinding[];
  tls: TlsFinding[];
  exposedFiles: ExposedFileFinding[];
  dns: DnsFinding[];
  summary: {
    total: number;
    pass: number;
    fail: number;
    warn: number;
    byCategory: Record<string, number>;
  };
}

// ─── Load Testing ──────────────────────────────────────────────────────────────

export type LoadTestType = 'rampup' | 'spike' | 'soak';

export interface LoadTestConfig {
  url: string;
  type: LoadTestType;
  maxRps: number;
  // rampup
  startVus?: number;
  endVus?: number;
  duration?: string;
  // spike
  spikeVus?: number;
  spikeDuration?: string;
  // soak
  soakVus?: number;
  soakDuration?: string;
}

export interface LoadTestMetrics {
  type: LoadTestType;
  timestamp: string;
  duration: number; // ms
  totalRequests: number;
  requestsPerSec: number;
  errorRate: number; // 0–1
  latency: {
    p50: number;
    p75: number;
    p95: number;
    p99: number;
    mean: number;
    max: number;
  };
  ttfb?: number; // not always available
  statusCodes: Record<string, number>;
  errors: string[];
}

// ─── Lighthouse / Performance ───────────────────────────────────────────────────

export interface LighthouseScores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
}

export interface LighthouseReport {
  timestamp: string;
  url: string;
  scores: LighthouseScores;
  opportunities: Array<{
    id: string;
    title: string;
    description: string;
    savings?: string;
  }>;
  diagnostics: Array<{
    id: string;
    title: string;
    description: string;
  }>;
  rawPath?: string;
}

// ─── Combined Report ───────────────────────────────────────────────────────────

export interface CombinedReport {
  meta: {
    tool: string;
    version: string;
    target: string;
    runId: string;
    timestamp: string;
    durationMs: number;
  };
  security?: SecurityReport;
  loadTests?: LoadTestMetrics[];
  lighthouse?: LighthouseReport;
}
