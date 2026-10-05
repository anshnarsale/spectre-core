# 🛡️ SPECTRE · CORE

> **Zero-Trace Cyber Telemetry, Non-Destructive Security Audit & High-Performance HTTP Load Engine**  
> *Engineered by [Ansh Narsale](https://anshnarsale.netlify.app/) • [GitHub](https://github.com/anshnarsale)*

[![License: MIT](https://img.shields.io/badge/License-MIT-red.svg)](https://opensource.org/licenses/MIT)
[![Node: >=20](https://img.shields.io/badge/Node-%3E%3D20-00e676.svg)](https://nodejs.org/)
[![TypeScript: 5.4](https://img.shields.io/badge/TypeScript-5.4-3178c6.svg)](https://www.typescriptlang.org/)
[![Privacy: Zero--Trace](https://img.shields.io/badge/Privacy-Zero--Trace%20RAM-ff3b30.svg)](#-zero-trace-ephemeral-architecture)

---

## ⚡ Overview

**SPECTRE · CORE** is an enterprise-grade cyber defense and telemetry platform inspired by modern SOC (Security Operations Center) command interfaces. It pairs passive, read-only security posture auditing with an ultra-fast `undici`-powered load generation engine, packaged in both a terminal CLI and a live real-time glassmorphism web dashboard.

---

## 🌟 Key Capabilities

### 🔒 Zero-Trace Ephemeral Architecture
- **In-Memory Volatile Buffer**: Audit findings, latency statistics, and telemetry metrics exist **strictly in client browser RAM** for the active session.
- **Auto-Wipe on Refresh**: Refreshing or closing the tab instantly purges all audit data.
- **GitHub & Netlify Safe**: Strict `.gitignore` rules prevent private target reports or scan results from ever being pushed to public repositories or shared hosting environments.
- **Client-Side Blob Exports**: Export standalone HTML and JSON reports on demand directly from browser memory without writing to server disk.

### 🛡️ Non-Destructive Security Auditing
- **HTTP Security Headers**: Strict-Transport-Security (HSTS), Content-Security-Policy (CSP), X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- **TLS/SSL Cipher Verification**: TLS 1.2 / 1.3 protocol validation, cipher suite grading, certificate validity window, and legacy protocol rejection checks.
- **Exposed Sensitive Files**: Passive non-destructive probe for exposed `.env`, `.git`, configuration files, and backup archives.
- **DNS Sanity & Mail Records**: Dual-stack IPv4/IPv6 resolution, SPF, DMARC, and MX record inspection.
- **Client-Side Dependencies**: Passive detection of vulnerable front-end JavaScript libraries.

### 📈 High-Performance Load & Stress Engine
- **Powered by Node `undici`**: High-throughput connection pooling with zero native thread bottlenecks.
- **HDR Latency Percentiles**: Exact `p50`, `p75`, `p95`, `p99`, `mean`, and `max` latency distribution.
- **CDN Rate-Limit Telemetry**: Specifically tuned to detect and categorize CDN edge rate-limiting (HTTP 429/4xx responses).
- **Multiple Test Profiles**:
  - **Ramp-Up**: Progressive concurrency ramp-up from starting VUs to peak load.
  - **Spike Pulse**: Instant burst traffic to evaluate autoscaling and CDN burst limits.
  - **Soak Test**: Sustained endurance testing to uncover memory leaks and socket starvation.
- **Safety RPS Cap & Emergency Kill Switch**: Configurable conservative rate caps (50, 100, 200 RPS) with one-click web kill-switch and `Ctrl+C` interrupt handlers.

### 🚀 Lighthouse & Performance Diagnostics
- **Core Web Vitals**: First Contentful Paint (FCP), Largest Contentful Paint (LCP), Total Blocking Time (TBT), Cumulative Layout Shift (CLS).
- **Category Scoring**: Automated 0–100 radial score meters for Performance, Accessibility, Best Practices, and SEO.

---

## 🖥️ Web Dashboard (SOC Telemetry Interface)

The dashboard runs locally at **`http://localhost:3000`** with:
- **Top Telemetry 4-Card Strip**: Real-time meters for Open Vulnerabilities, Active Incidents (4xx Rate-Limits), Compliance Score, and Tail Latency (p95 with animated audio equalizer waveform).
- **Global Edge & Threat Radar**: Vector dot world topology featuring animated rotating radar sweep beam and pulsing beacons over major CDN PoPs.
- **Real-Time SSE Console**: Live Server-Sent Events terminal showing colored execution logs step-by-step.
- **Deep-Dive Explorer**: Tabbed table views for security findings (filterable by pass/fail/warn), response status code distribution bars, and diagnostics.

---

## 🚀 Quick Start

### 1. Installation
```bash
git clone https://github.com/anshnarsale/spectre-core.git
cd spectre-core
npm install
```

### 2. Launch Web Dashboard
```bash
npm run ui
# or
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## ⌨️ CLI Usage

SPECTRE · CORE can also be run directly from the command line:

```bash
# Run Security Audit only
npx ts-node src/cli.ts security --target https://example.com

# Run Ramp-Up Load Test
npx ts-node src/cli.ts load --target https://example.com --type rampup --vus 30 --duration 30s

# Run Spike Test with custom RPS cap
npx ts-node src/cli.ts load --target https://example.com --type spike --spike-vus 50 --max-rps 100

# Run Full Audit (Security + Lighthouse + Load)
npx ts-node src/cli.ts audit --target https://example.com --vus 25 --duration 1m
```

---

## 📁 Repository Structure

```
spectre-core/
├── public/                 # Enterprise SOC Web UI (Zero-Trace)
│   ├── index.html          # Cyber dashboard layout & vector radar map
│   ├── app.css             # Matte obsidian theme with glowing animations
│   └── app.js              # Real-time SSE listener & client RAM store
├── src/
│   ├── cli.ts              # Command-line interface entry point
│   ├── server.ts           # Express server with SSE streaming & purge APIs
│   ├── types.ts            # Shared TypeScript data contracts
│   ├── modules/
│   │   ├── security-audit.ts  # Security orchestrator
│   │   ├── header-audit.ts    # HTTP response header verification
│   │   ├── tls-audit.ts       # SSL/TLS protocol & cipher tests
│   │   ├── exposed-files.ts   # Passive file disclosure probes
│   │   ├── dns-audit.ts       # DNS & mail record inspection
│   │   ├── load-test.ts       # Undici high-throughput load engine
│   │   └── lighthouse.ts      # Core Web Vitals & performance scanner
│   ├── report/
│   │   └── generator.ts       # Standalone HTML & JSON report builders
│   ├── services/
│   │   └── audit-service.ts   # Core background execution & wipe service
│   └── utils/
│       └── logger.ts          # Event-emitting terminal logger
├── netlify.toml            # Netlify deployment configuration
├── tsconfig.json           # TypeScript configuration
└── package.json            # Project manifest
```

---

## 🔒 Security & Privacy Policy

- **Non-Destructive Testing**: SPECTRE · CORE performs strictly passive and non-destructive checks. It never executes SQL injection payloads, brute-force credential stuffing, or harmful exploits.
- **RPS Safety Caps**: Default caps prevent accidental denial-of-service behavior.
- **Ephemeral RAM Guard**: No audit reports or target URLs are stored on disk. Refreshing the browser purges all active session memory.

---

## 👨‍💻 Author

**Ansh Narsale**  
- Website: [anshnarsale.netlify.app](https://anshnarsale.netlify.app/)  
- GitHub: [@anshnarsale](https://github.com/anshnarsale)  
- Email: [anshnarsale2003@gmail.com](mailto:anshnarsale2003@gmail.com)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
