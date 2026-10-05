import { HeaderFinding } from '../types';
import { simpleGet } from '../utils/http';
import { logger } from '../utils/logger';

interface HeaderSpec {
  name: string;
  why: string;
  severity: 'high' | 'medium' | 'low';
  validate?: (value: string) => { ok: boolean; message?: string };
}

const SECURITY_HEADERS: HeaderSpec[] = [
  {
    name: 'strict-transport-security',
    why: 'HSTS forces browsers to use HTTPS, preventing downgrade attacks and cookie hijacking.',
    severity: 'high',
    validate: (v) => {
      const maxAge = v.match(/max-age=(\d+)/i);
      if (!maxAge) return { ok: false, message: 'Missing max-age directive' };
      const seconds = parseInt(maxAge[1]);
      if (seconds < 31536000) {
        return { ok: false, message: `max-age=${seconds} is too short (recommend ≥ 31536000 / 1 year)` };
      }
      if (!v.includes('includeSubDomains')) {
        return { ok: false, message: 'Missing includeSubDomains directive (recommended)' };
      }
      return { ok: true };
    },
  },
  {
    name: 'content-security-policy',
    why: "CSP prevents XSS by whitelisting trusted content sources; without it any injected script runs.",
    severity: 'high',
    validate: (v) => {
      if (v.includes("'unsafe-inline'") && !v.includes('nonce-') && !v.includes('hash-')) {
        return { ok: false, message: "CSP contains 'unsafe-inline' without nonce/hash — reduces XSS protection" };
      }
      if (v.includes("'unsafe-eval'")) {
        return { ok: false, message: "CSP contains 'unsafe-eval' — allows dynamic code execution" };
      }
      return { ok: true };
    },
  },
  {
    name: 'x-frame-options',
    why: 'Prevents clickjacking by controlling whether the page can be embedded in an iframe.',
    severity: 'medium',
    validate: (v) => {
      const upper = v.toUpperCase().trim();
      if (upper === 'DENY' || upper === 'SAMEORIGIN') return { ok: true };
      return { ok: false, message: `Unexpected value "${v}" — should be DENY or SAMEORIGIN` };
    },
  },
  {
    name: 'x-content-type-options',
    why: 'nosniff prevents browsers from MIME-sniffing, which can lead to XSS via crafted files.',
    severity: 'medium',
    validate: (v) => {
      if (v.trim().toLowerCase() !== 'nosniff') {
        return { ok: false, message: `Value should be "nosniff", got "${v}"` };
      }
      return { ok: true };
    },
  },
  {
    name: 'referrer-policy',
    why: 'Controls how much referrer info leaks to third parties in request headers.',
    severity: 'low',
    validate: (v) => {
      const safe = [
        'no-referrer',
        'no-referrer-when-downgrade',
        'same-origin',
        'strict-origin',
        'strict-origin-when-cross-origin',
      ];
      const val = v.toLowerCase().trim();
      if (!safe.includes(val)) {
        return { ok: false, message: `"${v}" may leak sensitive URL info — prefer strict-origin-when-cross-origin` };
      }
      return { ok: true };
    },
  },
  {
    name: 'permissions-policy',
    why: 'Restricts browser features (camera, mic, geolocation) from being used by the page or frames.',
    severity: 'low',
  },
  {
    name: 'x-xss-protection',
    why: 'Legacy header; browsers have dropped it, but setting "0" explicitly disables broken IE behavior. Informational only.',
    severity: 'low',
    validate: (v) => {
      if (v.trim() === '1; mode=block') {
        return { ok: false, message: '"1; mode=block" can introduce XSS vulnerabilities in old browsers — prefer "0" or remove' };
      }
      return { ok: true };
    },
  },
  {
    name: 'cache-control',
    why: 'Without proper cache-control, sensitive pages may be cached by intermediary proxies.',
    severity: 'low',
  },
];

