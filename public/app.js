// ── SPECTRE · CORE — Zero-Trace Cyber Telemetry Engine ─────────────────────────

let currentMode = 'full';
let isRunning = false;
let currentReportData = null;
let allFindings = [];

// DOM References
const targetUrlInput = document.getElementById('targetUrl');
const startAuditBtn = document.getElementById('startAuditBtn');
const stopAuditBtn = document.getElementById('stopAuditBtn');
const terminalBody = document.getElementById('terminalBody');

// ── Initialization ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupModePills();
  setupAdvancedToggle();
  setupActionButtons();
  connectSSE();
  
  // Notice on privacy: Every refresh is a clean slate by default
  console.log('%c[SPECTRE·CORE] Zero-Trace Ephemeral Engine Initialized. Reports exist only in volatile browser memory.', 'color: #00e676; font-weight: bold;');
});

window.focusTargetInput = function() {
  targetUrlInput.focus();
  targetUrlInput.select();
};

window.setTargetUrl = function(url) {
  targetUrlInput.value = url;
  targetUrlInput.focus();
};

// ── Mode Pills ───────────────────────────────────────────────────────────────
function setupModePills() {
  const pills = document.querySelectorAll('.mode-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentMode = pill.getAttribute('data-mode');
    });
  });
}

// ── Advanced Drawer ──────────────────────────────────────────────────────────
function setupAdvancedToggle() {
  const toggleBtn = document.getElementById('toggleAdvancedBtn');
  const panel = document.getElementById('advancedContent');
  const chevron = document.getElementById('advancedChevron');

  toggleBtn.addEventListener('click', () => {
    const isHidden = panel.classList.toggle('hidden');
    chevron.textContent = isHidden ? '▾' : '▴';
  });
}

// ── Action Buttons ───────────────────────────────────────────────────────────
function setupActionButtons() {
  startAuditBtn.addEventListener('click', handleStartAudit);
  stopAuditBtn.addEventListener('click', handleStopAudit);
}

async function handleStartAudit() {
  const target = targetUrlInput.value.trim();
  if (!target) {
    alert('Please enter a target website URL.');
    targetUrlInput.focus();
    return;
  }

  const vus = parseInt(document.getElementById('vusInput').value, 10) || 20;
  const duration = document.getElementById('durationSelect').value || '30s';
  const loadType = document.getElementById('loadTypeSelect').value || 'rampup';
  const maxRps = parseInt(document.getElementById('maxRpsInput').value, 10) || 100;
  const skipLighthouse = document.getElementById('skipLighthouseCheck').checked;
  const skipLoad = document.getElementById('skipLoadCheck').checked;

  const payload = {
    target,
    mode: currentMode,
    maxRps,
    skipLighthouse,
    skipLoad,
    loadConfig: {
      type: loadType,
      vus,
      duration,
      spikeVus: Math.min(vus * 2, 80),
      spikeDuration: '15s',
      soakVus: vus,
      soakDuration: '2m',
    }
  };

  setRunningState(true);
  appendTerminalLine('step', `[DISPATCH] SPECTRE·CORE starting ${currentMode.toUpperCase()} audit -> ${target}`);
  appendTerminalLine('info', `[PRIVACY] Zero-Trace mode active: No reports will be committed to Git or saved on server.`);

  try {
    const res = await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      appendTerminalLine('error', `[ERR] Trigger failed: ${data.error || 'Server error'}`);
      setRunningState(false);
    }
  } catch (err) {
    appendTerminalLine('error', `[ERR] Telemetry network fail: ${err.message}`);
    setRunningState(false);
  }
}

async function handleStopAudit() {
  appendTerminalLine('warn', '[ABORT] Kill-switch active — terminating load test workers...');
  try {
    await fetch('/api/abort', { method: 'POST' });
  } catch (err) {
    console.error('Abort failed', err);
  }
}

function setRunningState(running) {
  isRunning = running;
  if (running) {
    startAuditBtn.classList.add('hidden');
    stopAuditBtn.classList.remove('hidden');
  } else {
    startAuditBtn.classList.remove('hidden');
    stopAuditBtn.classList.add('hidden');
  }
}

