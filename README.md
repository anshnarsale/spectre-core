# 🛡️ SPECTRE · CORE

<p align="center">
  <strong>Zero-Trace Cyber Telemetry · Non-Destructive Security Audit · HTTP Load Engine</strong>
</p>

<<<<<<< HEAD
<p align="center">
  <i>Enterprise-inspired security posture analysis and performance telemetry from a single command center.</i>
</p>

<p align="center">
  <a href="https://github.com/anshnarsale/spectre-core">
    <img src="https://img.shields.io/badge/Repository-SPECTRE%20CORE-111827?style=for-the-badge&logo=github&logoColor=white" alt="Repository">
  </a>
  <a href="https://anshnarsale.github.io/spectre-core/">
    <img src="https://img.shields.io/badge/Live%20Dashboard-GitHub%20Pages-38bdf8?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Pages">
  </a>
  <a href="https://github.com/anshnarsale/spectre-core/packages">
    <img src="https://img.shields.io/badge/Package-@anshnarsale/spectre--core-f97316?style=for-the-badge&logo=npm&logoColor=white" alt="GitHub Packages">
  </a>
  <a href="https://nodejs.org/">
    <img src="https://img.shields.io/badge/Node.js-%3E%3D20-0f172a?style=for-the-badge&logo=node.js&logoColor=339933" alt="Node.js">
  </a>
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/badge/TypeScript-5.4-0f172a?style=for-the-badge&logo=typescript&logoColor=3178C6" alt="TypeScript">
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-0f172a?style=for-the-badge&logo=opensourceinitiative&logoColor=white" alt="MIT License">
  </a>
</p>

<p align="center">
  <b>⚠️ Authorized Testing Only</b><br>
  SPECTRE · CORE is designed for systems, applications and infrastructure that you own or have explicit permission to test.
</p>

---

<p align="center">
  <img width="95%" src="https://github.com/user-attachments/assets/27e118d4-6d80-42ac-a752-43324b6ef56f" alt="SPECTRE CORE Dashboard">
</p>

<p align="center">
  <i>SPECTRE · CORE — SOC-inspired telemetry dashboard</i>
</p>

---

## 📦 Run Instantly via NPX or Install Package

You can launch the dashboard or run CLI audits instantly without cloning:

```bash
# Launch the Web Dashboard immediately
npx @anshnarsale/spectre-core ui

# Run an immediate security audit
npx @anshnarsale/spectre-core security --target https://your-site.com

# Run a high-speed load test with safety cap
npx @anshnarsale/spectre-core load --target https://your-site.com --type rampup --vus 30
```

### Install Globally via GitHub Packages
Configure your npm client to use GitHub Packages:
```bash
echo "@anshnarsale:registry=https://npm.pkg.github.com" >> ~/.npmrc
npm install -g @anshnarsale/spectre-core

# Now use the 'spectre' command anywhere!
spectre ui
spectre audit --target https://your-site.com
```

---

## 🌐 Live GitHub Pages Deployment