function getHeader(
  headers: Record<string, string | string[]>,
  name: string
): string | undefined {
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  if (!key) return undefined;
  const val = headers[key];
  return Array.isArray(val) ? val.join(', ') : val;
}

export async function auditHeaders(targetUrl: string): Promise<HeaderFinding[]> {
  const findings: HeaderFinding[] = [];
  logger.debug(`Fetching headers from ${targetUrl}`);

  let headers: Record<string, string | string[]>;
  let finalUrl: string;

  try {
    const resp = await simpleGet(targetUrl, { timeout: 12_000 });
    headers = resp.headers;
    finalUrl = resp.finalUrl;
    logger.debug(`Final URL after redirects: ${finalUrl}`);
  } catch (err) {
    findings.push({
      category: 'Headers',
      check: 'Connectivity',
      status: 'fail',
      severity: 'critical',
      message: `Failed to fetch ${targetUrl}: ${(err as Error).message}`,
    });
    return findings;
  }

  // HTTPS redirect check
  if (targetUrl.startsWith('http://') && finalUrl.startsWith('https://')) {
    findings.push({
      category: 'Headers',
      check: 'HTTP→HTTPS Redirect',
      status: 'pass',
      severity: 'info',
      message: 'HTTP automatically redirects to HTTPS ✓',
    });
  }

  // Check each security header
  for (const spec of SECURITY_HEADERS) {
    const value = getHeader(headers, spec.name);

    if (!value) {
      findings.push({
        category: 'Headers',
        check: spec.name,
        headerName: spec.name,
        status: 'fail',
        severity: spec.severity,
        message: `Missing header: ${spec.name}`,
        detail: spec.why,
        recommendation: `Add the "${spec.name}" response header.`,
      });
      continue;
    }

    if (spec.validate) {
      const result = spec.validate(value);
      if (!result.ok) {
        findings.push({
          category: 'Headers',
          check: spec.name,
          headerName: spec.name,
          headerValue: value,
          status: 'warn',
          severity: spec.severity,
          message: `Misconfigured: ${result.message}`,
          detail: spec.why,
          recommendation: `Review and strengthen the "${spec.name}" header value.`,
        });
        continue;
      }
    }

    findings.push({
      category: 'Headers',
      check: spec.name,
      headerName: spec.name,
      headerValue: value,
      status: 'pass',
      severity: 'info',
      message: `${spec.name}: present and valid`,
    });
  }

  // Server info leakage
  const serverHeader = getHeader(headers, 'server');
  if (serverHeader && serverHeader.length > 0) {
    // Check if it reveals version info
    const revealingPattern = /[\d.]+/;
    if (revealingPattern.test(serverHeader)) {
      findings.push({
        category: 'Headers',
        check: 'Server Header',
        headerName: 'server',
        headerValue: serverHeader,
        status: 'warn',
        severity: 'low',
        message: `"Server" header reveals version info: "${serverHeader}"`,
        detail: 'Exposing server version helps attackers target known CVEs.',
        recommendation: 'Configure server to emit a generic or empty Server header.',
      });
    } else {
      findings.push({
        category: 'Headers',
        check: 'Server Header',
        headerName: 'server',
        headerValue: serverHeader,
        status: 'info',
        severity: 'info',
        message: `Server: ${serverHeader}`,
      });
    }
  }

  // X-Powered-By leakage
  const poweredBy = getHeader(headers, 'x-powered-by');
  if (poweredBy) {
    findings.push({
      category: 'Headers',
      check: 'X-Powered-By',
      headerName: 'x-powered-by',
      headerValue: poweredBy,
      status: 'warn',
      severity: 'low',
      message: `X-Powered-By reveals technology: "${poweredBy}"`,
      detail: 'Reveals the server stack, helping attackers fingerprint vulnerabilities.',
      recommendation: 'Remove or suppress the X-Powered-By header.',
    });
  }

  return findings;
}
