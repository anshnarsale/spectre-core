import { request as undiciRequest } from 'undici';
import { LoadTestConfig, LoadTestMetrics, LoadTestType } from '../types';
import { logger } from '../utils/logger';
import chalk from 'chalk';

// ── Kill switch ───────────────────────────────────────────────────────────────
let _running = false;
let _interruptCallback: (() => void) | null = null;

export function onInterrupt(cb: () => void): void {
  _interruptCallback = cb;
}

export function stopLoadTest(): void {
  if (_running) {
    logger.warn('\nKill switch triggered — stopping load test...');
    _running = false;
  }
}

process.on('SIGINT', () => {
  if (_running) {
    stopLoadTest();
    if (_interruptCallback) {
      try { _interruptCallback(); } catch { /* ignore */ }
    }
    process.stderr.write(chalk.yellow('\nLoad test stopped by user (Ctrl+C). Partial results saved.\n'));
    process.exit(0);
  }
});

// ── Duration parsing ──────────────────────────────────────────────────────────
export function parseDuration(dur: string): number {
  const match = dur.match(/^(\d+)(s|m|h)?$/i);
  if (!match) throw new Error(`Invalid duration: "${dur}" — use e.g. 30s, 5m, 1h`);
  const value = parseInt(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();
  if (unit === 'h') return value * 3600;
  if (unit === 'm') return value * 60;
  return value;
}

// ── Histogram (HDR-style percentiles from raw samples) ────────────────────────
class LatencyHistogram {
  private samples: number[] = [];

  record(ms: number): void { this.samples.push(ms); }

  get count(): number { return this.samples.length; }

  percentile(p: number): number {
    if (this.samples.length === 0) return 0;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
    return Math.round(sorted[idx]);
  }

  get mean(): number {
    if (this.samples.length === 0) return 0;
    return Math.round(this.samples.reduce((a, b) => a + b, 0) / this.samples.length);
  }

  get max(): number {
    return this.samples.length === 0 ? 0 : Math.max(...this.samples);
  }
}

// ── RPS enforcement ───────────────────────────────────────────────────────────
function cappedConnections(requested: number, maxRps: number): number {
  // Conservative: 1 VU ≈ 1 RPS at ~500ms latency to Netlify
  const maxConnections = maxRps;
  if (requested > maxConnections) {
    logger.warn(`VUs capped: ${requested} → ${maxConnections} to honour --max-rps ${maxRps}`);
    return maxConnections;
  }
  return requested;
}

// ── Progress ticker ───────────────────────────────────────────────────────────
function startTicker(label: string, totalSec: number): NodeJS.Timeout {
  let elapsed = 0;
  const tick = setInterval(() => {
    elapsed++;
    const pct = Math.min(100, Math.round((elapsed / totalSec) * 100));
    const filled = Math.floor(pct / 5);
    const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
    process.stdout.write(
      `\r  ${chalk.cyan(label)} [${chalk.green(bar)}] ${String(pct).padStart(3)}% (${elapsed}/${totalSec}s)`
    );
    if (elapsed >= totalSec) clearInterval(tick);
  }, 1000);
  return tick;
}

// ── Core load runner ──────────────────────────────────────────────────────────
interface RunResult {
  totalRequests: number;
  successRequests: number;
  errors: number;
  statusCodes: Record<string, number>;
  histogram: LatencyHistogram;
  durationMs: number;
}

/**
 * Runs `concurrency` parallel workers for `durationSec` seconds.
 * Each worker fires requests sequentially (no pipelining).
 * RPS is naturally capped by: concurrency / avg_latency_seconds.
 */
async function runWorkers(
  url: string,
  concurrency: number,
  durationSec: number,
  requestTimeout = 10_000
): Promise<RunResult> {
  _running = true;
  const deadline = Date.now() + durationSec * 1000;
  const hist = new LatencyHistogram();
  const statusCodes: Record<string, number> = {};
  let totalRequests = 0;
  let successRequests = 0;
  let errors = 0;

  // Each worker is an async loop that fires requests until deadline
  async function worker(): Promise<void> {
    while (_running && Date.now() < deadline) {
      const t0 = Date.now();
      try {
        const resp = await undiciRequest(url, {
          method: 'GET',
          headers: {
            'user-agent': 'site-auditor-loadtest/1.0',
            'accept': 'text/html,*/*',
          },
          signal: AbortSignal.timeout(requestTimeout),
        });
        // Drain body to free socket
        for await (const _ of resp.body) { /* noop */ }

        const latency = Date.now() - t0;
        hist.record(latency);
        totalRequests++;

        const bucket = resp.statusCode >= 200 && resp.statusCode < 300 ? '2xx'
          : resp.statusCode >= 300 && resp.statusCode < 400 ? '3xx'
          : resp.statusCode >= 400 && resp.statusCode < 500 ? '4xx'
          : resp.statusCode >= 500 ? '5xx' : 'other';
        statusCodes[bucket] = (statusCodes[bucket] ?? 0) + 1;

        if (resp.statusCode >= 200 && resp.statusCode < 400) successRequests++;
      } catch {
        errors++;
        totalRequests++;
        statusCodes['error'] = (statusCodes['error'] ?? 0) + 1;
      }
    }
  }

  const wallStart = Date.now();
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  _running = false;

  return {
    totalRequests,
    successRequests,
    errors,
    statusCodes,
    histogram: hist,
    durationMs: Date.now() - wallStart,
  };
}

// ── Metrics builder ───────────────────────────────────────────────────────────
function buildMetrics(r: RunResult, type: LoadTestType): LoadTestMetrics {
  const durationSec = r.durationMs / 1000;
  const errorRate = r.totalRequests > 0 ? r.errors / r.totalRequests : 0;
  return {
    type,
    timestamp: new Date().toISOString(),
    duration: r.durationMs,
    totalRequests: r.totalRequests,
    requestsPerSec: durationSec > 0 ? Math.round((r.totalRequests / durationSec) * 10) / 10 : 0,
    errorRate,
    latency: {
      p50:  r.histogram.percentile(50),
      p75:  r.histogram.percentile(75),
      p95:  r.histogram.percentile(95),
      p99:  r.histogram.percentile(99),
      mean: r.histogram.mean,
      max:  r.histogram.max,
    },
    statusCodes: r.statusCodes,
    errors: [],
  };
}

// ── Results printer ───────────────────────────────────────────────────────────
export function printMetrics(metrics: LoadTestMetrics): void {
  const { latency, errorRate, requestsPerSec, totalRequests, statusCodes } = metrics;
  const errPct = (errorRate * 100).toFixed(2);
  const errColor = errorRate > 0.05 ? chalk.red : errorRate > 0.01 ? chalk.yellow : chalk.green;

  logger.section('Load Test Results');
  console.log(`  Type:           ${chalk.bold(metrics.type.toUpperCase())}`);
  console.log(`  Total Requests: ${totalRequests.toLocaleString()}`);
  console.log(`  Req/sec:        ${chalk.bold(requestsPerSec.toFixed(1))}`);
  console.log(`  Error Rate:     ${errColor(errPct + '%')}`);
  const codes = Object.entries(statusCodes).map(([k, v]) => `${k}:${v}`).join('  ');
  console.log(`  Status Codes:   ${codes || '—'}`);
  console.log();
  console.log(`  Latency (ms):`);
  console.log(`    p50  ${chalk.green(String(latency.p50))}`);
  console.log(`    p75  ${chalk.green(String(latency.p75))}`);
  console.log(`    p95  ${chalk.yellow(String(latency.p95))}`);
  console.log(`    p99  ${chalk.red(String(latency.p99))}`);
  console.log(`    mean ${latency.mean}  max ${latency.max}`);
}

// ── Ramp-up ───────────────────────────────────────────────────────────────────
export async function runRampUpTest(config: LoadTestConfig): Promise<LoadTestMetrics> {
  logger.banner('Ramp-up Load Test');
  const startVus  = config.startVus ?? 10;
  const endVus    = cappedConnections(config.endVus ?? 200, config.maxRps);
  const totalSec  = parseDuration(config.duration ?? '2m');

  logger.info(`Ramp: ${startVus} → ${endVus} VUs over ${totalSec}s  |  max ${config.maxRps} RPS`);
  logger.info('Press Ctrl+C at any time to stop and save partial results.\n');

  const phases   = 4;
  const phaseLen = Math.max(15, Math.floor(totalSec / phases));
  const step     = Math.max(1, Math.floor((endVus - startVus) / (phases - 1)));

  const allMetrics: LoadTestMetrics[] = [];

  for (let p = 0; p < phases && _running !== false; p++) {
    const vus   = Math.min(endVus, startVus + step * p);
    const label = `Phase ${p + 1}/${phases} (${vus} VUs)`;
    logger.step(`${label} — ${phaseLen}s`);
    process.stdout.write('\n');

    const ticker = startTicker(label, phaseLen);
    let r: RunResult;
    try {
      r = await runWorkers(config.url, vus, phaseLen);
    } finally {
      clearInterval(ticker);
      process.stdout.write('\n');
    }

    const m = buildMetrics(r, 'rampup');
    allMetrics.push(m);
    console.log(chalk.dim(
      `  → ${m.totalRequests.toLocaleString()} reqs  ` +
      `${m.requestsPerSec.toFixed(1)} rps  ` +
      `p99=${m.latency.p99}ms  ` +
      `err=${(m.errorRate * 100).toFixed(1)}%`
    ));
  }

  const active = allMetrics.filter((m) => m.totalRequests > 0);
  const base   = active.length > 0 ? active[active.length - 1] : allMetrics[allMetrics.length - 1];
  const final  = { ...base };
  if (active.length > 0) {
    final.totalRequests  = active.reduce((s, m) => s + m.totalRequests, 0);
    final.requestsPerSec = active.reduce((s, m) => s + m.requestsPerSec, 0) / active.length;
    final.errorRate      = active.reduce((s, m) => s + m.errorRate, 0) / active.length;
    final.latency = {
      p50:  Math.max(...active.map((m) => m.latency.p50)),
      p75:  Math.max(...active.map((m) => m.latency.p75)),
      p95:  Math.max(...active.map((m) => m.latency.p95)),
      p99:  Math.max(...active.map((m) => m.latency.p99)),
      mean: Math.round(active.reduce((s, m) => s + m.latency.mean, 0) / active.length),
      max:  Math.max(...active.map((m) => m.latency.max)),
    };
  }

  printMetrics(final);
  return final;
}

// ── Spike ─────────────────────────────────────────────────────────────────────
export async function runSpikeTest(config: LoadTestConfig): Promise<LoadTestMetrics> {
  logger.banner('Spike Load Test');
  const vus      = cappedConnections(config.spikeVus ?? 150, config.maxRps);
  const duration = parseDuration(config.spikeDuration ?? '30s');

  logger.info(`Spike: ${vus} VUs for ${duration}s  |  max ${config.maxRps} RPS`);
  logger.info('Press Ctrl+C at any time to stop and save partial results.\n');
  process.stdout.write('\n');

  const ticker = startTicker(`Spike (${vus} VUs)`, duration);
  let r: RunResult;
  try {
    r = await runWorkers(config.url, vus, duration);
  } finally {
    clearInterval(ticker);
    process.stdout.write('\n');
  }

  const metrics = buildMetrics(r, 'spike');
  printMetrics(metrics);
  return metrics;
}

// ── Soak ──────────────────────────────────────────────────────────────────────
export async function runSoakTest(config: LoadTestConfig): Promise<LoadTestMetrics> {
  logger.banner('Soak Load Test');
  const vus      = cappedConnections(config.soakVus ?? 50, config.maxRps);
  const duration = parseDuration(config.soakDuration ?? '15m');
  const mins     = (duration / 60).toFixed(1);

  logger.info(`Soak: ${vus} VUs for ${mins} min  |  max ${config.maxRps} RPS`);
  logger.warn(`This will run for ${mins} minutes. Press Ctrl+C to stop early and save results.\n`);
  process.stdout.write('\n');

  const ticker = startTicker(`Soak (${vus} VUs)`, duration);
  let r: RunResult;
  try {
    r = await runWorkers(config.url, vus, duration);
  } finally {
    clearInterval(ticker);
    process.stdout.write('\n');
  }

  const metrics = buildMetrics(r, 'soak');
  printMetrics(metrics);
  return metrics;
}
