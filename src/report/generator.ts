import fs from 'fs';
import path from 'path';
import { CombinedReport, Finding, LoadTestMetrics, SecurityReport, LighthouseReport } from '../types';

function severityColor(sev: string): string {
  switch (sev) {
    case 'critical': return '#b91c1c';
    case 'high': return '#dc2626';
    case 'medium': return '#d97706';
    case 'low': return '#2563eb';
    case 'info': return '#6b7280';
    default: return '#6b7280';
  }
}

function statusBadge(status: string): string {
  const colors: Record<string, string> = {
    pass: '#16a34a',
    fail: '#dc2626',
    warn: '#d97706',
    info: '#6b7280',
  };
  const color = colors[status] ?? '#6b7280';
  return `<span style="background:${color};color:white;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;text-transform:uppercase">${status}</span>`;
}

function scoreCircle(score: number, label: string): string {
  if (score < 0) return `
    <div style="text-align:center">
      <div style="width:80px;height:80px;border-radius:50%;background:#374151;display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:12px;color:#9ca3af">N/A</div>
      <div style="margin-top:8px;font-size:13px;color:#9ca3af">${label}</div>
    </div>`;
  const color = score >= 90 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626';
  const pct = score / 100;
  const circ = 2 * Math.PI * 36;
  const dash = pct * circ;
  return `
    <div style="text-align:center">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="36" fill="none" stroke="#374151" stroke-width="6"/>
        <circle cx="40" cy="40" r="36" fill="none" stroke="${color}" stroke-width="6"
          stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"
          stroke-linecap="round"
          transform="rotate(-90 40 40)"/>
        <text x="40" y="46" text-anchor="middle" font-size="18" font-weight="bold" fill="${color}">${score}</text>
      </svg>
      <div style="margin-top:8px;font-size:13px;color:#9ca3af">${label}</div>
    </div>`;
}

