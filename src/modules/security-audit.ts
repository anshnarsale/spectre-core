import { SecurityReport, Finding } from '../types';
import { auditHeaders } from './header-audit';
import { auditTls } from './tls-audit';
import { auditExposedFiles } from './exposed-files';
import { auditDns } from './dns-audit';
import { auditDependencies } from './dep-scan';
import { logger } from '../utils/logger';
import chalk from 'chalk';

function countSeverity(findings: Finding[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const f of findings) {
    map[f.severity] = (map[f.severity] ?? 0) + 1;
  }
  return map;
}

function printFindingsSummary(label: string, findings: Finding[]): void {
  const fails = findings.filter((f) => f.status === 'fail');
  const warns = findings.filter((f) => f.status === 'warn');
  const passes = findings.filter((f) => f.status === 'pass');

  logger.section(label);

  for (const f of findings) {
    const icon =
      f.status === 'pass' ? chalk.green('✔') :
      f.status === 'fail' ? chalk.red('✖') :
      f.status === 'warn' ? chalk.yellow('⚠') :
      chalk.gray('ℹ');

    const sev =
      f.severity === 'critical' ? chalk.bgRed.white(` ${f.severity.toUpperCase()} `) :
      f.severity === 'high'     ? chalk.red(`[${f.severity}]`) :
      f.severity === 'medium'   ? chalk.yellow(`[${f.severity}]`) :
      f.severity === 'low'      ? chalk.blue(`[${f.severity}]`) :
                                  chalk.gray(`[${f.severity}]`);

    console.log(`  ${icon} ${sev} ${f.message}`);
    if (f.detail && process.env['VERBOSE']) {
      console.log(chalk.gray(`       ↳ ${f.detail}`));
    }
    if (f.recommendation && (f.status === 'fail' || f.status === 'warn')) {
      console.log(chalk.cyan(`       → ${f.recommendation}`));
    }
  }

  console.log(
    `\n  ${chalk.green(passes.length + ' passed')}  ` +
    `${chalk.yellow(warns.length + ' warnings')}  ` +
    `${chalk.red(fails.length + ' failed')}`
  );
}

export async function runSecurityAudit(targetUrl: string): Promise<SecurityReport> {
  logger.banner('Security Audit');
  logger.info(`Target: ${chalk.bold(targetUrl)}`);
  const startTime = Date.now();

  // ── Run all checks ───────────────────────────────────────────────────────────
  logger.step('Checking HTTP security headers...');
  const headers = await auditHeaders(targetUrl);
  printFindingsSummary('HTTP Security Headers', headers);

  logger.step('Auditing TLS/certificate...');
  const tls = await auditTls(targetUrl);
  printFindingsSummary('TLS / Certificate', tls);

  logger.step('Scanning for exposed sensitive files...');
  const exposedFiles = await auditExposedFiles(targetUrl);
  printFindingsSummary('Exposed Files', exposedFiles);

  logger.step('Checking DNS records...');
  const dns = await auditDns(targetUrl);
  printFindingsSummary('DNS Sanity Check', dns);

  logger.step('Scanning for detectable JS library versions...');
  const deps = await auditDependencies(targetUrl);
  printFindingsSummary('Dependency Scan', deps);

  // ── Compile report ──────────────────────────────────────────────────────────
  const allFindings = [...headers, ...tls, ...exposedFiles, ...dns, ...deps];

  const failCount = allFindings.filter((f) => f.status === 'fail').length;
  const warnCount = allFindings.filter((f) => f.status === 'warn').length;
  const passCount = allFindings.filter((f) => f.status === 'pass').length;

  logger.section('Security Audit Summary');
  console.log(`  Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`  Total checks: ${allFindings.length}`);
  console.log(`  ${chalk.green('✔ ' + passCount + ' passed')}  ${chalk.yellow('⚠ ' + warnCount + ' warnings')}  ${chalk.red('✖ ' + failCount + ' failed')}`);

  const highSeverity = allFindings.filter(
    (f) => (f.status === 'fail' || f.status === 'warn') && (f.severity === 'high' || f.severity === 'critical')
  );
  if (highSeverity.length > 0) {
    console.log(chalk.red(`\n  ⚠ ${highSeverity.length} high/critical finding(s) require attention:`));
    for (const f of highSeverity) {
      console.log(chalk.red(`    • ${f.check}: ${f.message}`));
    }
  }

  return {
    target: targetUrl,
    timestamp: new Date().toISOString(),
    headers,
    tls,
    exposedFiles,
    dns: [...dns, ...deps],
    summary: {
      total: allFindings.length,
      pass: passCount,
      fail: failCount,
      warn: warnCount,
      byCategory: countSeverity(allFindings),
    },
  };
}
