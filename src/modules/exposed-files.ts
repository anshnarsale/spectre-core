import { ExposedFileFinding } from '../types';
import { simpleHead } from '../utils/http';
import { logger } from '../utils/logger';

interface ProbeTarget {
  path: string;
  label: string;
  severity: 'high' | 'medium' | 'low';
  reason: string;
  /** If a 200 is actually a false positive (e.g. a catch-all 200), we detect this via body hints */
  bodyHint?: RegExp;
}

const PROBE_TARGETS: ProbeTarget[] = [
  // Environment / config files
  { path: '/.env', label: '.env file', severity: 'high', reason: 'Contains credentials/secrets in plaintext' },
  { path: '/.env.local', label: '.env.local', severity: 'high', reason: 'Local environment overrides, may contain API keys' },
  { path: '/.env.production', label: '.env.production', severity: 'high', reason: 'Production secrets may be exposed' },
  { path: '/.env.backup', label: '.env.backup', severity: 'high', reason: 'Backup env file may contain sensitive credentials' },

  // Git exposure
  { path: '/.git/config', label: '.git/config', severity: 'high', reason: 'Exposes repo origin, may allow full source download' },
  { path: '/.git/HEAD', label: '.git/HEAD', severity: 'high', reason: 'Confirms git repo is exposed; enables source extraction' },
  { path: '/.gitignore', label: '.gitignore', severity: 'low', reason: 'Reveals project structure and ignored file patterns' },

  // Source maps in production
  { path: '/static/js/main.chunk.js.map', label: 'JS source map (CRA)', severity: 'medium', reason: 'Source maps expose original unminified source code' },
  { path: '/assets/index.js.map', label: 'JS source map (Vite)', severity: 'medium', reason: 'Source maps expose original unminified source code' },
  { path: '/bundle.js.map', label: 'bundle.js.map', severity: 'medium', reason: 'Source maps expose original source code' },

  // Build artifacts / logs
  { path: '/build/bundle.js', label: 'Build bundle', severity: 'low', reason: 'Build artifacts should not be directly accessible' },
  { path: '/.netlify/functions/index.js', label: 'Netlify function source', severity: 'medium', reason: 'Function source code could expose business logic' },

  // Config files
  { path: '/wp-config.php', label: 'wp-config.php', severity: 'high', reason: 'WordPress config contains database credentials' },
  { path: '/config.json', label: 'config.json', severity: 'medium', reason: 'App config may contain API endpoints and keys' },
  { path: '/config.yml', label: 'config.yml', severity: 'medium', reason: 'App config may contain sensitive settings' },
  { path: '/secrets.json', label: 'secrets.json', severity: 'high', reason: 'Explicitly named secrets file' },

  // Common sensitive paths
  { path: '/admin', label: '/admin panel', severity: 'low', reason: 'Admin panel should not be publicly listed' },
  { path: '/phpinfo.php', label: 'phpinfo()', severity: 'high', reason: 'Exposes full PHP config, server paths, and loaded modules' },
  { path: '/server-status', label: 'Apache server-status', severity: 'medium', reason: 'Exposes request logs and server internals' },
  { path: '/robots.txt', label: 'robots.txt', severity: 'info', reason: 'Informational — disallowed paths may hint at sensitive areas' } as unknown as ProbeTarget,
  { path: '/sitemap.xml', label: 'sitemap.xml', severity: 'info', reason: 'Informational — enumerates all public URLs' } as unknown as ProbeTarget,

  // Package info
  { path: '/package.json', label: 'package.json', severity: 'medium', reason: 'Reveals dependency list including vulnerable versions' },
  { path: '/composer.json', label: 'composer.json', severity: 'medium', reason: 'PHP dependency manifest; reveals library versions' },

  // Backup files
  { path: '/backup.sql', label: 'backup.sql', severity: 'high', reason: 'Database dump is extremely sensitive' },
  { path: '/dump.sql', label: 'dump.sql', severity: 'high', reason: 'Database dump is extremely sensitive' },
];

export async function auditExposedFiles(
  targetUrl: string,
  concurrency = 5
): Promise<ExposedFileFinding[]> {
  const findings: ExposedFileFinding[] = [];
  const base = targetUrl.replace(/\/$/, '');

  logger.debug(`Probing ${PROBE_TARGETS.length} sensitive paths on ${base}...`);

  // Process in batches to avoid hammering the server
  for (let i = 0; i < PROBE_TARGETS.length; i += concurrency) {
    const batch = PROBE_TARGETS.slice(i, i + concurrency);

    const results = await Promise.allSettled(
      batch.map(async (target) => {
        const url = `${base}${target.path}`;
        try {
          const resp = await simpleHead(url, { timeout: 8000, rejectUnauthorized: false });
          return { target, url, statusCode: resp.statusCode };
        } catch {
          // Network error = likely not exposed
          return { target, url, statusCode: 0 };
        }
      })
    );

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const { target, url, statusCode } = result.value;

      // Cast to get severity as string for info
      const sev = (target as { severity?: string }).severity;

      if (statusCode === 200) {
        findings.push({
          category: 'Exposed Files',
          check: target.label,
          status: sev === 'info' ? 'info' : 'fail',
          severity: sev === 'info' ? 'info' : (target as ProbeTarget).severity,
          message:
            sev === 'info'
              ? `${target.label} accessible (${url})`
              : `EXPOSED: ${target.label} is publicly accessible`,
          detail: target.reason,
          path: target.path,
          statusCode,
          recommendation:
            sev === 'info'
              ? undefined
              : `Restrict access to ${target.path} via CDN/server rules or move it out of the web root.`,
        });
      } else if (statusCode === 403) {
        findings.push({
          category: 'Exposed Files',
          check: target.label,
          status: 'warn',
          severity: 'low',
          message: `${target.label} returns 403 Forbidden — path exists but is blocked`,
          detail: target.reason,
          path: target.path,
          statusCode,
          recommendation: `Consider returning 404 instead of 403 to avoid confirming path existence.`,
        });
      } else if (statusCode !== 0) {
        logger.debug(`  ${target.path} → ${statusCode} (not exposed)`);
      }
    }
  }

  if (findings.length === 0) {
    findings.push({
      category: 'Exposed Files',
      check: 'Sensitive File Exposure',
      status: 'pass',
      severity: 'info',
      message: `No sensitive files found exposed across ${PROBE_TARGETS.length} probed paths`,
    });
  }

  return findings;
}
