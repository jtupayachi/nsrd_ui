<div align="center">

<!-- Hero Banner -->
<img src="docs/assets/nsrd-banner.png" alt="NSRD GIS Builder" width="100%"/>

# NSRD GIS Builder

### AI-Powered Multi-Page React Application Generator

**Describe pages in plain English → Get a deployed, production-quality React app in minutes.**

Built at [Oak Ridge National Laboratory](https://www.ornl.gov/) · Powered by LLMs · Fully Self-Hosted

<br/>

![Version](https://img.shields.io/badge/Version-0.1.0-FFF?labelColor=032d60&style=for-the-badge&color=0176d3)
![License](https://img.shields.io/badge/License-ORNL-FFF?labelColor=032d60&style=for-the-badge&color=0176d3)
![React](https://img.shields.io/badge/React_18-TypeScript-FFF?labelColor=032d60&style=for-the-badge&color=0176d3&logo=react&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Ready-FFF?labelColor=032d60&style=for-the-badge&color=0176d3&logo=docker&logoColor=white)

<br/>

[𝙻𝚒𝚟𝚎 𝙳𝚎𝚖𝚘](https://demo2.recoil.ise.utk.edu) ✦ [𝙳𝚘𝚌𝚞𝚖𝚎𝚗𝚝𝚊𝚝𝚒𝚘𝚗](docs/user-guide/USER_GUIDE.md) ✦ [𝙳𝚎𝚙𝚕𝚘𝚢𝚖𝚎𝚗𝚝](docs/deployment/DEPLOYMENT.md) ✦ [𝚂𝚙𝚘𝚗𝚜𝚘𝚛𝚜](#sponsors) ✦ [𝙲𝚘𝚗𝚝𝚊𝚌𝚝](#contact)

<br/>

![NSRD GIS Builder Demo](docs/assets/nsrd-demo.gif)

</div>

> [!IMPORTANT]
>
> NSRD GIS Builder is an **open research tool** developed at Oak Ridge National Laboratory.
> We're actively seeking **sponsors and partners** to expand capabilities and support broader deployment.
>
> <div align="center">
>
> **Interested in sponsoring or partnering?** → [**Become a Sponsor ↓**](#sponsors)
>
> </div>

---

## Getting Started

NSRD GIS Builder transforms natural-language descriptions into fully deployed, multi-page React applications — complete with interactive maps, data tables, charts, and dashboards.

### How It Works

1. **Describe** your pages in plain English — what layout, data, and interactions you need
2. **Upload** optional data files (CSV, SVG mockups) to drive visualizations
3. **Select** AI models — a two-model pipeline (Thinker + Coder) plans and writes your app
4. **Generate** — the pipeline builds, fixes, and deploys a live React application automatically
5. **Preview** — view your deployed app instantly in the built-in preview panel
6. **Download** — export the full project source as a ready-to-run package

<br/>

<div align="center">

| 📝 Describe | 🤖 Generate | 🚀 Deploy |
|:---:|:---:|:---:|
| Write requirements in plain English | Two-model LLM pipeline builds your app | Live preview + downloadable project |

</div>

---

## Key Features

<div align="center">

![Features Overview](docs/assets/nsrd-features.png)

</div>

### 🗺️ Multi-Page App Generation

Generate complete multi-page React apps with routing, navigation, and shared layout. Support for three page types:

| Type | Use Case |
|------|----------|
| 🏠 **Home** | Landing pages — hero banners, metric cards, navigation |
| 📋 **Base** | General content — tables, forms, dashboards |
| 🗺️ **Geo / Map** | Interactive Leaflet maps — markers, layers, heatmaps, CSV-driven points |

### 🧠 Two-Model AI Pipeline

A sophisticated generation pipeline using **two specialized LLM roles**:

- **🧠 Thinker** — plans the architecture, routing, and component structure
- **💻 Coder** — writes production-quality React/JSX components

### 🔧 Automated Build & Fix

- Vite-based project scaffolding with automatic dependency resolution
- **Self-healing build loop** — compilation errors are automatically fed back to the LLM for correction
- Runtime review detects and fixes issues post-build

### 📊 RAG-Enhanced Code Quality

Retrieval-Augmented Generation (FAISS + sentence-transformers) injects **proven golden examples** into every prompt, ensuring generated code follows best practices and patterns that work.

### 📂 Built-in Code Editor

After generation, browse and edit any file in the built-in code editor. Changes trigger an automatic rebuild with **instant preview refresh**.

### 🐳 One-Command Deployment

Fully containerized with Docker Compose. Single-port deployment behind NGINX with SSL support.

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | React 18, TypeScript, Vite |
| **Backend** | Express.js, SSE streaming |
| **AI Pipeline** | Ollama (Llama, Qwen, DeepSeek, Mistral, Code Llama) |
| **RAG Engine** | Python, FAISS, sentence-transformers |
| **Build System** | Vite, Tailwind CSS, React Router |
| **Deployment** | Docker Compose, NGINX, Let's Encrypt |
| **Code Quality** | Automated sanitizer, golden-example injection |

---

## Quick Start

### Prerequisites

| Tool | Version | Link |
|------|---------|------|
| Docker | 20+ | [docker.com](https://docker.com) |
| Docker Compose | v2+ | Included with Docker Desktop |

### Deploy with Docker

```bash
# Clone the repository
git clone https://github.com/your-org/nsrd_ui.git
cd nsrd_ui/nsrd_ui

# Build and start
docker-compose up --build

# Access at http://localhost:8432
```

### Supported AI Providers

| Provider | Type | Models |
|----------|------|--------|
| **Ollama** | Self-hosted | Llama 2/3, Mistral, Code Llama, DeepSeek, Qwen, Phi |
| **Anthropic** | Cloud | Claude (coming soon) |

---

## Sponsors

<div align="center">

![Sponsors](docs/assets/nsrd-sponsors.png)

NSRD GIS Builder is developed at **Oak Ridge National Laboratory** and supported by its sponsors and partners. Your sponsorship directly funds new features, model integrations, and broader deployment.

</div>

### Organizations backing NSRD GIS Builder

Sponsor at an organizational tier and **your logo + link + description appears here** — in front of researchers, engineers, and decision-makers across DOE national laboratories and partner institutions.

| Sponsor | Description |
|---------|-------------|
| [**Oak Ridge National Laboratory**](https://www.ornl.gov) | Primary development home. ORNL's research infrastructure powers NSRD GIS Builder's development and testing. 🌐 [ornl.gov](https://www.ornl.gov) |
| [**University of Tennessee**](https://www.utk.edu) | Academic collaboration partner providing research support and deployment infrastructure. 🌐 [utk.edu](https://www.utk.edu) |
| **✦ Your organization here** | Accelerate AI-powered app generation for your team. **[Become a sponsor →](#contact)** |

<br/>

> **Why sponsor NSRD GIS Builder?**
>
> - 🏛️ **Visibility** — Your brand in front of DOE labs, defense programs, and research institutions
> - 🚀 **Early access** — Priority access to new features, page types, and model integrations
> - 🤝 **Partnership** — Direct collaboration on custom capabilities for your use case
> - 📊 **Impact** — Fund tools that accelerate scientific research and data visualization

<br/>

<div align="center">

### Support the Project

Every contribution keeps NSRD GIS Builder free for research and funds new capabilities.

| Platform | Link |
|----------|------|
| **GitHub** | [![GitHub Sponsors](https://img.shields.io/badge/Sponsor_on_GitHub-032d60?style=for-the-badge&logo=github&logoColor=white)](https://github.com/sponsors/your-org) |
| **Contact** | [![Email](https://img.shields.io/badge/Contact_Us-032d60?style=for-the-badge&logo=mail.ru&logoColor=white)](#contact) |

</div>

---

## Use Cases

<div align="center">

| Use Case | Description |
|----------|-------------|
| 🔬 **Research Dashboards** | Scientists describe their data visualization needs; NSRD generates a full dashboard with maps, charts, and tables |
| 🌍 **Environmental Monitoring** | Upload sensor CSV data and describe a GIS portal — get an interactive Leaflet map application |
| 🏛️ **Program Portals** | Program managers describe reporting needs; NSRD builds multi-page status dashboards |
| 🛡️ **Rapid Prototyping** | Defense and intelligence analysts get interactive data tools without waiting for front-end developers |
| 🎓 **Education** | Students and researchers prototype data applications for publications and presentations |

</div>

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    NSRD GIS Builder                           │
├──────────────┬───────────────────────────────────────────────┤
│  React UI    │  Express.js Backend                           │
│  (TypeScript)│  ┌─────────────────────────────────────────┐  │
│              │  │  Pipeline Engine                         │  │
│  • Pages     │  │  ┌──────────┐  ┌─────────┐  ┌────────┐ │  │
│  • Editor    │  │  │ Thinker  │→│  Coder  │→│ Builder│ │  │
│  • Preview   │  │  │ (Plan)   │  │ (Write) │  │ (Vite) │ │  │
│  • Code      │  │  └──────────┘  └─────────┘  └────────┘ │  │
│    Editor    │  │        ↑              ↑                  │  │
│              │  │  ┌─────┴──────────────┴───────┐         │  │
│              │  │  │  RAG Engine (FAISS)         │         │  │
│              │  │  │  Golden Examples + Embeddings│         │  │
│              │  │  └────────────────────────────┘         │  │
│              │  └─────────────────────────────────────────┘  │
├──────────────┴───────────────────────────────────────────────┤
│  Docker Compose · NGINX · Ollama LLM Gateway                 │
└──────────────────────────────────────────────────────────────┘
```

---

## Roadmap

We're actively developing new capabilities. If you have suggestions or feature requests, please reach out.

- 📊 **New page types** — charts, forms, admin panels, data entry
- 🌐 **Additional LLM providers** — OpenAI GPT-4o, Anthropic Claude, Google Gemini
- 👥 **Multi-user support** — authentication, role-based access, project management
- 📱 **Mobile-responsive templates** — optimized layouts for mobile devices
- 🔌 **API integrations** — connect to live data sources and REST APIs
- 📄 **PDF/report generation** — export dashboards as printable reports

---

## Team

<div align="center">

| | |
|---|---|
| **Jose Tupayachi** | Lead Developer · Oak Ridge National Laboratory |
| | [jtupayac@vols.utk.edu](mailto:jtupayac@vols.utk.edu) |

</div>

---

## Contact

<div align="center">

Interested in sponsoring, partnering, or deploying NSRD GIS Builder at your organization?

<br/>

[![Email](https://img.shields.io/badge/Email_Us-032d60?style=for-the-badge&logo=gmail&logoColor=white)](mailto:jtupayac@vols.utk.edu)
[![Live Demo](https://img.shields.io/badge/Try_Live_Demo-0176d3?style=for-the-badge&logo=google-chrome&logoColor=white)](https://demo2.recoil.ise.utk.edu)

<br/>

**NSRD GIS Builder** · Oak Ridge National Laboratory · University of Tennessee

</div>

---

<div align="center">

<sub>Built with ❤️ at Oak Ridge National Laboratory</sub>

</div>
