import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { CombinedReport, LoadTestConfig, LoadTestMetrics } from '../types';
import { logger, logEmitter } from '../utils/logger';
import { runSecurityAudit } from '../modules/security-audit';
import { runLighthouse } from '../modules/lighthouse';
import { runRampUpTest, runSpikeTest, runSoakTest, stopLoadTest } from '../modules/load-test';
import { generateHtmlReport, generateJsonReport } from '../report/generator';

export interface AuditRunOptions {
  target: string;
  mode: 'full' | 'security' | 'load' | 'lighthouse';
  maxRps?: number;
  skipLighthouse?: boolean;
  skipLoad?: boolean;
  loadConfig?: {
    type?: 'rampup' | 'spike' | 'soak';
    vus?: number;
    startVus?: number;
    duration?: string;
    spikeVus?: number;
    spikeDuration?: string;
    soakVus?: number;
    soakDuration?: string;
  };
}

export interface PastReportSummary {
  runId: string;
  target: string;
  timestamp: string;
  durationMs: number;
  hasSecurity: boolean;
  hasLoad: boolean;
  hasLighthouse: boolean;
  securitySummary?: {
    total: number;
    pass: number;
    fail: number;
    warn: number;
  };
  loadSummary?: {
    totalRequests: number;
    rps: number;
    errorRate: number;
    p95: number;
  };
  lighthouseScores?: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
  htmlUrl: string;
  jsonUrl: string;
}

class AuditService extends EventEmitter {
  private _isAuditing = false;
  private _currentRunId: string | null = null;
  private _currentTarget: string | null = null;
  private _activeReport: CombinedReport | null = null;
  private _aborted = false;

  get isAuditing(): boolean {
    return this._isAuditing;
  }

  get currentRunId(): string | null {
    return this._currentRunId;
  }

  get currentTarget(): string | null {
    return this._currentTarget;
  }

  private createRunDir(): { runId: string; dir: string } {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dir = path.join(process.cwd(), 'reports', ts);
    fs.mkdirSync(dir, { recursive: true });
    return { runId: ts, dir };
  }

  private saveReport(report: CombinedReport, dir: string): { htmlPath: string; jsonPath: string } {
    const htmlPath = path.join(dir, 'report.html');
    const jsonPath = path.join(dir, 'report.json');
    generateHtmlReport(report, htmlPath);
    generateJsonReport(report, jsonPath);
    return { htmlPath, jsonPath };
  }

  private normalizeUrl(url: string): string {
    let clean = url.trim();
    if (!/^https?:\/\//i.test(clean)) {
      clean = 'https://' + clean;
    }
    return clean;
  }

  public abortCurrent(): void {
    if (this._isAuditing) {
      this._aborted = true;
      stopLoadTest();
      logger.warn('Audit cancel requested by user.');
      this.emit('status', {
        state: 'stopping',
        message: 'Stopping active tests and saving partial results...',
        runId: this._currentRunId,
      });
    }
  }

