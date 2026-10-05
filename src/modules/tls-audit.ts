import tls from 'tls';
import { URL } from 'url';
import { TlsFinding } from '../types';
import { logger } from '../utils/logger';

interface TlsDetail {
  validFrom: string;
  validTo: string;
  daysRemaining: number;
  subject: string;
  issuer: string;
  protocol: string;
  cipher: string;
  cipherVersion: string;
  authorized: boolean;
  authError?: string;
}

const DEPRECATED_PROTOCOLS = ['TLSv1', 'TLSv1.1', 'SSLv2', 'SSLv3'];
const WEAK_CIPHERS_PATTERNS = [
  /RC4/i, /DES(?!-EDE)/i, /EXPORT/i, /NULL/i, /ANON/i, /MD5$/i,
];

function probeProtocol(
  hostname: string,
  port: number,
  minVersion: tls.SecureVersion
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: hostname,
        port,
        minVersion,
        maxVersion: minVersion as tls.SecureVersion,
        rejectUnauthorized: false,
        timeout: 5000,
      },
      () => {
        socket.destroy();
        resolve(true);
      }
    );
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function getTlsDetail(hostname: string, port: number): Promise<TlsDetail> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host: hostname,
        port,
        servername: hostname,
        rejectUnauthorized: false,
        timeout: 10_000,
      },
      () => {
        const cert = socket.getPeerCertificate();
        const cipher = socket.getCipher();
        const protocol = socket.getProtocol() ?? 'unknown';

        const validTo = new Date(cert.valid_to);
        const daysRemaining = Math.floor(
          (validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        socket.destroy();
        resolve({
          validFrom: cert.valid_from,
          validTo: cert.valid_to,
          daysRemaining,
          subject: JSON.stringify(cert.subject ?? {}),
          issuer: JSON.stringify(cert.issuer ?? {}),
          protocol,
          cipher: cipher?.name ?? 'unknown',
          cipherVersion: cipher?.version ?? 'unknown',
          authorized: socket.authorized,
          authError: socket.authorizationError?.toString(),
        });
      }
    );
    socket.on('error', reject);
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('TLS connection timed out'));
    });
  });
}

