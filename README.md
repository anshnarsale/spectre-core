<div align="center">

<br>

```
 ___  ____  ____  ___  ____  ____  ____     ___  _____  ____  ____ 
/ __)(  _ \( ___)/ __)(_  _)(  _ \( ___)   / __)(  _  )(  _ \( ___)
\__ \ )___/ )__)( (__   )(   )   / )__)   ( (__  )(_)(  )   / )__) 
(___/(__)  (____)\___)  (__) (_)\_)(____)   \___)(_____)(_)\_)(____)
```

# SPECTRE · CORE

**Zero-Trace Cyber Telemetry · Security Audit · HTTP Load Testing**

<br>

[![Live Dashboard](https://img.shields.io/badge/Live_Dashboard-GitHub_Pages-2563eb?style=for-the-badge&logo=github&logoColor=white)](https://anshnarsale.github.io/spectre-core/)
[![GitHub Packages](https://img.shields.io/badge/Package-GitHub_Packages-f97316?style=for-the-badge&logo=npm&logoColor=white)](https://github.com/anshnarsale/spectre-core/packages)
[![Source](https://img.shields.io/badge/Source-GitHub-18181b?style=for-the-badge&logo=github&logoColor=white)](https://github.com/anshnarsale/spectre-core)

<br>

![Node.js](https://img.shields.io/badge/Node.js-20+-111827?style=flat-square&logo=node.js&logoColor=339933)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-111827?style=flat-square&logo=typescript&logoColor=3178C6)
![License](https://img.shields.io/badge/License-MIT-111827?style=flat-square)
![Zero Trace](https://img.shields.io/badge/Memory-Zero--Trace-ff3b30?style=flat-square)

<br>

> ⚠️ **For authorized testing only.** Use SPECTRE only against systems you own or have explicit written permission to test.

<br>

</div>

---

## 📸 Dashboard Preview

<div align="center">

<img width="95%" src="https://github.com/user-attachments/assets/27e118d4-6d80-42ac-a752-43324b6ef56f" alt="SPECTRE CORE Dashboard">

*SOC-grade dark dashboard with live radar sweep, equalizer waveforms, and real-time telemetry*

</div>

---

## ⚡ What is SPECTRE · CORE?

SPECTRE · CORE is a **local-first, zero-trace cybersecurity platform** combining security auditing, HTTP load testing, and real-time telemetry streaming into a single SOC-inspired dashboard.

| Module | What it does |
|---|---|
| 🛡️ **Security Audit** | Scans HTTP headers, TLS, DNS, SPF, DMARC, and exposed paths |
| 📈 **Load Engine** | Ramp-up, spike, and soak tests with live RPS & latency metrics |
| 📡 **Telemetry** | Server-Sent Events stream to the dashboard in real time |
| 🧠 **Zero-Trace** | All report data lives in RAM — wiped on refresh, never touches disk |

---

## 🚀 Quick Start

### Option 1 — Live Dashboard *(no install)*

```
https://anshnarsale.github.io/spectre-core/
```

> The GitHub Pages deployment runs the full static dashboard. Reports are ephemeral and RAM-only.

### Option 2 — NPX *(no clone required)*

```bash
# Launch the SOC dashboard locally
npx @anshnarsale/spectre-core ui

# Run a security audit
npx @anshnarsale/spectre-core security --target https://your-authorized-site.com

# Run a controlled load test
npx @anshnarsale/spectre-core load --target https://your-authorized-site.com --type rampup --vus 30
```

### Option 3 — Install as a Package

```bash
# npm
npm install @anshnarsale/spectre-core

# GitHub Packages registry
npm install @anshnarsale/spectre-core --registry https://npm.pkg.github.com
```

### Option 4 — Clone & Run Locally

```bash
git clone https://github.com/anshnarsale/spectre-core.git
cd spectre-core
npm install
npm run ui
```

Then open **http://localhost:3000**

---

## 🛡️ Security Audit Engine

Non-destructive, read-only security posture analysis:

```
Target URL
    │
    ├── 🔐  TLS / SSL         → Certificate validity, TLS version, cipher grade
    ├── 🌐  DNS / MX          → A, MX, SPF, DMARC record inspection
    ├── 📋  HTTP Headers       → HSTS, CSP, X-Frame-Options, Referrer-Policy
    ├── 🔍  Exposure Scan      → .env, .git, backup files, admin panels
    └── 📊  Compliance Score  → Weighted security grade (0–100)
```

---

## 📈 Load Testing Engine

Powered by **Undici** — Node's fastest HTTP client:

| Mode | Description |
|---|---|
| **Ramp-Up** | Gradually increase VUs from baseline → target over test duration |
| **Spike Pulse** | Short burst of max VUs to probe breaking point |
| **Soak Test** | Sustained load over extended duration for memory leak detection |

**Metrics collected:** `p50` · `p75` · `p95` · `p99` · `mean` · `max` · `RPS` · HTTP status distribution

**Safety controls:** configurable RPS cap · max VU limit · emergency abort

---

## 🖥️ SOC Dashboard

<div align="center">

| 📊 Telemetry | 🌍 Edge Radar | 📡 SSE Console | 🔍 Findings |
|:---:|:---:|:---:|:---:|
| Live metrics & graphs | Global threat topology | Real-time event stream | Diagnostics & exports |

</div>

**Dashboard highlights:**
- Vulnerability overview with severity breakdown
- Compliance score & security grade
- p95 latency gauge & live RPS counter
- HTTP status distribution chart
- Real-time audit log console
- One-click JSON / HTML report export
- **Wipe Session** — purges all data from RAM instantly

---

## 🔒 Zero-Trace Architecture

```
  Scan ──→ Analyze ──→ Stream ──→ Display ──→ Export ──→ Purge
                                                           ↑
                                               On refresh / tab close
```

- ✅ All audit data stored in **browser RAM only** — no localStorage, no IndexedDB
- ✅ Server holds reports in **process memory only** — zero disk writes
- ✅ `reports/` directory is **git-ignored** — never committed to version control
- ✅ One-click **Wipe Memory** button purges everything from RAM instantly
- ✅ Closing or refreshing the tab **permanently destroys** all session data

---

## 🏗️ Architecture

```
                      SPECTRE · CORE
                            │
              ┌─────────────┴─────────────┐
              │                           │
           CLI Engine               Web Dashboard
         (Commander.js)          (Vanilla HTML/CSS/JS)
              │                           │
              └─────────────┬─────────────┘
                            │
                   Audit Orchestrator
                    (Express + SSE)
                            │
        ┌──────────┬────────┼────────┬──────────┐
        │          │        │        │          │
      HTTP       TLS      DNS      LOAD       PERF
      Audit     Audit    Audit    Engine      Audit
        └──────────┴────────┴────────┴──────────┘
                            │
                     SSE Telemetry Stream
                            │
                      SOC Dashboard
```

---

## 📁 Project Structure

```
spectre-core/
├── public/               # Static dashboard (GitHub Pages)
│   ├── index.html        # SOC dashboard shell
│   ├── app.css           # Cyber dark theme & animations
│   └── app.js            # Client telemetry & zero-trace logic
│
├── src/
│   ├── cli.ts            # CLI entry point (Commander.js)
│   ├── server.ts         # Express + SSE server
│   ├── types.ts          # Shared TypeScript types
│   ├── modules/          # Audit engines (HTTP, TLS, DNS, load)
│   ├── report/           # HTML & JSON report generators
│   ├── services/         # Audit orchestration & wipe service
│   └── utils/            # Helpers & formatters
│
├── bin/tool.js           # Binary entry point (npx)
├── .github/workflows/    # CI · Pages deploy · Package publish
├── package.json
├── tsconfig.json
└── netlify.toml
```

---

## 🧰 Tech Stack

<div align="center">
<img src="https://skillicons.dev/icons?i=nodejs,typescript,express,html,css,js" />
</div>

<br>

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Language | TypeScript 5.4 |
| HTTP Client | Undici (load engine) |
| Server | Express 5 + Server-Sent Events |
| CLI | Commander.js |
| Dashboard | Vanilla HTML · CSS · JavaScript |
| Deploy | GitHub Pages · Netlify · GitHub Packages |

---

## ⚠️ Responsible Use

SPECTRE · CORE is designed **exclusively** for authorized, ethical security testing.

**✅ Intended use cases:**
- Your own infrastructure & production systems
- Staging / development environments you control
- Security assessments with written authorization
- Performance benchmarking & capacity planning
- Cybersecurity research & education

**❌ Never use SPECTRE for:**
- Systems you don't own or lack written permission to test
- Brute-force, credential, or injection attacks
- Destructive or denial-of-service exploitation
- Any activity prohibited by applicable law

---

## 📜 License

[MIT](./LICENSE) © [Ansh Narsale](https://github.com/anshnarsale)

---

<div align="center">

<br>

**Made by [Ansh Narsale](https://anshnarsale.netlify.app/)**

[![Portfolio](https://img.shields.io/badge/Portfolio-anshnarsale.netlify.app-18181b?style=flat-square&logo=netlify&logoColor=00C7B7)](https://anshnarsale.netlify.app/)
[![GitHub](https://img.shields.io/badge/GitHub-anshnarsale-18181b?style=flat-square&logo=github&logoColor=white)](https://github.com/anshnarsale)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-anshnarsale-0077b5?style=flat-square&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/anshnarsale/)

<br>

*Computer Engineering · Cybersecurity · AI Systems · Network Forensics · Full-Stack*

<br>

---

**🛡️ SPECTRE · CORE** — *Observe. Analyze. Measure. Secure.*

<sub>Built for authorized security research & controlled performance testing.</sub>

<br>

</div>