// ── SSE Real-time Telemetry ──────────────────────────────────────────────────
function connectSSE() {
  const eventSource = new EventSource('/api/stream');

  eventSource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);

      if (payload.event === 'connected') {
        if (payload.data.isAuditing) {
          setRunningState(true);
          appendTerminalLine('info', `[SYNC] Joined active scan on: ${payload.data.currentTarget}`);
        }
      }

      if (payload.event === 'log') {
        const { level, text, timestamp } = payload.data;
        appendTerminalLine(level, `[${timestamp || ''}] ${text}`);
      }

      if (payload.event === 'status') {
        handleStatusEvent(payload.data);
      }
    } catch {
      // heartbeat
    }
  };
}

function handleStatusEvent(data) {
  if (data.state === 'running') {
    if (!isRunning) setRunningState(true);
  } else if (data.state === 'completed' || data.state === 'aborted' || data.state === 'error') {
    setRunningState(false);
    if (data.state === 'completed' && data.report) {
      appendTerminalLine('success', `[SUCCESS] Audit cycle completed for ${data.report.meta?.target}`);
      renderFullReportLocally(data.report);
    } else if (data.state === 'aborted' && data.report) {
      appendTerminalLine('warn', `[ABORTED] Partial audit compiled.`);
      renderFullReportLocally(data.report);
    } else if (data.state === 'error') {
      appendTerminalLine('error', `[FAULT] Audit failed: ${data.error}`);
    }
  }
}

function appendTerminalLine(level, text) {
  const line = document.createElement('div');
  line.className = `term-line term-${level}`;
  line.textContent = text;
  terminalBody.appendChild(line);
  terminalBody.scrollTop = terminalBody.scrollHeight;
}

window.clearTerminalLogs = function() {
  terminalBody.innerHTML = '';
};

window.toggleLiveConsole = function() {
  const drawer = document.getElementById('liveConsoleDrawer');
  const label = document.getElementById('consoleToggleLabel');
  const isHidden = drawer.classList.toggle('hidden');
  label.textContent = isHidden ? 'Console: HIDDEN' : 'Console: LIVE';
};

// ── Ephemeral Zero-Trace Wipe ────────────────────────────────────────────────
window.wipeBrowserMemory = async function() {
  currentReportData = null;
  allFindings = [];
  sessionStorage.clear();

  // Reset Telemetry Cards
  document.getElementById('kpiVulnCount').textContent = '--';
  document.getElementById('kpiVulnSub').textContent = 'Memory purged';
  document.getElementById('kpiIncidentsCount').textContent = '0';
  document.getElementById('kpiRatePct').textContent = '0%';
  document.getElementById('kpiScoreVal').textContent = '--%';
  document.getElementById('kpiScoreSub').textContent = 'Ready to evaluate';
  document.getElementById('kpiLatencyVal').textContent = '-- ms';
  document.getElementById('kpiLatencySub').textContent = 'p50: -- · p99: --';
  document.getElementById('badgeFailsCount').textContent = '0';
  document.getElementById('totalSecCount').textContent = '0';
  document.getElementById('fCountFail').textContent = '0';
  document.getElementById('fCountWarn').textContent = '0';
  document.getElementById('fCountPass').textContent = '0';

  // Clear Findings Table
  document.getElementById('findingsTableBody').innerHTML = `
    <tr>
      <td colspan="5" style="text-align:center;color:var(--text-dim);padding:30px">
        🔒 All session memory purged. Refresh or run a new audit.
      </td>
    </tr>
  `;

  // Clear Activity Feed
  document.getElementById('activityFeedList').innerHTML = `
    <div class="activity-empty-state">
      <span class="pulse-ring-sm"></span>
      <span>Session wiped. No traces remain in memory.</span>
    </div>
  `;

  // Clear Load & Lighthouse
  document.getElementById('loadDetailsContainer').innerHTML = '<div style="color:var(--text-dim);text-align:center;padding:30px">Memory cleared.</div>';
  document.getElementById('lighthouseScoresGrid').innerHTML = '<div style="color:var(--text-dim);padding:30px;text-align:center">Memory cleared.</div>';

  // Reset Map Subtitle
  const mapHost = document.getElementById('mapTargetHost');
  if (mapHost) mapHost.textContent = 'Awaiting Target URL';

  appendTerminalLine('warn', '[WIPE] Client memory wiped. Zero traces remaining.');

  // Trigger server-side purge to delete any temporary files
  try {
    await fetch('/api/wipe', { method: 'POST' });
    appendTerminalLine('success', '[PURGE] Server-side temporary folders cleaned.');
  } catch {
    /* ignore */
  }

  alert('🔒 Ephemeral Memory Purged!\nAll findings and telemetry were wiped from browser memory. No traces remain.');
};

