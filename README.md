<div align="center">

<br>

```text
███████╗██████╗ ███████╗ ██████╗████████╗██████╗ ███████╗
██╔════╝██╔══██╗██╔════╝██╔════╝╚══██╔══╝██╔══██╗██╔════╝
███████╗██████╔╝█████╗  ██║        ██║   ██████╔╝█████╗
╚════██║██╔═══╝ ██╔══╝  ██║        ██║   ██╔══██╗██╔══╝
███████║██║     ███████╗╚██████╗   ██║   ██║  ██║███████╗
╚══════╝╚═╝     ╚══════╝ ╚═════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝
```

# SPECTRE · CORE

**Cyber Telemetry · Security Auditing · Controlled HTTP Performance**

<br>

[![Live Dashboard](https://img.shields.io/badge/Live_Dashboard-GitHub_Pages-2563eb?style=for-the-badge\&logo=github\&logoColor=white)](https://anshnarsale.github.io/spectre-core/)
[![Package](https://img.shields.io/badge/Package-GitHub_Packages-f97316?style=for-the-badge\&logo=npm\&logoColor=white)](https://github.com/anshnarsale/spectre-core/packages)
[![Source](https://img.shields.io/badge/Source-GitHub-18181b?style=for-the-badge\&logo=github)](https://github.com/anshnarsale/spectre-core)

<br>

![Node.js](https://img.shields.io/badge/Node.js_20+-111827?style=flat-square\&logo=node.js\&logoColor=339933)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-111827?style=flat-square\&logo=typescript\&logoColor=3178C6)
![License](https://img.shields.io/badge/License-MIT-111827?style=flat-square)
![Zero Trace](https://img.shields.io/badge/Memory-Zero--Trace-111827?style=flat-square)

<br>

> ⚠️ **Authorized testing only.** Test systems you own or have explicit permission to assess.

</div>

---

## 📸 Dashboard

<div align="center">

<img width="90%" src="https://github.com/user-attachments/assets/27e118d4-6d80-42ac-a752-43324b6ef56f" alt="SPECTRE CORE Dashboard">

**Real-time SOC dashboard · Security findings · HTTP telemetry · Live metrics**

</div>

---

## ⚡ Overview

**SPECTRE · CORE** is a local-first cybersecurity toolkit that combines security auditing, controlled HTTP performance testing, and real-time telemetry in one SOC-inspired interface.

| Module                 | Capability                                               |
| :--------------------- | :------------------------------------------------------- |
| 🛡️ **Security Audit** | HTTP headers · TLS · DNS · SPF · DMARC · exposure checks |
| 📈 **Load Engine**     | Ramp-up · spike · soak · RPS · latency                   |
| 📡 **Telemetry**       | Real-time Server-Sent Events                             |
| 🧠 **Zero-Trace**      | Session data kept in memory and purged on exit           |

---

## 🚀 Quick Start

### Live

```text
https://anshnarsale.github.io/spectre-core/
```

### NPX

```bash
npx @anshnarsale/spectre-core ui

npx @anshnarsale/spectre-core security \
  --target https://your-authorized-site.com

npx @anshnarsale/spectre-core load \
  --target https://your-authorized-site.com \
  --type rampup \
  --vus 30
```

### Local

```bash
git clone https://github.com/anshnarsale/spectre-core.git
cd spectre-core
npm install
npm run ui
```

---

## 🛡️ Security Engine

```text
Target
  │
  ├── TLS / SSL
  ├── DNS / MX / SPF / DMARC
  ├── HTTP Security Headers
  ├── Exposure Checks
  └── Compliance Score
             │
             ▼
        SOC Dashboard
```

**Checks include:** HSTS · CSP · X-Frame-Options · Referrer-Policy · TLS configuration · DNS records · common exposed paths.

---

## 📈 Load Engine

Powered by **Undici** for high-performance HTTP testing.

**Modes**

`RAMP-UP` · `SPIKE` · `SOAK`

**Metrics**

`p50` · `p75` · `p95` · `p99` · `RPS` · `mean` · `max` · HTTP status distribution

**Controls**

Configurable RPS cap · VU limit · emergency abort

---

## 🧠 Architecture

```text
              SPECTRE · CORE
                    │
        ┌───────────┴───────────┐
        │                       │
     CLI Engine            SOC Dashboard
        │                       │
        └───────────┬───────────┘
                    │
             Audit Orchestrator
              Express + SSE
                    │
       ┌────────────┼────────────┐
       │            │            │
     HTTP         TLS/DNS      LOAD
     AUDIT         AUDIT       ENGINE
       └────────────┴────────────┘
                    │
              LIVE TELEMETRY
```

---

## 🧰 Stack

<div align="center">

<img src="https://skillicons.dev/icons?i=nodejs,typescript,express,html,css,js" />

</div>

| Layer    | Technology                               |
| -------- | ---------------------------------------- |
| Runtime  | Node.js 20+                              |
| Language | TypeScript 5.4                           |
| HTTP     | Undici                                   |
| Server   | Express 5 + SSE                          |
| CLI      | Commander.js                             |
| UI       | Vanilla HTML · CSS · JavaScript          |
| Deploy   | GitHub Pages · Netlify · GitHub Packages |

---

## 🔒 Zero-Trace Design

* No `localStorage`
* No IndexedDB
* Reports remain in process memory
* `reports/` excluded from Git
* One-click session wipe
* Refresh / close destroys session data

---

## ⚠️ Responsible Use

SPECTRE · CORE is built for **authorized security research, defensive testing and controlled performance benchmarking**.

**Do not use it against systems without permission or for destructive, credential, injection, or denial-of-service attacks.**

---

## 📜 License

[MIT](./LICENSE) © [Ansh Narsale](https://github.com/anshnarsale)

<div align="center">

### Built by [Ansh Narsale](https://anshnarsale.netlify.app/)

[![Portfolio](https://img.shields.io/badge/Portfolio-18181b?style=flat-square\&logo=googlechrome)](https://anshnarsale.netlify.app/)
[![GitHub](https://img.shields.io/badge/GitHub-18181b?style=flat-square\&logo=github)](https://github.com/anshnarsale)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-18181b?style=flat-square\&logo=linkedin)](https://www.linkedin.com/in/anshnarsale/)

**Observe. Analyze. Measure. Secure.**

<sub>Built for authorized security research & controlled performance testing.</sub>

</div>