  public async runAudit(options: AuditRunOptions): Promise<CombinedReport> {
    if (this._isAuditing) {
      throw new Error('An audit is already running. Please wait or cancel the active one.');
    }

    const target = this.normalizeUrl(options.target);
    const maxRps = options.maxRps && options.maxRps > 0 ? options.maxRps : 100;
    const { runId, dir } = this.createRunDir();
    const startTime = Date.now();

    this._isAuditing = true;
    this._aborted = false;
    this._currentRunId = runId;
    this._currentTarget = target;

    const report: CombinedReport = {
      meta: {
        tool: 'spectre-core',
        version: '1.0.0',
        target,
        runId,
        timestamp: new Date().toISOString(),
        durationMs: 0,
      },
    };
    this._activeReport = report;

    this.emit('status', {
      state: 'running',
      step: 'Initializing ephemeral audit',
      runId,
      target,
    });

    logger.banner(`SPECTRE · CORE — Zero-Trace Audit [${options.mode.toUpperCase()}]`);
    logger.info(`Target: ${target}  |  Max RPS: ${maxRps}`);

    try {
      // MODE 1: SECURITY ONLY
      if (options.mode === 'security') {
        this.emit('status', { state: 'running', step: 'Running Security Audit (Headers, TLS, DNS, Files)', runId });
        logger.step('Starting comprehensive Security Audit...');
        report.security = await runSecurityAudit(target);
      }

      // MODE 2: LOAD TEST ONLY
      else if (options.mode === 'load') {
        this.emit('status', { state: 'running', step: 'Running Load & Stress Test', runId });
        const loadType = options.loadConfig?.type || 'rampup';
        const config: LoadTestConfig = {
          url: target,
          type: loadType,
          maxRps,
          startVus: options.loadConfig?.startVus || 5,
          endVus: options.loadConfig?.vus || 25,
          duration: options.loadConfig?.duration || '30s',
          spikeVus: options.loadConfig?.spikeVus || 50,
          spikeDuration: options.loadConfig?.spikeDuration || '15s',
          soakVus: options.loadConfig?.soakVus || 20,
          soakDuration: options.loadConfig?.soakDuration || '2m',
        };

        let metrics: LoadTestMetrics;
        if (config.type === 'spike') {
          metrics = await runSpikeTest(config);
        } else if (config.type === 'soak') {
          metrics = await runSoakTest(config);
        } else {
          metrics = await runRampUpTest(config);
        }
        report.loadTests = [metrics];
      }

      // MODE 3: LIGHTHOUSE ONLY
      else if (options.mode === 'lighthouse') {
        this.emit('status', { state: 'running', step: 'Running Lighthouse Performance Audit', runId });
        report.lighthouse = await runLighthouse(target, dir);
      }

      // MODE 4: FULL AUDIT
      else {
        // Step 1: Security
        this.emit('status', { state: 'running', step: 'Step 1/3: Security Audit', runId });
        report.security = await runSecurityAudit(target);

        if (this._aborted) throw new Error('Aborted by user');

        // Step 2: Lighthouse
        if (!options.skipLighthouse) {
          this.emit('status', { state: 'running', step: 'Step 2/3: Lighthouse Performance Scan', runId });
          report.lighthouse = await runLighthouse(target, dir);
        }

        if (this._aborted) throw new Error('Aborted by user');

        // Step 3: Load Test
        if (!options.skipLoad) {
          this.emit('status', { state: 'running', step: 'Step 3/3: Load Test', runId });
          const config: LoadTestConfig = {
            url: target,
            type: options.loadConfig?.type || 'rampup',
            maxRps,
            startVus: options.loadConfig?.startVus || 5,
            endVus: options.loadConfig?.vus || 20,
            duration: options.loadConfig?.duration || '30s',
            spikeVus: options.loadConfig?.spikeVus || 40,
            spikeDuration: options.loadConfig?.spikeDuration || '15s',
            soakVus: options.loadConfig?.soakVus || 20,
            soakDuration: options.loadConfig?.soakDuration || '2m',
          };

          try {
            let metrics: LoadTestMetrics;
            if (config.type === 'spike') {
              metrics = await runSpikeTest(config);
            } else if (config.type === 'soak') {
              metrics = await runSoakTest(config);
            } else {
              metrics = await runRampUpTest(config);
            }
            report.loadTests = [metrics];
          } catch (loadErr) {
            logger.warn(`Load test ended: ${(loadErr as Error).message}`);
          }
        }
      }

      report.meta.durationMs = Date.now() - startTime;
      const { htmlPath, jsonPath } = this.saveReport(report, dir);

      logger.success(`Audit completed successfully! Saved to: ${htmlPath}`);

      this.emit('status', {
        state: 'completed',
        step: 'Completed',
        runId,
        report,
        htmlUrl: `/reports/${runId}/report.html`,
        jsonUrl: `/reports/${runId}/report.json`,
      });

      return report;
    } catch (err) {
      report.meta.durationMs = Date.now() - startTime;
      // Save whatever partial report we have
      try {
        this.saveReport(report, dir);
      } catch {
        /* best effort */
      }

      const errMsg = (err as Error).message || 'Unknown error';
      logger.error(`Audit finished with note: ${errMsg}`);

      this.emit('status', {
        state: this._aborted ? 'aborted' : 'error',
        step: this._aborted ? 'Aborted by user' : 'Failed',
        runId,
        error: errMsg,
        report,
        htmlUrl: `/reports/${runId}/report.html`,
        jsonUrl: `/reports/${runId}/report.json`,
      });

      return report;
    } finally {
      this._isAuditing = false;
      this._currentRunId = null;
      this._currentTarget = null;
      this._activeReport = null;
    }
  }

  public getPastReports(): PastReportSummary[] {
    const reportsDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) return [];

    const entries = fs.readdirSync(reportsDir, { withFileTypes: true });
    const summaries: PastReportSummary[] = [];

    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const runId = ent.name;
      const jsonPath = path.join(reportsDir, runId, 'report.json');
      if (fs.existsSync(jsonPath)) {
        try {
          const raw = fs.readFileSync(jsonPath, 'utf8');
          const data: CombinedReport = JSON.parse(raw);

          const sec = data.security;
          const load = data.loadTests?.[0];
          const lh = data.lighthouse;

          summaries.push({
            runId,
            target: data.meta?.target || 'Unknown',
            timestamp: data.meta?.timestamp || runId,
            durationMs: data.meta?.durationMs || 0,
            hasSecurity: !!sec,
            hasLoad: !!load,
            hasLighthouse: !!lh,
            securitySummary: sec?.summary
              ? {
                  total: sec.summary.total,
                  pass: sec.summary.pass,
                  fail: sec.summary.fail,
                  warn: sec.summary.warn,
                }
              : undefined,
            loadSummary: load
              ? {
                  totalRequests: load.totalRequests,
                  rps: Math.round(load.requestsPerSec * 10) / 10,
                  errorRate: Math.round(load.errorRate * 1000) / 10,
                  p95: load.latency?.p95 || 0,
                }
              : undefined,
            lighthouseScores: lh?.scores,
            htmlUrl: `/reports/${runId}/report.html`,
            jsonUrl: `/reports/${runId}/report.json`,
          });
        } catch {
          // ignore corrupted files
        }
      }
    }

    // Sort newest first
    summaries.sort((a, b) => b.runId.localeCompare(a.runId));
    return summaries;
  }

  public getReportByRunId(runId: string): CombinedReport | null {
    const jsonPath = path.join(process.cwd(), 'reports', runId, 'report.json');
    if (!fs.existsSync(jsonPath)) return null;
    try {
      const raw = fs.readFileSync(jsonPath, 'utf8');
      return JSON.parse(raw) as CombinedReport;
    } catch {
      return null;
    }
  }

  public deleteReport(runId: string): boolean {
    const dir = path.join(process.cwd(), 'reports', runId);
    if (!fs.existsSync(dir)) return false;
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }

  public wipeAllReports(): boolean {
    const reportsDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) return true;
    try {
      const entries = fs.readdirSync(reportsDir, { withFileTypes: true });
      for (const ent of entries) {
        if (ent.isDirectory()) {
          fs.rmSync(path.join(reportsDir, ent.name), { recursive: true, force: true });
        }
      }
      return true;
    } catch {
      return false;
    }
  }
}

export const auditService = new AuditService();
