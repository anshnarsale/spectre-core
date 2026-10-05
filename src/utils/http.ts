import https from 'https';
import http from 'http';
import { URL } from 'url';

export interface SimpleResponse {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: string;
  redirectChain: string[];
  finalUrl: string;
  durationMs: number;
}

/**
 * Minimal fetch wrapper using Node's built-in http/https.
 * Does NOT follow redirects automatically (so we can capture the chain).
 */
export function simpleGet(
  rawUrl: string,
  options: {
    timeout?: number;
    followRedirects?: boolean;
    maxRedirects?: number;
    headers?: Record<string, string>;
    rejectUnauthorized?: boolean;
  } = {}
): Promise<SimpleResponse> {
  const {
    timeout = 10_000,
    followRedirects = true,
    maxRedirects = 10,
    headers = {},
    rejectUnauthorized = true,
  } = options;

  return new Promise((resolve, reject) => {
    const redirectChain: string[] = [];
    const startTime = Date.now();

    const doRequest = (urlStr: string, redirectsLeft: number) => {
      let url: URL;
      try {
        url = new URL(urlStr);
      } catch {
        return reject(new Error(`Invalid URL: ${urlStr}`));
      }

      const mod = url.protocol === 'https:' ? https : http;
      const opts = {
        hostname: url.hostname,
        port: url.port ? parseInt(url.port) : url.protocol === 'https:' ? 443 : 80,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'User-Agent': 'site-auditor/1.0 (local-testing)',
          ...headers,
        },
        timeout,
        rejectUnauthorized,
      };

      const req = mod.request(opts, (res) => {
        const sc = res.statusCode ?? 0;

        if (
          followRedirects &&
          [301, 302, 303, 307, 308].includes(sc) &&
          res.headers.location &&
          redirectsLeft > 0
        ) {
          redirectChain.push(urlStr);
          const next = new URL(res.headers.location, urlStr).toString();
          res.resume(); // consume body
          return doRequest(next, redirectsLeft - 1);
        }

        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          resolve({
            statusCode: sc,
            headers: res.headers as Record<string, string | string[]>,
            body: Buffer.concat(chunks).toString('utf8'),
            redirectChain,
            finalUrl: urlStr,
            durationMs: Date.now() - startTime,
          });
        });
        res.on('error', reject);
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timed out: ${urlStr}`));
      });
      req.end();
    };

    doRequest(rawUrl, maxRedirects);
  });
}

/**
 * HEAD request for quick status/header checks.
 */
export function simpleHead(
  rawUrl: string,
  options: { timeout?: number; rejectUnauthorized?: boolean } = {}
): Promise<{ statusCode: number; headers: Record<string, string | string[]>; durationMs: number }> {
  const { timeout = 8_000, rejectUnauthorized = true } = options;

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return reject(new Error(`Invalid URL: ${rawUrl}`));
    }

    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request(
      {
        hostname: url.hostname,
        port: url.port ? parseInt(url.port) : url.protocol === 'https:' ? 443 : 80,
        path: url.pathname + url.search,
        method: 'HEAD',
        headers: { 'User-Agent': 'site-auditor/1.0 (local-testing)' },
        timeout,
        rejectUnauthorized,
      },
      (res) => {
        res.resume();
        resolve({
          statusCode: res.statusCode ?? 0,
          headers: res.headers as Record<string, string | string[]>,
          durationMs: Date.now() - startTime,
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('HEAD timed out'));
    });
    req.end();
  });
}
