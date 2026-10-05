import express, { Request, Response } from 'express';
import path from 'path';
import { auditService, AuditRunOptions } from './services/audit-service';
import { logEmitter } from './utils/logger';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
const publicDir = path.join(process.cwd(), 'public');
app.use(express.static(publicDir));

// Serve generated reports folder directly so users can open /reports/:runId/report.html
const reportsDir = path.join(process.cwd(), 'reports');
app.use('/reports', express.static(reportsDir));

// ── SSE Endpoint ─────────────────────────────────────────────────────────────
const sseClients = new Set<Response>();

app.get('/api/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial connected event
  res.write(`data: ${JSON.stringify({
    event: 'connected',
    data: {
      isAuditing: auditService.isAuditing,
      currentRunId: auditService.currentRunId,
      currentTarget: auditService.currentTarget,
    },
  })}\n\n`);

  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

function broadcastSSE(event: string, data: unknown): void {
  const payload = `data: ${JSON.stringify({ event, data })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Hook logEmitter into SSE
logEmitter.on('log', (logEntry: { level: string; text: string }) => {
  broadcastSSE('log', {
    ...logEntry,
    timestamp: new Date().toLocaleTimeString(),
  });
});

// Hook auditService status into SSE
auditService.on('status', (statusPayload: unknown) => {
  broadcastSSE('status', statusPayload);
});

// Keep-alive heartbeat every 15s
setInterval(() => {
  for (const client of sseClients) {
    try {
      client.write(': heartbeat\n\n');
    } catch {
      sseClients.delete(client);
    }
  }
}, 15000);

// ── REST API ─────────────────────────────────────────────────────────────────

// Get active audit status
app.get('/api/status', (_req: Request, res: Response) => {
  res.json({
    isAuditing: auditService.isAuditing,
    currentRunId: auditService.currentRunId,
    currentTarget: auditService.currentTarget,
  });
});

// Start an audit (runs asynchronously, logs stream via SSE)
app.post('/api/audit', async (req: Request, res: Response) => {
  try {
    const { target, mode, maxRps, loadConfig, skipLighthouse, skipLoad } = req.body;

    if (!target || typeof target !== 'string' || !target.trim()) {
      return res.status(400).json({ error: 'Target URL is required.' });
    }

    if (auditService.isAuditing) {
      return res.status(409).json({ error: 'An audit is already in progress. Please wait or stop it.' });
    }

    const options: AuditRunOptions = {
      target: target.trim(),
      mode: mode || 'full',
      maxRps: maxRps ? parseInt(maxRps, 10) : 100,
      skipLighthouse: Boolean(skipLighthouse),
      skipLoad: Boolean(skipLoad),
      loadConfig: loadConfig || {},
    };

    // Respond immediately with acceptance so UI can track runId and listen to SSE
    res.json({
      success: true,
      message: 'Audit started',
      target: options.target,
      mode: options.mode,
    });

    // Run in background
    auditService.runAudit(options).catch((err) => {
      console.error('Audit execution error:', err);
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// Abort active audit
app.post('/api/abort', (_req: Request, res: Response) => {
  if (!auditService.isAuditing) {
    return res.status(400).json({ message: 'No audit is currently running.' });
  }
  auditService.abortCurrent();
  res.json({ success: true, message: 'Cancellation signal sent.' });
});

// List all past reports
app.get('/api/reports', (_req: Request, res: Response) => {
  const reports = auditService.getPastReports();
  res.json({ reports });
});

// Get a single report JSON
app.get('/api/reports/:runId', (req: Request, res: Response) => {
  const runId = Array.isArray(req.params.runId) ? req.params.runId[0] : req.params.runId;
  const report = auditService.getReportByRunId(runId);
  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }
  res.json({ report });
});

// Delete a report
app.delete('/api/reports/:runId', (req: Request, res: Response) => {
  const runId = Array.isArray(req.params.runId) ? req.params.runId[0] : req.params.runId;
  const deleted = auditService.deleteReport(runId);
  if (!deleted) {
    return res.status(404).json({ error: 'Report not found or could not be deleted' });
  }
  res.json({ success: true });
});

// Purge all server reports (Zero-Trace Privacy)
app.post('/api/wipe', (_req: Request, res: Response) => {
  auditService.wipeAllReports();
  res.json({ success: true, message: 'All reports purged. Zero traces remaining.' });
});

// Fallback: serve index.html for any unhandled routes
app.use((_req: Request, res: Response) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Start listening
export function startServer(port = PORT): void {
  app.listen(port, () => {
    console.log(`\n======================================================`);
    console.log(`🛡️  SPECTRE · CORE — Zero-Trace Cyber Telemetry Engine`);
    console.log(`👉 http://localhost:${port}`);
    console.log(`======================================================\n`);
  });
}

if (require.main === module) {
  startServer();
}

export default app;
