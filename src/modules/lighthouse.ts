import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { LighthouseReport } from '../types';
import { logger } from '../utils/logger';

const execFileAsync = promisify(execFile);

interface LhResult {
  categories: {
    performance?: { score: number };
    accessibility?: { score: number };
    'best-practices'?: { score: number };
    seo?: { score: number };
  };
  audits: Record<string, {
    id: string;
    title: string;
    description: string;
    score: number | null;
    displayValue?: string;
    details?: { type: string };
  }>;
}

/** Convert 0–1 score to 0–100 */
function toScore(raw: number | undefined): number {
  return Math.round((raw ?? 0) * 100);
}

export async function runLighthouse(
  targetUrl: string,
  outputDir: string
): Promise<LighthouseReport> {
  logger.banner('Lighthouse / Performance Audit');
  logger.info(`Running Lighthouse on ${targetUrl}`);
  logger.info('This may take 30–60 seconds...');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonOutputPath = path.join(outputDir, `lighthouse-${timestamp}.json`);
  const htmlOutputPath = path.join(outputDir, `lighthouse-${timestamp}.html`);

  // Try to find lighthouse (local node_modules first, then global)
  const localLh = path.join(process.cwd(), 'node_modules', '.bin', 'lighthouse');
  const lhBin = fs.existsSync(localLh) ? localLh : 'lighthouse';

  const args = [
    targetUrl,
    '--output=json,html',
    `--output-path=${path.join(outputDir, `lighthouse-${timestamp}`)}`,
    '--chrome-flags=--headless --no-sandbox --disable-gpu',
    '--only-categories=performance,accessibility,best-practices,seo',
    '--quiet',
  ];

  try {
    logger.debug(`Running: ${lhBin} ${args.slice(0, 3).join(' ')} ...`);
    await execFileAsync(lhBin, args, { timeout: 120_000 });
  } catch (err) {
    // Lighthouse exits non-zero even on success sometimes; check if file exists
    if (!fs.existsSync(jsonOutputPath) && !fs.existsSync(jsonOutputPath.replace('.json', '.report.json'))) {
      logger.warn(`Lighthouse failed: ${(err as Error).message}`);
      logger.warn('Falling back to manual performance checks...');
      return runFallbackPerformanceCheck(targetUrl, outputDir);
    }
  }

  // Find the output file (lighthouse sometimes appends .report.json)
  const actualJsonPath = fs.existsSync(jsonOutputPath)
    ? jsonOutputPath
    : jsonOutputPath.replace('.json', '.report.json');

  const actualHtmlPath = fs.existsSync(htmlOutputPath)
    ? htmlOutputPath
    : htmlOutputPath.replace('.html', '.report.html');

  let raw: LhResult;
  try {
    raw = JSON.parse(fs.readFileSync(actualJsonPath, 'utf8')) as LhResult;
  } catch {
    logger.warn('Could not parse Lighthouse JSON output, using fallback');
    return runFallbackPerformanceCheck(targetUrl, outputDir);
  }

  const scores = {
    performance: toScore(raw.categories.performance?.score),
    accessibility: toScore(raw.categories.accessibility?.score),
    bestPractices: toScore(raw.categories['best-practices']?.score),
    seo: toScore(raw.categories.seo?.score),
  };

  // Extract failed audits as opportunities/diagnostics
  const opportunities: LighthouseReport['opportunities'] = [];
  const diagnostics: LighthouseReport['diagnostics'] = [];

  for (const audit of Object.values(raw.audits)) {
    if (audit.score !== null && audit.score < 0.9) {
      const item = {
        id: audit.id,
        title: audit.title,
        description: audit.description,
        savings: audit.displayValue,
      };
      if (audit.details?.type === 'opportunity') {
        opportunities.push(item);
      } else if (audit.score < 0.5) {
        diagnostics.push(item);
      }
    }
  }

  logger.section('Lighthouse Scores');
  const scoreEmoji = (n: number) => n >= 90 ? '🟢' : n >= 50 ? '🟡' : '🔴';
  console.log(`  ${scoreEmoji(scores.performance)}  Performance:     ${scores.performance}`);
  console.log(`  ${scoreEmoji(scores.accessibility)}  Accessibility:   ${scores.accessibility}`);
  console.log(`  ${scoreEmoji(scores.bestPractices)}  Best Practices:  ${scores.bestPractices}`);
  console.log(`  ${scoreEmoji(scores.seo)}  SEO:             ${scores.seo}`);

  if (opportunities.length > 0) {
    logger.section('Top Opportunities');
    for (const opp of opportunities.slice(0, 5)) {
      console.log(`  ⚡ ${opp.title}${opp.savings ? ` (${opp.savings})` : ''}`);
    }
  }

  if (fs.existsSync(actualHtmlPath)) {
    logger.success(`Lighthouse HTML report: ${actualHtmlPath}`);
  }

  return {
    timestamp: new Date().toISOString(),
    url: targetUrl,
    scores,
    opportunities: opportunities.slice(0, 10),
    diagnostics: diagnostics.slice(0, 10),
    rawPath: actualHtmlPath,
  };
}

/** Fallback when Lighthouse is not installed — manual HTTP-based checks */
async function runFallbackPerformanceCheck(
  targetUrl: string,
  _outputDir: string
): Promise<LighthouseReport> {
  const { simpleGet } = await import('../utils/http');
  logger.info('Running fallback manual performance checks (no Chrome required)...');

  const checks: string[] = [];
  let score = 100;

  try {
    const start = Date.now();
    const resp = await simpleGet(targetUrl, { timeout: 15_000 });
    const ttfb = resp.durationMs;

    if (ttfb > 600) { score -= 20; checks.push(`Slow TTFB: ${ttfb}ms (target < 600ms)`); }
    if (ttfb > 1800) { score -= 20; checks.push(`Very slow TTFB: ${ttfb}ms`); }

    const html = resp.body;
    const cacheControl = resp.headers['cache-control'];
    if (!cacheControl || typeof cacheControl === 'string' && !cacheControl.includes('max-age')) {
      score -= 10;
      checks.push('Missing cache-control max-age directive for caching optimization');
    }

    const imgCount = (html.match(/<img[^>]+>/gi) ?? []).length;
    const lazyCount = (html.match(/loading="lazy"/gi) ?? []).length;
    if (imgCount > 0 && lazyCount < imgCount) {
      score -= 10;
      checks.push(`${imgCount - lazyCount} of ${imgCount} images missing lazy loading`);
    }

    // Render blocking resources
    const blockingScripts = (html.match(/<script(?!.*\b(async|defer)\b)[^>]*src=[^>]*>/gi) ?? []).length;
    if (blockingScripts > 2) {
      score -= 10;
      checks.push(`${blockingScripts} render-blocking scripts (consider async/defer)`);
    }

    logger.section('Manual Performance Checks');
    console.log(`  TTFB: ${ttfb}ms`);
    console.log(`  Estimated Performance Score: ${Math.max(0, score)}/100`);
    for (const c of checks) {
      console.log(`  ⚠ ${c}`);
    }
    if (checks.length === 0) {
      console.log('  ✔ All manual checks passed');
    }
  } catch (err) {
    logger.error(`Fallback performance check failed: ${(err as Error).message}`);
  }

  return {
    timestamp: new Date().toISOString(),
    url: targetUrl,
    scores: {
      performance: Math.max(0, score),
      accessibility: -1, // Not available without Lighthouse
      bestPractices: -1,
      seo: -1,
    },
    opportunities: checks.map((c, i) => ({ id: `manual-${i}`, title: c, description: c })),
    diagnostics: [],
    rawPath: undefined,
  };
}