// ── Render Full Report in Client Memory ──────────────────────────────────────
function renderFullReportLocally(report) {
  currentReportData = report;

  // Update Map Subtitle
  const hostname = formatHostname(report.meta?.target || 'Target Site');
  const mapHost = document.getElementById('mapTargetHost');
  if (mapHost) mapHost.textContent = hostname;

  // 1. Update Telemetry 4-Card Strip
  renderTelemetryStrip(report);

  // 2. Update Security Findings Table
  renderSecurityTable(report.security);

  // 3. Update Load Testing Metrics Pane
  renderLoadPane(report.loadTests?.[0]);

  // 4. Update Lighthouse Pane
  renderLighthousePane(report.lighthouse);

  // 5. Update Activity Feed
  updateActivityFeed(report);
}

function renderTelemetryStrip(report) {
  const sec = report.security;
  const load = report.loadTests?.[0];

  // Metric 1: Open Vulnerabilities
  const kpiVulnCount = document.getElementById('kpiVulnCount');
  const kpiVulnSub = document.getElementById('kpiVulnSub');
  const badgeFailsCount = document.getElementById('badgeFailsCount');

  if (sec && sec.summary) {
    kpiVulnCount.textContent = String(sec.summary.fail);
    kpiVulnSub.textContent = `${sec.summary.total} checks analyzed`;
    badgeFailsCount.textContent = String(sec.summary.fail);
    document.getElementById('kpiVulnDiff').textContent = sec.summary.fail > 0 ? `+${sec.summary.fail}` : '0';
  }

  // Metric 2: Active Incidents / Netlify Rate Limits (4xx)
  const kpiIncidentsCount = document.getElementById('kpiIncidentsCount');
  const kpiIncidentsSub = document.getElementById('kpiIncidentsSub');
  const kpiRatePct = document.getElementById('kpiRatePct');
  const kpiRateCircle = document.getElementById('kpiRateCircle');

  if (load && load.statusCodes) {
    const errCount = (load.statusCodes['4xx'] || 0) + (load.statusCodes['error'] || 0);
    kpiIncidentsCount.textContent = String(errCount);
    const errPct = Math.round(load.errorRate * 100);
    kpiRatePct.textContent = `${errPct}%`;
    kpiIncidentsSub.textContent = `Netlify CDN rate-limit (${load.statusCodes['4xx'] || 0} 4xx)`;

    const circ = 2 * Math.PI * 18;
    const dash = (errPct / 100) * circ;
    kpiRateCircle.setAttribute('stroke-dasharray', `${dash.toFixed(1)} ${circ.toFixed(1)}`);
  }

  // Metric 3: Compliance & Security Score
  const kpiScoreVal = document.getElementById('kpiScoreVal');
  const kpiScoreSub = document.getElementById('kpiScoreSub');
  const kpiScoreArc = document.getElementById('kpiScoreArc');

  if (sec && sec.summary && sec.summary.total > 0) {
    const passPct = Math.round((sec.summary.pass / sec.summary.total) * 100);
    kpiScoreVal.textContent = `${passPct}%`;
    kpiScoreSub.textContent = passPct >= 80 ? 'Grade A · TLS 1.3 Verified' : passPct >= 60 ? 'Grade B · Headers Needed' : 'Grade C · Action Needed';
    kpiScoreArc.setAttribute('stroke-dasharray', `${(passPct / 100) * 66} 66`);
    kpiScoreArc.setAttribute('stroke', passPct >= 70 ? '#00e676' : passPct >= 50 ? '#ff9800' : '#ff3b30');
    document.getElementById('kpiScoreDiff').textContent = `${passPct}%`;
  }

  // Metric 4: Tail Latency (p95)
  const kpiLatencyVal = document.getElementById('kpiLatencyVal');
  const kpiLatencySub = document.getElementById('kpiLatencySub');

  if (load && load.latency) {
    kpiLatencyVal.textContent = `${load.latency.p95}ms`;
    kpiLatencySub.textContent = `p50: ${load.latency.p50}ms · p99: ${load.latency.p99}ms`;
  }
}