export async function auditTls(targetUrl: string): Promise<TlsFinding[]> {
  const findings: TlsFinding[] = [];
  const url = new URL(targetUrl);
  const hostname = url.hostname;
  const port = url.port ? parseInt(url.port) : 443;

  if (url.protocol !== 'https:') {
    findings.push({
      category: 'TLS',
      check: 'HTTPS',
      status: 'fail',
      severity: 'high',
      message: 'Site is not served over HTTPS',
      recommendation: 'Enable HTTPS with a valid TLS certificate.',
    });
    return findings;
  }

  // ── Certificate details ──────────────────────────────────────────────────────
  logger.debug('Fetching TLS certificate details...');
  let detail: TlsDetail | null = null;

  try {
    detail = await getTlsDetail(hostname, port);
  } catch (err) {
    findings.push({
      category: 'TLS',
      check: 'Certificate',
      status: 'fail',
      severity: 'critical',
      message: `Could not retrieve TLS certificate: ${(err as Error).message}`,
    });
    return findings;
  }

  // Certificate validity
  if (detail.daysRemaining < 0) {
    findings.push({
      category: 'TLS',
      check: 'Certificate Expiry',
      status: 'fail',
      severity: 'critical',
      message: `Certificate EXPIRED ${Math.abs(detail.daysRemaining)} days ago`,
      detail: `Valid to: ${detail.validTo}`,
      recommendation: 'Renew the certificate immediately.',
    });
  } else if (detail.daysRemaining < 14) {
    findings.push({
      category: 'TLS',
      check: 'Certificate Expiry',
      status: 'fail',
      severity: 'high',
      message: `Certificate expires in ${detail.daysRemaining} day(s) — critical`,
      detail: `Valid to: ${detail.validTo}`,
      recommendation: 'Renew the certificate now.',
    });
  } else if (detail.daysRemaining < 30) {
    findings.push({
      category: 'TLS',
      check: 'Certificate Expiry',
      status: 'warn',
      severity: 'medium',
      message: `Certificate expires in ${detail.daysRemaining} day(s)`,
      detail: `Valid to: ${detail.validTo}`,
      recommendation: 'Plan certificate renewal soon.',
    });
  } else {
    findings.push({
      category: 'TLS',
      check: 'Certificate Expiry',
      status: 'pass',
      severity: 'info',
      message: `Certificate valid for ${detail.daysRemaining} more days`,
      detail: `Valid to: ${detail.validTo}`,
    });
  }

  // Trust chain
  if (!detail.authorized && detail.authError) {
    findings.push({
      category: 'TLS',
      check: 'Certificate Trust',
      status: 'warn',
      severity: 'medium',
      message: `Certificate not fully trusted: ${detail.authError}`,
      recommendation: 'Ensure the full certificate chain is served.',
    });
  } else {
    findings.push({
      category: 'TLS',
      check: 'Certificate Trust',
      status: 'pass',
      severity: 'info',
      message: 'Certificate is trusted',
    });
  }

  // Cipher strength
  const isWeakCipher = WEAK_CIPHERS_PATTERNS.some((p) => p.test(detail!.cipher));
  if (isWeakCipher) {
    findings.push({
      category: 'TLS',
      check: 'Cipher Strength',
      status: 'fail',
      severity: 'high',
      message: `Weak cipher negotiated: ${detail.cipher}`,
      recommendation: 'Disable weak ciphers (RC4, DES, EXPORT, NULL, ANON) in server config.',
    });
  } else {
    findings.push({
      category: 'TLS',
      check: 'Cipher Strength',
      status: 'pass',
      severity: 'info',
      message: `Cipher: ${detail.cipher} (${detail.cipherVersion})`,
    });
  }

  // Negotiated protocol — match exactly to avoid false positives on TLSv1.2/TLSv1.3
  const proto = detail!.protocol.trim();
  const isDeprecatedNegotiated = DEPRECATED_PROTOCOLS.some(
    (p) => proto === p || proto.toLowerCase() === p.toLowerCase()
  );
  if (isDeprecatedNegotiated) {
    findings.push({
      category: 'TLS',
      check: 'Negotiated Protocol',
      status: 'fail',
      severity: 'high',
      message: `Deprecated protocol negotiated: ${detail.protocol}`,
      recommendation: 'Configure server to use TLS 1.2+ only.',
    });
  } else {
    findings.push({
      category: 'TLS',
      check: 'Negotiated Protocol',
      status: 'pass',
      severity: 'info',
      message: `Protocol: ${detail.protocol}`,
    });
  }

  // ── Probe for legacy protocol support ────────────────────────────────────────
  logger.debug('Probing for deprecated protocol support (TLS 1.0, 1.1)...');

  const tls10Supported = await probeProtocol(hostname, port, 'TLSv1' as tls.SecureVersion);
  findings.push({
    category: 'TLS',
    check: 'TLS 1.0 Support',
    status: tls10Supported ? 'fail' : 'pass',
    severity: tls10Supported ? 'high' : 'info',
    message: tls10Supported
      ? 'Server accepts TLS 1.0 (deprecated, vulnerable to BEAST/POODLE)'
      : 'TLS 1.0 not accepted ✓',
    recommendation: tls10Supported
      ? 'Disable TLS 1.0 in your server/CDN configuration.'
      : undefined,
  });

  const tls11Supported = await probeProtocol(hostname, port, 'TLSv1.1' as tls.SecureVersion);
  findings.push({
    category: 'TLS',
    check: 'TLS 1.1 Support',
    status: tls11Supported ? 'warn' : 'pass',
    severity: tls11Supported ? 'medium' : 'info',
    message: tls11Supported
      ? 'Server accepts TLS 1.1 (deprecated by RFC 8996)'
      : 'TLS 1.1 not accepted ✓',
    recommendation: tls11Supported
      ? 'Disable TLS 1.1 in your server/CDN configuration.'
      : undefined,
  });

  return findings;
}
