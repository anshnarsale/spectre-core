import { simpleGet } from '../utils/http';
import { Finding } from '../types';
import { logger } from '../utils/logger';

interface KnownLibrary {
  pattern: RegExp; // matches in JS source
  name: string;
  extractVersion?: RegExp; // captures version from matched context
  cveNote?: string;
}

// Non-exhaustive list of easily detectable libraries + known bad versions
const KNOWN_LIBRARIES: KnownLibrary[] = [
  {
    name: 'jQuery',
    pattern: /jquery[.\-](\d+\.\d+\.\d+)/i,
    extractVersion: /jquery[.\-](\d+\.\d+\.\d+)/i,
    cveNote: 'Versions < 3.5.0 have XSS vulnerabilities (CVE-2020-11022/11023)',
  },
  {
    name: 'lodash',
    pattern: /lodash[.\-_](\d+\.\d+\.\d+)/i,
    extractVersion: /lodash[.\-_](\d+\.\d+\.\d+)/i,
    cveNote: 'Versions < 4.17.21 have prototype pollution (CVE-2021-23337)',
  },
  {
    name: 'React',
    pattern: /react[.\-](\d+\.\d+\.\d+)/i,
    extractVersion: /react[.\-](\d+\.\d+\.\d+)/i,
  },
  {
    name: 'Vue',
    pattern: /vue[.\-](\d+\.\d+\.\d+)/i,
    extractVersion: /vue[.\-](\d+\.\d+\.\d+)/i,
  },
  {
    name: 'Angular',
    pattern: /@angular\/core[.\-](\d+\.\d+\.\d+)/i,
    extractVersion: /@angular\/core[.\-](\d+\.\d+\.\d+)/i,
  },
  {
    name: 'axios',
    pattern: /axios[.\-_](\d+\.\d+\.\d+)/i,
    extractVersion: /axios[.\-_](\d+\.\d+\.\d+)/i,
    cveNote: 'Versions < 0.21.2 have SSRF vulnerability (CVE-2021-3749)',
  },
  {
    name: 'moment',
    pattern: /moment[.\-](\d+\.\d+\.\d+)/i,
    extractVersion: /moment[.\-](\d+\.\d+\.\d+)/i,
    cveNote: 'ReDoS vulnerabilities in multiple versions; consider migrating to day.js/date-fns',
  },
  {
    name: 'highlight.js',
    pattern: /highlight(?:\.min)?\.js/i,
  },
  {
    name: 'Bootstrap',
    pattern: /bootstrap[.\-](\d+\.\d+\.\d+)/i,
    extractVersion: /bootstrap[.\-](\d+\.\d+\.\d+)/i,
    cveNote: 'Versions < 4.3.1 have XSS vulnerabilities',
  },
];

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Parse <script src="..."> tags from HTML */
function extractScriptUrls(html: string, base: string): string[] {
  const urls: string[] = [];
  const re = /<script[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    const src = match[1];
    try {
      urls.push(new URL(src, base).toString());
    } catch {
      // skip malformed URLs
    }
  }
  return urls;
}

export async function auditDependencies(targetUrl: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  logger.debug('Scanning page for bundled JS library versions...');

  // Fetch the main HTML page
  let html = '';
  try {
    const resp = await simpleGet(targetUrl, { timeout: 15_000 });
    html = resp.body;
  } catch (err) {
    findings.push({
      category: 'Dependencies',
      check: 'Page Fetch',
      status: 'fail',
      severity: 'medium',
      message: `Could not fetch page for dependency scanning: ${(err as Error).message}`,
    });
    return findings;
  }

  // Detect libraries directly in inline scripts or HTML
  const detectedFromHtml: Array<{ name: string; version?: string; cveNote?: string }> = [];
  for (const lib of KNOWN_LIBRARIES) {
    const m = html.match(lib.extractVersion ?? lib.pattern);
    if (m) {
      detectedFromHtml.push({ name: lib.name, version: m[1], cveNote: lib.cveNote });
    }
  }

  // Extract and scan linked JS files (limit to first 5 same-origin scripts to avoid hammering CDNs)
  const scriptUrls = extractScriptUrls(html, targetUrl)
    .filter((u) => u.includes(new URL(targetUrl).hostname))
    .slice(0, 5);

  logger.debug(`Found ${scriptUrls.length} same-origin script(s) to scan`);

  const scriptContents = await Promise.allSettled(
    scriptUrls.map((u) => simpleGet(u, { timeout: 12_000 }).then((r) => r.body))
  );

  const allJsContent = scriptContents
    .filter((r) => r.status === 'fulfilled')
    .map((r) => (r as PromiseFulfilledResult<string>).value)
    .join('\n');

  // Also scan script filenames for version hints
  const allSources = html + '\n' + allJsContent;
  const detected: Array<{ name: string; version?: string; cveNote?: string }> = [...detectedFromHtml];

  for (const lib of KNOWN_LIBRARIES) {
    if (detected.find((d) => d.name === lib.name)) continue; // already found
    const m = allSources.match(lib.extractVersion ?? lib.pattern);
    if (m) {
      detected.push({ name: lib.name, version: m[1], cveNote: lib.cveNote });
    }
  }

  // Check source map exposure (in HTML)
  const sourceMapsExposed = /\.js\.map/i.test(html);
  if (sourceMapsExposed) {
    findings.push({
      category: 'Dependencies',
      check: 'Source Maps Exposed',
      status: 'warn',
      severity: 'medium',
      message: 'Source map references found in HTML (JS source maps may be publicly accessible)',
      detail: 'Source maps expose your original, unminified source code to anyone who opens DevTools.',
      recommendation: 'Remove source map references from production builds or serve them behind auth.',
    });
  }

  if (detected.length === 0) {
    findings.push({
      category: 'Dependencies',
      check: 'Library Versions',
      status: 'info',
      severity: 'info',
      message: 'No detectable library versions found in page source or scripts',
      detail: 'Modern bundlers often inline/tree-shake libraries making version detection unreliable.',
    });
    return findings;
  }

  for (const dep of detected) {
    findings.push({
      category: 'Dependencies',
      check: dep.name,
      status: dep.cveNote ? 'warn' : 'info',
      severity: dep.cveNote ? 'medium' : 'info',
      message: dep.version
        ? `Detected ${dep.name} v${dep.version}`
        : `Detected ${dep.name} (version unknown)`,
      detail: dep.cveNote,
      recommendation: dep.cveNote ? `Review CVE notes and update ${dep.name} to the latest version.` : undefined,
    });
  }

  return findings;
}