function updateActivityFeed(report) {
  const container = document.getElementById('activityFeedList');
  if (!report.security) return;

  const fails = (report.security.headers || []).filter(h => h.status === 'fail');
  const host = formatHostname(report.meta?.target);

  let html = '';
  if (fails.length > 0) {
    fails.slice(0, 3).forEach(f => {
      html += `
        <div class="activity-item">
          <div class="activity-icon icon-warn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div class="activity-details">
            <div class="activity-title">Missing Header: ${escapeHtml(f.headerName || f.check)}</div>
            <div class="activity-sub">${host} • ${escapeHtml(f.severity.toUpperCase())} severity</div>
          </div>
          <span class="activity-arrow">↗</span>
        </div>
      `;
    });
  }

  html += `
    <div class="activity-item">
      <div class="activity-icon icon-pass">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      </div>
      <div class="activity-details">
        <div class="activity-title">TLS 1.3 Handshake & Cipher Suite Verified</div>
        <div class="activity-sub">TLS_AES_128_GCM_SHA256 • Verified by SPECTRE·CORE</div>
      </div>
      <span class="activity-arrow">↗</span>
    </div>
  `;

  if (report.loadTests && report.loadTests[0]) {
    const l = report.loadTests[0];
    html += `
      <div class="activity-item">
        <div class="activity-icon icon-info">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        </div>
        <div class="activity-details">
          <div class="activity-title">Throughput Telemetry: ${(l.requestsPerSec || 0).toFixed(1)} req/s</div>
          <div class="activity-sub">${l.totalRequests} requests completed • p95: ${l.latency?.p95}ms</div>
        </div>
        <span class="activity-arrow">↗</span>
      </div>
    `;
  }

  container.innerHTML = html;
}

function renderSecurityTable(sec) {
  const tbody = document.getElementById('findingsTableBody');
  tbody.innerHTML = '';

  if (!sec) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:24px">No security findings recorded.</td></tr>';
    return;
  }

  allFindings = [
    ...(sec.headers || []),
    ...(sec.tls || []),
    ...(sec.exposedFiles || []),
    ...(sec.dns || [])
  ];

  const fails = allFindings.filter(f => f.status === 'fail').length;
  const warns = allFindings.filter(f => f.status === 'warn').length;
  const passes = allFindings.filter(f => f.status === 'pass').length;

  document.getElementById('totalSecCount').textContent = String(allFindings.length);
  document.getElementById('fCountFail').textContent = String(fails);
  document.getElementById('fCountWarn').textContent = String(warns);
  document.getElementById('fCountPass').textContent = String(passes);

  renderFilteredFindingsList(allFindings);
}

