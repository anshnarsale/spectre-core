#!/usr/bin/env ts-node
import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { CombinedReport, LoadTestConfig, LoadTestMetrics } from './types';
import { logger } from './utils/logger';
import { runSecurityAudit } from './modules/security-audit';
import { runLighthouse } from './modules/lighthouse';
import { runRampUpTest, runSpikeTest, runSoakTest, onInterrupt, printMetrics } from './modules/load-test';
import { generateHtmlReport, generateJsonReport } from './report/generator';

const VERSION   = '1.0.0';
const TOOL_NAME = 'spectre-core';
const DEFAULT_TARGET  = 'https://example.com';
const DEFAULT_MAX_RPS = 100;

// ── Report folder setup ───────────────────────────────────────────────────────
function createRunDir(): { runId: string; dir: string } {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = path.join(process.cwd(), 'reports', ts);
  fs.mkdirSync(dir, { recursive: true });
  return { runId: ts, dir };
}

function saveReport(report: CombinedReport, dir: string): { htmlPath: string; jsonPath: string } {
  const htmlPath = path.join(dir, 'report.html');
  const jsonPath = path.join(dir, 'report.json');
  generateHtmlReport(report, htmlPath);
  generateJsonReport(report, jsonPath);
  return { htmlPath, jsonPath };
}

/** Shared options added to every subcommand so they work wherever the user places them */
function addSharedOpts(cmd: Command): Command {
  return cmd
    .option('--target <url>',      'Target URL',                 DEFAULT_TARGET)
    .option('--max-rps <number>',  'Global RPS safety cap',      String(DEFAULT_MAX_RPS))
    .option('--verbose',           'Verbose output');
}

function resolveShared(opts: Record<string, unknown>): {
  target: string;
  maxRps: number;
} {
  const target = (opts['target'] as string | undefined) ?? DEFAULT_TARGET;
  const maxRps = parseInt((opts['maxRps'] as string | undefined) ?? String(DEFAULT_MAX_RPS)) || DEFAULT_MAX_RPS;
  if (opts['verbose']) process.env['VERBOSE'] = '1';
  return { target, maxRps };
}

// ── CLI ───────────────────────────────────────────────────────────────────────
const program = new Command();

program
  .name('tool')
  .description('Local load-testing and security-audit tool')
  .version(VERSION)
  // Note: --target / --max-rps / --verbose are declared on each subcommand
  // via addSharedOpts() to prevent Commander consuming them at the parent level.
  .passThroughOptions(false);

// ── security ──────────────────────────────────────────────────────────────────
addSharedOpts(
  program
    .command('security')
    .description('Run the full security audit (headers, TLS, exposed files, DNS)')
).action(async (opts: Record<string, unknown>) => {
  const { target, maxRps } = resolveShared(opts);

  logger.banner(`${TOOL_NAME} v${VERSION}`);
  logger.info(`Target: ${chalk.bold(target)}  |  Max RPS: ${maxRps}`);

  const { runId, dir } = createRunDir();
  const startTime = Date.now();

  try {
    const security = await runSecurityAudit(target);
    const report: CombinedReport = {
      meta: { tool: TOOL_NAME, version: VERSION, target, runId, timestamp: new Date().toISOString(), durationMs: Date.now() - startTime },
      security,
    };
    const { htmlPath, jsonPath } = saveReport(report, dir);
    logger.success(`\nReports saved to: ${chalk.cyan(dir)}`);
    logger.success(`  HTML: ${htmlPath}`);
    logger.success(`  JSON: ${jsonPath}`);
  } catch (err) {
    logger.error(`Security audit failed: ${(err as Error).message}`);
    process.exit(1);
  }
});

// ── load ──────────────────────────────────────────────────────────────────────
addSharedOpts(
  program
    .command('load')
    .description('Run a load test (rampup | spike | soak)')
    .option('--type <type>',            'Test type: rampup | spike | soak',  'rampup')
    .option('--vus <number>',           'Virtual users (end VUs for rampup)', '50')
    .option('--start-vus <number>',     'Starting VUs (rampup only)',         '10')
    .option('--duration <string>',      'Duration — e.g. 30s, 5m, 1h',       '2m')
    .option('--spike-vus <number>',     'VUs for spike test',                 '150')
    .option('--spike-duration <string>','Duration of spike burst',            '30s')
    .option('--soak-vus <number>',      'VUs for soak test',                  '50')
    .option('--soak-duration <string>', 'Duration of soak test',              '15m')
).action(async (opts: Record<string, unknown>) => {
  const { target, maxRps } = resolveShared(opts);
  const type = (opts['type'] as 'rampup' | 'spike' | 'soak') ?? 'rampup';

  logger.banner(`${TOOL_NAME} v${VERSION} — Load Testing`);
  logger.warn('⚠ Authorized for use only against sites you own/control.');
  logger.info(`Target: ${chalk.bold(target)}  |  Max RPS: ${chalk.bold(String(maxRps))}`);

  const { runId, dir } = createRunDir();
  const startTime = Date.now();

  // Partial-report callback — fires if user presses Ctrl+C mid-test
  let partialMetrics: LoadTestMetrics | null = null;
  onInterrupt(() => {
    if (partialMetrics) {
      const report: CombinedReport = {
        meta: { tool: TOOL_NAME, version: VERSION, target, runId: runId + '-partial', timestamp: new Date().toISOString(), durationMs: Date.now() - startTime },
        loadTests: [partialMetrics],
      };
      const { htmlPath, jsonPath } = saveReport(report, dir);
      process.stderr.write(chalk.yellow(`\nPartial report saved:\n  HTML: ${htmlPath}\n  JSON: ${jsonPath}\n`));
    }
  });

  const config: LoadTestConfig = {
    url: target,
    type,
    maxRps,
    startVus:      parseInt(opts['startVus'] as string) || 10,
    endVus:        parseInt(opts['vus'] as string)      || 50,
    duration:      (opts['duration'] as string)         || '2m',
    spikeVus:      parseInt(opts['spikeVus'] as string) || 150,
    spikeDuration: (opts['spikeDuration'] as string)    || '30s',
    soakVus:       parseInt(opts['soakVus'] as string)  || 50,
    soakDuration:  (opts['soakDuration'] as string)     || '15m',
  };

  try {
    let metrics: LoadTestMetrics;
    switch (type) {
      case 'spike': metrics = await runSpikeTest(config); break;
      case 'soak':  metrics = await runSoakTest(config);  break;
      default:      metrics = await runRampUpTest(config);
    }
    partialMetrics = metrics; // so interrupt handler can reference it too

    const report: CombinedReport = {
      meta: { tool: TOOL_NAME, version: VERSION, target, runId, timestamp: new Date().toISOString(), durationMs: Date.now() - startTime },
      loadTests: [metrics],
    };
    const { htmlPath, jsonPath } = saveReport(report, dir);
    logger.success(`\nReports saved to: ${chalk.cyan(dir)}`);
    logger.success(`  HTML: ${htmlPath}`);
    logger.success(`  JSON: ${jsonPath}`);
  } catch (err) {
    const msg = (err as Error).message;
    // autocannon may reject with an empty error when stopped — not a real failure
    if (msg && !msg.includes('autocannon')) {
      logger.error(`Load test failed: ${msg}`);
    }
    process.exit(partialMetrics ? 0 : 1);
  }
});