function findingsTable(findings: Finding[], title: string): string {
  if (findings.length === 0) return '';
  return `
    <div class="section">
      <h2>${title}</h2>
      <table>
        <thead>
          <tr>
            <th>Check</th>
            <th>Status</th>
            <th>Severity</th>
            <th>Message</th>
            <th>Recommendation</th>
          </tr>
        </thead>
        <tbody>
          ${findings.map((f) => `
            <tr>
              <td><code>${f.check}</code></td>
              <td>${statusBadge(f.status)}</td>
              <td><span style="color:${severityColor(f.severity)};font-weight:600">${f.severity}</span></td>
              <td>
                ${f.message}
                ${f.detail ? `<br><small style="color:#9ca3af">${f.detail}</small>` : ''}
              </td>
              <td style="color:#60a5fa;font-size:12px">${f.recommendation ?? '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

function loadTestSection(metrics: LoadTestMetrics): string {
  const { latency, errorRate, requestsPerSec, totalRequests, statusCodes } = metrics;
  const errColor = errorRate > 0.05 ? '#dc2626' : errorRate > 0.01 ? '#d97706' : '#16a34a';

  const latencyData = [
    { label: 'p50', value: latency.p50, color: '#16a34a' },
    { label: 'p75', value: latency.p75, color: '#22c55e' },
    { label: 'p95', value: latency.p95, color: '#d97706' },
    { label: 'p99', value: latency.p99, color: '#dc2626' },
  ];
  const maxLatency = Math.max(...latencyData.map((d) => d.value), 1);

  return `
    <div class="section">
      <h2>Load Test — ${metrics.type.toUpperCase()}</h2>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px">
        <div class="stat-card">
          <div class="stat-value">${totalRequests.toLocaleString()}</div>
          <div class="stat-label">Total Requests</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${requestsPerSec.toFixed(1)}</div>
          <div class="stat-label">Avg Req/sec</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:${errColor}">${(errorRate * 100).toFixed(2)}%</div>
          <div class="stat-label">Error Rate</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${latency.mean.toFixed(0)}ms</div>
          <div class="stat-label">Mean Latency</div>
        </div>
      </div>

      <h3>Latency Breakdown</h3>
      <div style="margin:16px 0">
        ${latencyData.map((d) => `
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
            <div style="width:36px;font-size:12px;color:#9ca3af;text-align:right">${d.label}</div>
            <div style="flex:1;background:#1f2937;border-radius:6px;height:20px;overflow:hidden">
              <div style="width:${Math.min(100, (d.value / maxLatency) * 100).toFixed(1)}%;background:${d.color};height:100%;border-radius:6px;transition:width 0.3s"></div>
            </div>
            <div style="width:60px;font-size:13px;font-weight:600;color:${d.color}">${d.value.toFixed(1)}ms</div>
          </div>
        `).join('')}
      </div>

      <h3>Status Codes</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        ${Object.entries(statusCodes).map(([code, count]) => `
          <div class="stat-card" style="min-width:80px">
            <div class="stat-value" style="font-size:20px">${count.toLocaleString()}</div>
            <div class="stat-label">${code}</div>
          </div>
        `).join('')}
      </div>
    </div>`;
}

function lighthouseSection(lh: LighthouseReport): string {
  return `
    <div class="section">
      <h2>Lighthouse / Performance Scores</h2>
      <div style="display:flex;gap:32px;justify-content:center;flex-wrap:wrap;margin:24px 0">
        ${scoreCircle(lh.scores.performance, 'Performance')}
        ${scoreCircle(lh.scores.accessibility, 'Accessibility')}
        ${scoreCircle(lh.scores.bestPractices, 'Best Practices')}
        ${scoreCircle(lh.scores.seo, 'SEO')}
      </div>
      ${lh.opportunities.length > 0 ? `
        <h3>Opportunities</h3>
        <ul>
          ${lh.opportunities.map((o) => `
            <li>
              <strong>${o.title}</strong>${o.savings ? ` — <em>${o.savings}</em>` : ''}
              <br><small style="color:#9ca3af">${o.description}</small>
            </li>
          `).join('')}
        </ul>
      ` : ''}
      ${lh.rawPath ? `<p><a href="${lh.rawPath}" style="color:#60a5fa">📊 View full Lighthouse HTML report</a></p>` : ''}
    </div>`;
}

function securitySummaryBar(sec: SecurityReport): string {
  const total = sec.summary.total;
  const pass = sec.summary.pass;
  const fail = sec.summary.fail;
  const warn = sec.summary.warn;
  const pPass = ((pass / total) * 100).toFixed(0);
  const pWarn = ((warn / total) * 100).toFixed(0);
  const pFail = ((fail / total) * 100).toFixed(0);

  return `
    <div class="section">
      <h2>Security Overview</h2>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px">
        <div class="stat-card" style="border-color:#16a34a">
          <div class="stat-value" style="color:#16a34a">${pass}</div>
          <div class="stat-label">Passed</div>
        </div>
        <div class="stat-card" style="border-color:#d97706">
          <div class="stat-value" style="color:#d97706">${warn}</div>
          <div class="stat-label">Warnings</div>
        </div>
        <div class="stat-card" style="border-color:#dc2626">
          <div class="stat-value" style="color:#dc2626">${fail}</div>
          <div class="stat-label">Failed</div>
        </div>
      </div>
      <div style="height:12px;border-radius:6px;overflow:hidden;display:flex;gap:1px">
        <div style="width:${pPass}%;background:#16a34a" title="${pPass}% passed"></div>
        <div style="width:${pWarn}%;background:#d97706" title="${pWarn}% warnings"></div>
        <div style="width:${pFail}%;background:#dc2626" title="${pFail}% failed"></div>
      </div>
    </div>`;
}

export function generateHtmlReport(report: CombinedReport, outputPath: string): void {
  const { meta, security, loadTests, lighthouse } = report;

  const allFindings: Finding[] = [
    ...(security?.headers ?? []),
    ...(security?.tls ?? []),
    ...(security?.exposedFiles ?? []),
    ...(security?.dns ?? []),
  ];

  const criticalFindings = allFindings.filter(
    (f) => (f.status === 'fail' || f.status === 'warn') && (f.severity === 'high' || f.severity === 'critical')
  );

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Site Audit Report — ${meta.target}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      line-height: 1.6;
    }

    .header {
      background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 60%);
      border-bottom: 1px solid #1e293b;
      padding: 40px 48px;
    }

    .header h1 {
      font-size: 28px;
      font-weight: 700;
      color: #f1f5f9;
      margin-bottom: 4px;
    }

    .header .meta {
      color: #64748b;
      font-size: 14px;
    }

    .header .target {
      color: #60a5fa;
      font-family: 'JetBrains Mono', monospace;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 32px 48px;
    }

    .section {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 28px;
      margin-bottom: 24px;
    }

    .section h2 {
      font-size: 18px;
      font-weight: 600;
      color: #f1f5f9;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 1px solid #334155;
    }

    .section h3 {
      font-size: 14px;
      font-weight: 600;
      color: #94a3b8;
      margin: 20px 0 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    th {
      background: #0f172a;
      color: #64748b;
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    td {
      padding: 12px;
      border-bottom: 1px solid #1e293b;
      vertical-align: top;
    }

    tr:hover td { background: #0f172a33; }

    code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #a78bfa;
    }

    .stat-card {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 10px;
      padding: 16px;
      text-align: center;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: #f1f5f9;
      line-height: 1.2;
    }

    .stat-label {
      font-size: 12px;
      color: #64748b;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .alert-card {
      background: #450a0a;
      border: 1px solid #991b1b;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }

    .alert-card h3 {
      color: #fca5a5;
      margin: 0 0 8px;
    }

    .alert-card li {
      color: #fca5a5;
      margin-left: 20px;
      font-size: 13px;
    }

    ul { padding-left: 20px; }
    li { margin-bottom: 8px; }

    a { color: #60a5fa; }

    .badge-run {
      background: #1d4ed8;
      color: white;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-family: 'JetBrains Mono', monospace;
    }

    footer {
      text-align: center;
      padding: 32px;
      color: #374151;
      font-size: 12px;
      border-top: 1px solid #1e293b;
    }
  </style>
</head>
<body>

  <div class="header">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px">
      <div>
        <h1>🔍 Site Audit Report</h1>
        <div class="meta">
          Target: <span class="target">${meta.target}</span> &nbsp;|&nbsp;
          Run: <span class="badge-run">${meta.runId}</span> &nbsp;|&nbsp;
          ${new Date(meta.timestamp).toLocaleString()}
        </div>
      </div>
      <div style="text-align:right;font-size:13px;color:#64748b">
        <div>Duration: ${(meta.durationMs / 1000).toFixed(1)}s</div>
        <div>${meta.tool} v${meta.version}</div>
      </div>
    </div>
  </div>

  <div class="container">

    ${criticalFindings.length > 0 ? `
    <div class="alert-card">
      <h3>⚠ ${criticalFindings.length} High/Critical Finding(s) Require Attention</h3>
      <ul>
        ${criticalFindings.map((f) => `<li><strong>${f.check}:</strong> ${f.message}</li>`).join('')}
      </ul>
    </div>` : ''}

    ${security ? securitySummaryBar(security) : ''}
    ${security ? findingsTable(security.headers, '🛡 HTTP Security Headers') : ''}
    ${security ? findingsTable(security.tls, '🔒 TLS / Certificate') : ''}
    ${security ? findingsTable(security.exposedFiles, '📁 Exposed Files') : ''}
    ${security ? findingsTable(security.dns, '🌐 DNS & Dependency Scan') : ''}

    ${lighthouse ? lighthouseSection(lighthouse) : ''}

    ${(loadTests ?? []).map(loadTestSection).join('')}

  </div>

  <footer>
    Generated by ${meta.tool} v${meta.version} &nbsp;·&nbsp;
    This report is confidential and intended for authorized testing only.
  </footer>

</body>
</html>`;

  fs.writeFileSync(outputPath, html, 'utf8');
}

export function generateJsonReport(report: CombinedReport, outputPath: string): void {
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
}