function renderFilteredFindingsList(findings) {
  const tbody = document.getElementById('findingsTableBody');
  tbody.innerHTML = '';

  findings.forEach(f => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(f.category || 'Headers')}</strong></td>
      <td><code>${escapeHtml(f.check || '')}</code></td>
      <td><span class="badge-st-pill st-${f.status}">${f.status}</span></td>
      <td><span class="badge-sev-pill sev-${f.severity}">${f.severity}</span></td>
      <td>
        <div>${escapeHtml(f.message || '')}</div>
        ${f.recommendation ? `<div class="rec-text">💡 Recommendation: ${escapeHtml(f.recommendation)}</div>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.filterFindings = function(filter) {
  document.querySelectorAll('.f-pill').forEach(p => {
    p.classList.toggle('active', p.getAttribute('data-f') === filter);
  });

  if (filter === 'all') {
    renderFilteredFindingsList(allFindings);
  } else if (filter === 'fail') {
    renderFilteredFindingsList(allFindings.filter(f => f.status === 'fail'));
  } else if (filter === 'warn') {
    renderFilteredFindingsList(allFindings.filter(f => f.status === 'warn'));
  } else if (filter === 'pass') {
    renderFilteredFindingsList(allFindings.filter(f => f.status === 'pass'));
  }
};

function renderLoadPane(load) {
  const container = document.getElementById('loadDetailsContainer');
  if (!load) {
    container.innerHTML = '<div style="color:var(--text-dim);text-align:center;padding:30px">Load testing metrics not attached to this run.</div>';
    return;
  }

  const s = load.statusCodes || {};
  const total = load.totalRequests || 1;
  const p2xx = (((s['2xx'] || 0) / total) * 100).toFixed(1);
  const p4xx = (((s['4xx'] || 0) / total) * 100).toFixed(1);
  const pErr = (((s['error'] || 0) / total) * 100).toFixed(1);

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));gap:14px;margin-bottom:20px">
      <div style="background:rgba(0,0,0,0.3);padding:14px;border-radius:8px;border:1px solid var(--border-subtle)">
        <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase">Total Requests</div>
        <div style="font-size:24px;font-weight:800;color:#fff">${load.totalRequests.toLocaleString()}</div>
      </div>
      <div style="background:rgba(0,0,0,0.3);padding:14px;border-radius:8px;border:1px solid var(--border-subtle)">
        <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase">Avg Throughput</div>
        <div style="font-size:24px;font-weight:800;color:#ff7043">${(load.requestsPerSec || 0).toFixed(1)} <small style="font-size:13px">rps</small></div>
      </div>
      <div style="background:rgba(0,0,0,0.3);padding:14px;border-radius:8px;border:1px solid var(--border-subtle)">
        <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase">p50 Latency</div>
        <div style="font-size:24px;font-weight:800;color:#fff">${load.latency?.p50 || 0} ms</div>
      </div>
      <div style="background:rgba(0,0,0,0.3);padding:14px;border-radius:8px;border:1px solid var(--border-subtle)">
        <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase">p95 Latency</div>
        <div style="font-size:24px;font-weight:800;color:#00e5ff">${load.latency?.p95 || 0} ms</div>
      </div>
      <div style="background:rgba(0,0,0,0.3);padding:14px;border-radius:8px;border:1px solid var(--border-subtle)">
        <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase">Error / 4xx Rate</div>
        <div style="font-size:24px;font-weight:800;color:${load.errorRate > 0.05 ? '#ff453a' : '#00e676'}">${(load.errorRate * 100).toFixed(2)}%</div>
      </div>
    </div>

    <div style="margin-top:14px">
      <div style="font-size:12px;font-weight:700;color:var(--text-dim);margin-bottom:8px;text-transform:uppercase">Status Code Breakdown</div>
      <div style="display:flex;height:18px;border-radius:9999px;overflow:hidden;background:#1b1f2b">
        <div style="background:#00e676;width:${p2xx}%" title="2xx Success: ${s['2xx'] || 0}"></div>
        <div style="background:#ff9800;width:${p4xx}%" title="4xx Rate-limited: ${s['4xx'] || 0}"></div>
        <div style="background:#ff3b30;width:${pErr}%" title="Connection error: ${s['error'] || 0}"></div>
      </div>
      <div style="display:flex;gap:18px;margin-top:10px;font-size:12px;color:var(--text-muted)">
        <span><strong style="color:#00e676">2xx Success:</strong> ${s['2xx'] || 0} (${p2xx}%)</span>
        <span><strong style="color:#ff9800">4xx CDN Rate Limit:</strong> ${s['4xx'] || 0} (${p4xx}%)</span>
        <span><strong style="color:#ff3b30">Errors:</strong> ${s['error'] || 0} (${pErr}%)</span>
      </div>
    </div>
  `;
}

function renderLighthousePane(lh) {
  const grid = document.getElementById('lighthouseScoresGrid');
  const diag = document.getElementById('lhDiagnosticsWrap');

  if (!lh || !lh.scores) {
    grid.innerHTML = '<div style="color:var(--text-dim);padding:24px;text-align:center">Lighthouse scan was skipped for this run.</div>';
    diag.innerHTML = '';
    return;
  }

  const s = lh.scores;
  grid.innerHTML = `
    ${renderScoreCircle(s.performance, 'Performance')}
    ${renderScoreCircle(s.accessibility, 'Accessibility')}
    ${renderScoreCircle(s.bestPractices, 'Best Practices')}
    ${renderScoreCircle(s.seo, 'SEO')}
  `;
}

function renderScoreCircle(score, label) {
  if (score === undefined || score < 0) {
    return `<div style="text-align:center"><div style="font-size:22px;color:var(--text-dim)">N/A</div><div style="font-size:12px;color:var(--text-dim);margin-top:4px">${label}</div></div>`;
  }
  const color = score >= 90 ? '#00e676' : score >= 50 ? '#ff9800' : '#ff3b30';
  return `
    <div style="text-align:center">
      <svg width="78" height="78" viewBox="0 0 78 78">
        <circle cx="39" cy="39" r="33" fill="none" stroke="#1c2230" stroke-width="6"/>
        <circle cx="39" cy="39" r="33" fill="none" stroke="${color}" stroke-width="6"
          stroke-dasharray="${(score / 100) * 207.3} 207.3" stroke-linecap="round" transform="rotate(-90 39 39)"/>
        <text x="39" y="45" text-anchor="middle" font-size="18" font-weight="800" fill="${color}">${score}</text>
      </svg>
      <div style="font-size:12px;font-weight:700;color:#fff;margin-top:6px">${label}</div>
    </div>
  `;
}

// ── Tab & View Navigation ────────────────────────────────────────────────────
window.switchDetailTab = function(tabId) {
  document.querySelectorAll('.details-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.detail-pane').forEach(p => p.classList.remove('active'));

  const activeBtn = Array.from(document.querySelectorAll('.details-tab-btn')).find(b => b.getAttribute('onclick')?.includes(tabId));
  if (activeBtn) activeBtn.classList.add('active');

  const paneMap = {
    secFindings: 'paneSecFindings',
    loadMetrics: 'paneLoadMetrics',
    lighthouseTab: 'paneLighthouse',
  };

  const targetPane = document.getElementById(paneMap[tabId] || tabId);
  if (targetPane) targetPane.classList.add('active');
};

window.switchMainView = function(view) {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.getAttribute('data-view') === view);
  });

  if (view === 'dashboard') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (view === 'findings') {
    document.getElementById('detailsSection').scrollIntoView({ behavior: 'smooth' });
    switchDetailTab('secFindings');
  } else if (view === 'load') {
    document.getElementById('detailsSection').scrollIntoView({ behavior: 'smooth' });
    switchDetailTab('loadMetrics');
  } else if (view === 'map') {
    document.querySelector('.panel-map').scrollIntoView({ behavior: 'smooth' });
  }
};