// ── audit ─────────────────────────────────────────────────────────────────────
addSharedOpts(
  program
    .command('audit')
    .description('Full audit: security + Lighthouse + load test')
    .option('--skip-load',          'Skip load tests')
    .option('--skip-lighthouse',    'Skip Lighthouse/performance audit')
    .option('--load-type <type>',   'Load test type: rampup | spike | soak', 'rampup')
    .option('--vus <number>',       'VUs for load test',                      '30')
    .option('--duration <string>',  'Load test duration',                     '1m')
).action(async (opts: Record<string, unknown>) => {
  const { target, maxRps } = resolveShared(opts);

  logger.banner(`${TOOL_NAME} v${VERSION} — Full Audit`);
  logger.warn(`⚠ Authorized use only. Target: ${chalk.bold(target)}`);
  logger.info(`Max RPS cap: ${maxRps}\n`);

  const { runId, dir } = createRunDir();
  const startTime = Date.now();

  const report: CombinedReport = {
    meta: { tool: TOOL_NAME, version: VERSION, target, runId, timestamp: new Date().toISOString(), durationMs: 0 },
  };

  // Register interrupt handler — saves whatever we have so far
  onInterrupt(() => {
    report.meta.durationMs = Date.now() - startTime;
    try {
      const { htmlPath, jsonPath } = saveReport(report, dir);
      process.stderr.write(chalk.yellow(`\nPartial audit report saved:\n  HTML: ${htmlPath}\n  JSON: ${jsonPath}\n`));
    } catch { /* best-effort */ }
  });

  // ── Step 1: Security ───────────────────────────────────────────────────────
  logger.step('Step 1/3: Security Audit');
  report.security = await runSecurityAudit(target);

  // ── Step 2: Lighthouse ────────────────────────────────────────────────────
  if (!opts['skipLighthouse']) {
    logger.step('Step 2/3: Lighthouse / Performance Audit');
    report.lighthouse = await runLighthouse(target, dir);
  } else {
    logger.info('Skipping Lighthouse (--skip-lighthouse)');
  }

  // ── Step 3: Load test ─────────────────────────────────────────────────────
  if (!opts['skipLoad']) {
    logger.step('Step 3/3: Load Test');
    logger.warn('Ctrl+C at any time — partial results will be saved.\n');

    const config: LoadTestConfig = {
      url:           target,
      type:          (opts['loadType'] as 'rampup' | 'spike' | 'soak') ?? 'rampup',
      maxRps,
      startVus:      5,
      endVus:        parseInt(opts['vus'] as string)    || 30,
      duration:      (opts['duration'] as string)        || '1m',
      spikeVus:      80,
      spikeDuration: '20s',
      soakVus:       30,
      soakDuration:  '5m',
    };

    try {
      let metrics: LoadTestMetrics;
      switch (config.type) {
        case 'spike': metrics = await runSpikeTest(config); break;
        case 'soak':  metrics = await runSoakTest(config);  break;
        default:      metrics = await runRampUpTest(config);
      }
      report.loadTests = [metrics];
    } catch (err) {
      const msg = (err as Error).message;
      if (msg && !msg.includes('autocannon')) logger.warn(`Load test error: ${msg}`);
      // Continue to save whatever we have
    }
  } else {
    logger.info('Skipping load tests (--skip-load)');
  }

  // ── Final report ──────────────────────────────────────────────────────────
  report.meta.durationMs = Date.now() - startTime;
  const { htmlPath, jsonPath } = saveReport(report, dir);

  logger.banner('Audit Complete');
  logger.success(`Run ID:   ${runId}`);
  logger.success(`Duration: ${(report.meta.durationMs / 1000).toFixed(1)}s`);
  logger.success(`HTML:     ${htmlPath}`);
  logger.success(`JSON:     ${jsonPath}`);
  logger.info('\nOpen the HTML report in your browser to view results.');
});

program.parse(process.argv);