The static zero-trace dashboard is automatically deployed via GitHub Actions:  
👉 **[https://anshnarsale.github.io/spectre-core/](https://anshnarsale.github.io/spectre-core/)**

---

## ⚡ What is SPECTRE · CORE?

**SPECTRE · CORE** is a local-first cybersecurity telemetry and performance analysis platform built around three pillars:

<table align="center">
<tr>
<td align="center" width="33%">

### 🛡️ SECURITY

HTTP security posture
TLS / SSL validation
DNS & mail records
Exposed-file detection

</td>

<td align="center" width="33%">

### 📈 PERFORMANCE

HTTP load testing
Latency percentiles
RPS telemetry
Rate-limit detection

</td>

<td align="center" width="33%">

### 🧠 TELEMETRY

Real-time SSE events
Live SOC dashboard
Ephemeral session state
Exportable reports

</td>
</tr>
</table>

The goal is to provide a **single operational interface** for understanding how a web application behaves from both a **security** and **performance** perspective.

---

# 🧩 Core Capabilities

## 🔒 Zero-Trace Architecture

SPECTRE is designed around an **ephemeral-session model**.

* 🧠 Audit findings remain in browser memory during the active session.
* 🧹 Refreshing or closing the dashboard clears the client-side session state.
* 🚫 No persistent target reports are intentionally written to the application server.
* 📦 HTML and JSON reports can be generated directly in the browser.
* 🔐 `.gitignore` rules prevent local reports and sensitive scan artifacts from entering Git history.

> **Design principle:** collect → analyze → display → export → purge.

---

## 🛡️ Non-Destructive Security Audit

SPECTRE performs security posture checks without attempting destructive exploitation.

### HTTP Security Headers

Checks for important response headers including:

* `Strict-Transport-Security`
* `Content-Security-Policy`
* `X-Frame-Options`
* `X-Content-Type-Options`
* `Referrer-Policy`
* `Permissions-Policy`

### TLS / SSL

Analyzes:

* TLS 1.2 / 1.3 support
* Legacy protocol rejection
* Certificate validity
* Cipher information
* Certificate expiration windows

### 🌐 Exposure Detection

Passive probes for commonly exposed resources such as:

```text
.env
.git/
configuration files
backup archives
```

### 📡 DNS & Mail Security

Inspects:

* IPv4 resolution
* IPv6 resolution
* MX records
* SPF
* DMARC

### 📦 Front-End Dependency Analysis

Performs passive inspection of client-side dependencies to identify potentially outdated or vulnerable JavaScript libraries.

---

# 📈 HTTP Load & Performance Engine

SPECTRE includes a high-performance HTTP testing engine powered by Node.js and `undici`.

### ⚙️ Engine

```text
Node.js
   │
   ├── Undici HTTP Client
   │
   ├── Connection Pooling
   │
   ├── Concurrent Requests
   │
   └── Telemetry Collector
```

### 📊 Latency Metrics

Collected statistics include:

| Metric | Description              |
| ------ | ------------------------ |
| `p50`  | Median latency           |
| `p75`  | 75th percentile          |
| `p95`  | 95th percentile          |
| `p99`  | 99th percentile          |
| `mean` | Average latency          |
| `max`  | Maximum observed latency |

### 🧪 Test Profiles

#### Ramp-Up

Gradually increases concurrent virtual users.

```text
10 VUs
   ↓
20 VUs
   ↓
30 VUs
   ↓
50 VUs
```

Useful for observing how an authorized application behaves as traffic increases.

#### Spike Pulse

Produces a controlled burst within the configured safety limits.

Useful for evaluating:

* CDN behavior
* Rate limiting
* Autoscaling response
* Short-duration traffic bursts

#### Soak Test

Maintains sustained traffic over a longer period.

Useful for detecting:

* Increasing latency
* Connection exhaustion
* Memory-related degradation
* Long-running stability problems

---

# 🚦 Safety Controls

SPECTRE intentionally includes conservative controls around load generation.

<table align="center">
<tr>
<td align="center">

### 🔢 RPS CAP

50 / 100 / 200 RPS

</td>

<td align="center">

### 🛑 KILL SWITCH

Instant web shutdown

</td>

<td align="center">

### ⌨️ CTRL+C

Immediate CLI interruption

</td>
</tr>
</table>

> Load testing should only be performed against infrastructure you own or have explicit authorization to test.

---

# 🚀 Lighthouse & Web Performance

SPECTRE can collect modern web-performance indicators including:

* **FCP** — First Contentful Paint
* **LCP** — Largest Contentful Paint
* **TBT** — Total Blocking Time
* **CLS** — Cumulative Layout Shift

It also provides category-style scoring for:

```text
Performance
Accessibility
Best Practices
SEO
```

---

# 🖥️ SOC Telemetry Dashboard

Launch the local command center at:

```text
http://localhost:3000
```

### Dashboard Components

<table align="center">
<tr>
<td align="center">📊<br><b>Telemetry Cards</b></td>
<td align="center">🌍<br><b>Edge Radar</b></td>
<td align="center">📡<br><b>SSE Console</b></td>
<td align="center">🔍<br><b>Deep Explorer</b></td>
</tr>
</table>

### 📊 Telemetry Strip

Live indicators for:

* Open vulnerabilities
* Active incidents
* Compliance score
* p95 tail latency

### 🌍 Global Edge & Threat Radar

A visual topology interface representing major edge/CDN locations with:

* Rotating radar sweep
* Animated beacons
* Global topology visualization
* Edge activity indicators

### 📡 Real-Time SSE Console

The dashboard receives execution events through **Server-Sent Events**.

```text
[SECURITY] Initializing audit...
[HTTP] Checking response headers...
[TLS] Inspecting protocol configuration...
[DNS] Resolving records...
[LOAD] Starting controlled test...
[REPORT] Generating telemetry...
```

### 🔍 Deep-Dive Explorer

Explore:

* Security findings
* Pass / warning / failure states
* HTTP status distributions
* Latency statistics
* Performance diagnostics

---

# 🏗️ Architecture

```text
                         ┌─────────────────────┐
                         │     SPECTRE CORE    │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
              ┌─────▼─────┐                   ┌─────▼─────┐
              │ CLI Engine │                   │ Web UI     │
              └─────┬─────┘                   └─────┬─────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                         ┌──────────▼──────────┐
                         │  Audit Orchestrator │
                         └──────────┬──────────┘
                                    │
          ┌─────────────┬───────────┼───────────┬─────────────┐
          │             │           │           │             │
       ┌──▼──┐       ┌──▼──┐     ┌──▼──┐     ┌──▼──┐       ┌──▼──┐
       │ HTTP│       │ TLS │     │ DNS │     │Load │       │Perf │
       │Audit│       │Audit│     │Audit│     │Engine│      │Audit│
       └─────┘       └─────┘     └─────┘     └─────┘       └─────┘
                                    │
                         ┌──────────▼──────────┐
                         │ Telemetry / Events  │
                         └──────────┬──────────┘
                                    │
                              Server-Sent Events
                                    │
                         ┌──────────▼──────────┐
                         │   SOC Dashboard     │
                         └─────────────────────┘
```

---

# 🚀 Quick Start

## 1. Clone

```bash
git clone https://github.com/anshnarsale/spectre-core.git
cd spectre-core
```

## 2. Install

```bash
npm install
```

## 3. Launch Dashboard

```bash
npm run ui
```

or:

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

---

# ⌨️ CLI

## Security Audit

```bash
npx ts-node src/cli.ts security \
  --target https://example.com
```

## Controlled Ramp-Up Test

```bash
npx ts-node src/cli.ts load \
  --target https://example.com \
  --type rampup \
  --vus 30 \
  --duration 30s
```

## Controlled Spike Test

```bash
npx ts-node src/cli.ts load \
  --target https://example.com \
  --type spike \
  --spike-vus 50 \
  --max-rps 100
```

## Full Audit

```bash
npx ts-node src/cli.ts audit \
  --target https://example.com \
  --vus 25 \
  --duration 1m
```

---

# 📁 Project Structure

```text
spectre-core/
│
├── public/
│   ├── index.html
│   ├── app.css
│   └── app.js
│
├── src/
│   ├── cli.ts
│   ├── server.ts
│   ├── types.ts
│   │
│   ├── modules/
│   │   ├── security-audit.ts
│   │   ├── header-audit.ts
│   │   ├── tls-audit.ts
│   │   ├── exposed-files.ts
│   │   ├── dns-audit.ts
│   │   ├── load-test.ts
│   │   └── lighthouse.ts
│   │
│   ├── report/
│   │   └── generator.ts
│   │
│   ├── services/
│   │   └── audit-service.ts
│   │
│   └── utils/
│       └── logger.ts
│
├── netlify.toml
├── tsconfig.json
├── package.json
└── README.md
```

---

# 🔐 Security Philosophy

SPECTRE follows a **defensive-first** approach.

### It does

```text
✓ Security posture inspection
✓ Header analysis
✓ TLS configuration checks
✓ DNS inspection
✓ Exposure detection
✓ Performance measurement
✓ Controlled load testing
✓ Telemetry collection
```

### It does NOT intentionally perform

```text
✕ SQL injection exploitation
✕ Credential stuffing
✕ Brute-force attacks
✕ Destructive exploitation
✕ Malware deployment
✕ Persistence mechanisms
```

The platform is intended for **authorized security assessment, development testing, staging environments and controlled performance testing**.

---

# 🧰 Technology Stack

<p align="center">

<img src="https://img.shields.io/badge/Node.js-20+-111827?style=flat-square&logo=node.js&logoColor=339933">
<img src="https://img.shields.io/badge/TypeScript-5.4-111827?style=flat-square&logo=typescript&logoColor=3178C6">
<img src="https://img.shields.io/badge/Express-111827?style=flat-square&logo=express&logoColor=white">
<img src="https://img.shields.io/badge/Undici-HTTP%20Engine-111827?style=flat-square">
<img src="https://img.shields.io/badge/SSE-Realtime-111827?style=flat-square">
<img src="https://img.shields.io/badge/HTML5-111827?style=flat-square&logo=html5&logoColor=E34F26">
<img src="https://img.shields.io/badge/CSS3-111827?style=flat-square&logo=css3&logoColor=1572B6">
<img src="https://img.shields.io/badge/JavaScript-111827?style=flat-square&logo=javascript&logoColor=F7DF1E">

</p>

---

# 📊 Operational Flow

```text
             TARGET
                │
                ▼
       ┌─────────────────┐
       │ Target Validation│
       └────────┬────────┘
                │
        ┌───────┴────────┐
        ▼                ▼
   SECURITY          PERFORMANCE
     AUDIT              TEST
        │                │
        ├──────┐    ┌────┤
        ▼      ▼    ▼    ▼
      HTTP    TLS  RPS  LATENCY
      DNS     SSL  HTTP  HDR
      FILES        STATUS
        │           │
        └─────┬─────┘
              ▼
        TELEMETRY BUS
              │
              ▼
        SSE STREAM
              │
              ▼
        SOC DASHBOARD
              │
         ┌────┴────┐
         ▼         ▼
       JSON       HTML
      REPORT     REPORT
```

---

# 🧪 Example Workflow

```bash
# Start SPECTRE
npm run ui

# Open dashboard
http://localhost:3000

# Or run directly from CLI
npx ts-node src/cli.ts security \
  --target https://your-authorized-target.com
```

Then monitor:

```text
Security Findings
       ↓
TLS Configuration
       ↓
DNS / Mail Records
       ↓
HTTP Behaviour
       ↓
Latency Distribution
       ↓
Rate-Limit Responses
       ↓
Performance Diagnostics
       ↓
Final Telemetry Report
```

---

# 👨‍💻 Author

<p align="center">

<img src="https://github.com/anshnarsale.png" width="110" style="border-radius:50%;" alt="Ansh Narsale">

### Ansh Narsale

<b>Computer Engineering • Cybersecurity • AI Systems • Network Forensics • Full-Stack</b>

<br><br>

<a href="https://anshnarsale.netlify.app/">
  <img src="https://img.shields.io/badge/Portfolio-111827?style=for-the-badge&logo=googlechrome&logoColor=white">
</a>
<a href="https://github.com/anshnarsale">
  <img src="https://img.shields.io/badge/GitHub-111827?style=for-the-badge&logo=github&logoColor=white">
</a>
<a href="https://www.linkedin.com/in/anshnarsale/">
  <img src="https://img.shields.io/badge/LinkedIn-111827?style=for-the-badge&logo=linkedin&logoColor=0A66C2">
</a>

</p>

---

# 📜 License

SPECTRE · CORE is released under the **MIT License**.

See [`LICENSE`](LICENSE) for details.

---

<p align="center">

### 🛡️ SPECTRE · CORE

<i>Observe. Analyze. Measure. Secure.</i>

<br><br>

<strong>Built for authorized security research & controlled performance testing.</strong>

</p>
