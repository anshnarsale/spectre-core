import dns from 'dns';
import { URL } from 'url';
import { DnsFinding } from '../types';
import { logger } from '../utils/logger';

function dnsResolve(hostname: string, type: 'A' | 'AAAA' | 'MX' | 'TXT' | 'NS' | 'CNAME'): Promise<string[]> {
  return new Promise((resolve) => {
    const resolver = new dns.Resolver();
    resolver.setServers(['1.1.1.1', '8.8.8.8']); // Use public DNS for consistency

    const cb = (err: NodeJS.ErrnoException | null, addresses: unknown) => {
      if (err) return resolve([]);
      if (!Array.isArray(addresses)) return resolve([String(addresses)]);

      const flat = (addresses as unknown[]).map((a) => {
        if (typeof a === 'string') return a;
        if (typeof a === 'object' && a !== null) return JSON.stringify(a);
        return String(a);
      });
      resolve(flat);
    };

    switch (type) {
      case 'A': resolver.resolve4(hostname, cb); break;
      case 'AAAA': resolver.resolve6(hostname, cb); break;
      case 'MX': resolver.resolveMx(hostname, cb); break;
      case 'TXT': resolver.resolveTxt(hostname, (err, recs) => {
        if (err) return resolve([]);
        resolve(recs.map((r) => r.join('')));
      }); break;
      case 'NS': resolver.resolveNs(hostname, cb); break;
      case 'CNAME': resolver.resolveCname(hostname, cb); break;
    }
  });
}

/** Known Netlify CDN IP prefixes */
const NETLIFY_IP_PREFIXES = [
  '75.2.',
  '99.83.',
  '18.',   // AWS us-east behind Netlify
  '52.',   // AWS elastic IPs
  '104.',  // Cloudflare/Netlify
];

/** Dangling DNS indicators — CNAME pointing to unclaimed services */
const DANGLING_CNAME_PATTERNS = [
  /\.amazonaws\.com$/,
  /\.azurewebsites\.net$/,
  /\.github\.io$/,
  /\.heroku\.com$/,
  /\.s3\.amazonaws\.com$/,
];

export async function auditDns(targetUrl: string): Promise<DnsFinding[]> {
  const findings: DnsFinding[] = [];
  const url = new URL(targetUrl);
  const hostname = url.hostname;

  logger.debug(`DNS audit for ${hostname}`);

  // ── A records ──────────────────────────────────────────────────────────────
  const aRecords = await dnsResolve(hostname, 'A');
  if (aRecords.length === 0) {
    findings.push({
      category: 'DNS',
      check: 'A Records',
      status: 'fail',
      severity: 'high',
      message: `No A records found for ${hostname}`,
      recommendation: 'Verify DNS configuration — the domain may be misconfigured.',
    });
  } else {
    const netlifyIps = aRecords.filter((ip) =>
      NETLIFY_IP_PREFIXES.some((prefix) => ip.startsWith(prefix))
    );
    findings.push({
      category: 'DNS',
      check: 'A Records',
      status: 'pass',
      severity: 'info',
      message: `A records: ${aRecords.join(', ')}`,
      detail: netlifyIps.length > 0
        ? `IPs appear to match Netlify CDN ranges`
        : `IP ranges do not match known Netlify prefixes — verify these are expected`,
    });
  }

  // ── CNAME check ─────────────────────────────────────────────────────────────
  const cnames = await dnsResolve(hostname, 'CNAME');
  if (cnames.length > 0) {
    const isDangling = cnames.some((c) =>
      DANGLING_CNAME_PATTERNS.some((p) => p.test(c))
    );
    findings.push({
      category: 'DNS',
      check: 'CNAME Records',
      status: isDangling ? 'warn' : 'pass',
      severity: isDangling ? 'high' : 'info',
      message: isDangling
        ? `CNAME points to a third-party service that may be unclaimed: ${cnames.join(', ')}`
        : `CNAME: ${cnames.join(', ')}`,
      recommendation: isDangling
        ? 'Verify the CNAME target is actively claimed by you to prevent subdomain takeover.'
        : undefined,
    });
  }

  // ── AAAA (IPv6) ─────────────────────────────────────────────────────────────
  const aaaaRecords = await dnsResolve(hostname, 'AAAA');
  findings.push({
    category: 'DNS',
    check: 'IPv6 (AAAA)',
    status: 'info',
    severity: 'info',
    message: aaaaRecords.length > 0
      ? `IPv6 supported: ${aaaaRecords.join(', ')}`
      : 'No IPv6 (AAAA) records — site is IPv4-only',
  });

  // ── NS records ──────────────────────────────────────────────────────────────
  const nsRecords = await dnsResolve(hostname, 'NS');
  if (nsRecords.length > 0) {
    findings.push({
      category: 'DNS',
      check: 'Nameservers',
      status: 'pass',
      severity: 'info',
      message: `NS: ${nsRecords.slice(0, 4).join(', ')}`,
    });
  }

  // ── TXT records — SPF / DMARC ───────────────────────────────────────────────
  const txtRecords = await dnsResolve(hostname, 'TXT');
  const spf = txtRecords.find((r) => r.startsWith('v=spf1'));
  const dmarc = await dnsResolve(`_dmarc.${hostname}`, 'TXT').catch(() => [] as string[]);

  if (spf) {
    findings.push({
      category: 'DNS',
      check: 'SPF Record',
      status: 'pass',
      severity: 'info',
      message: `SPF record found: ${spf}`,
    });
  } else {
    findings.push({
      category: 'DNS',
      check: 'SPF Record',
      status: 'info',
      severity: 'info',
      message: 'No SPF record — not critical for static sites, but recommended to prevent email spoofing',
      recommendation: 'Add an SPF TXT record if you send emails from this domain.',
    });
  }

  if (dmarc.length > 0) {
    findings.push({
      category: 'DNS',
      check: 'DMARC Record',
      status: 'pass',
      severity: 'info',
      message: `DMARC found: ${dmarc[0]}`,
    });
  } else {
    findings.push({
      category: 'DNS',
      check: 'DMARC Record',
      status: 'info',
      severity: 'info',
      message: 'No DMARC record — recommended for email security',
      recommendation: 'Add a _dmarc TXT record to enforce DMARC policy.',
    });
  }

  return findings;
}