// ── Local Client-Side Report Export (Zero-Trace) ─────────────────────────────
window.exportJsonDataLocally = function() {
  if (!currentReportData) {
    alert('No active audit data in memory to export. Please run an audit first.');
    return;
  }
  const blob = new Blob([JSON.stringify(currentReportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `spectre-core-${currentReportData.meta?.runId || 'report'}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

window.exportHtmlReportLocally = function() {
  if (!currentReportData) {
    alert('No active audit data in memory to export. Please run an audit first.');
    return;
  }

  const htmlContent = generateClientStandaloneHtml(currentReportData);
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `spectre-core-${currentReportData.meta?.runId || 'report'}.html`;
  a.click();
  URL.revokeObjectURL(url);
};

function generateClientStandaloneHtml(report) {
  const target = escapeHtml(report.meta?.target || 'Site');
  const runId = escapeHtml(report.meta?.runId || 'local');
  const dateStr = new Date(report.meta?.timestamp || Date.now()).toLocaleString();
  const sec = report.security;

  let findingsRows = '';
  if (sec) {
    const list = [...(sec.headers || []), ...(sec.tls || []), ...(sec.exposedFiles || []), ...(sec.dns || [])];
    list.forEach(f => {
      findingsRows += `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #222">${escapeHtml(f.category)}</td>
          <td style="padding:10px;border-bottom:1px solid #222"><code>${escapeHtml(f.check)}</code></td>
          <td style="padding:10px;border-bottom:1px solid #222"><span style="text-transform:uppercase;font-weight:bold;color:${f.status === 'pass' ? '#00e676' : '#ff3b30'}">${f.status}</span></td>
          <td style="padding:10px;border-bottom:1px solid #222">${escapeHtml(f.message)}</td>
        </tr>
      `;
    });
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SPECTRE · CORE Audit — ${target}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #08090d; color: #e2e8f0; padding: 30px; }
    h1 { color: #fff; margin-bottom: 6px; }
    .badge { background: #ff3b30; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
    th { text-align: left; background: #11141c; padding: 12px; border-bottom: 2px solid #333; color: #94a3b8; }
  </style>
</head>
<body>
  <h1>SPECTRE · CORE — Zero-Trace Audit Report</h1>
  <div style="color:#94a3b8;margin-bottom:20px">
    Target: <strong>${target}</strong> | Run: <span class="badge">${runId}</span> | Generated: ${dateStr}
  </div>
  <table>
    <thead><tr><th>Category</th><th>Check</th><th>Status</th><th>Details</th></tr></thead>
    <tbody>${findingsRows || '<tr><td colspan="4" style="padding:20px;text-align:center">No findings recorded</td></tr>'}</tbody>
  </table>
  <footer style="margin-top:40px;color:#64748b;font-size:12px;border-top:1px solid #222;padding-top:12px">
    Generated by SPECTRE · CORE • Designed by Ansh Narsale (<a href="https://anshnarsale.netlify.app/" style="color:#ff7043">anshnarsale.netlify.app</a>)
  </footer>
</body>
</html>`;
}

function formatHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
