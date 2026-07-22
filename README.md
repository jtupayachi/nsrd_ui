<div align="center">

# SmartGIScavp

### AI-Powered Multi-Page React App Generator

**Write your requirements → LLM thinks + codes → Live React app deployed in seconds**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9-3178c6?logo=typescript)](https://typescriptlang.org)
[![Ollama](https://img.shields.io/badge/Ollama-LLM-ff6b35)](https://ollama.ai)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ed?logo=docker)](https://docker.com)
[![ORNL](https://img.shields.io/badge/Oak%20Ridge-National%20Laboratory-00629b)](https://ornl.gov)

</div>

---

![SmartGIScavp UI](docs/screenshots/ui-main.png)

---

## What is SmartGIScavp?

SmartGIScavp is a full-stack app builder that lets you **describe** what you want, pick an LLM, and watch a production-quality multi-page React app get generated, built, and served — live — in your browser.

It uses a **Thinker → Coder** dual-model pipeline:

```
Your description
      ↓
  [Thinker LLM]  ← plans architecture, reasons about structure
      ↓
  [Coder LLM]   ← writes all React/JSX files
      ↓
  Vite build    ← compiles & bundles
      ↓
  Runtime review ← LLM checks for crashes, fixes them
      ↓
  Live iframe preview + download
```

Page types supported:
- **Home** — hero banners, metric cards, CTAs
- **Base** — data tables, charts, dashboards  
- **Geo / Map** — Leaflet maps with CSV data, heatmaps, polylines

---

## Quick Start

### Option A — Docker (Recommended)

```bash
git clone https://github.com/jtupayachi/nsrd_ui.git
cd nsrd_ui/nsrd_ui
docker compose up --build
```

Open **http://localhost:8432** in your browser.

> **Port 8432** is exposed. Change it in `docker-compose.yml` → `ports: "XXXX:80"` if needed.

### Option B — Local Development

```bash
cd nsrd_ui
npm install
# Terminal 1 — Express backend
node server.js
# Terminal 2 — React frontend
npm start
```

Frontend → http://localhost:3000  
Backend  → http://localhost:80 (or `PORT` env var)

---

## Connecting Your Ollama Server

SmartGIScavp works with any Ollama instance — local, remote, or behind auth.

### 1. Local Ollama (default port)

Edit **`nsrd_ui/server.js`** and **`nsrd_ui/pipeline.js`**:

```js
// Before (Viridian cluster):
const OLLAMA_HOST = 'https://ollama.viridian.ise.utk.edu';
const USERNAME    = 'ollama_user';
const PASSWORD    = 'ollama4Viridian';

// After (local):
const OLLAMA_HOST = 'http://localhost:11434';
const USERNAME    = '';   // no auth for local
const PASSWORD    = '';
```

Remove the auth header lines if your Ollama has no password:

```js
// Remove or comment out:
const authHeader = 'Basic ' + Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
```

Also remove `Authorization` from any `axios` call headers in those files.

### 2. Remote Ollama with Basic Auth

```js
const OLLAMA_HOST = 'https://your-ollama-server.example.com';
const USERNAME    = 'your_username';
const PASSWORD    = 'your_password';
const authHeader  = 'Basic ' + Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
```

### 3. Remote Ollama with API Key (Bearer token)

```js
const OLLAMA_HOST = 'https://your-ollama-server.example.com';
const authHeader  = 'Bearer YOUR_API_KEY_HERE';
```

Then in `axios` calls, set:

```js
headers: { Authorization: authHeader }
```

### 4. Verify the connection

```bash
curl http://localhost:11434/api/tags
# Should return JSON with your available models
```

> Ollama must be running with the models you want. Download models with:
> ```bash
> ollama pull qwen3-coder:30b
> ollama pull llama3.2
> ```

---

## Selecting Models in the UI

SmartGIScavp uses two roles:

| Role | Purpose | Recommended |
|---|---|---|
| **Thinker** | Plans architecture, reasons step-by-step | `qwen3-coder-next` · `qwen3:30b` · `llama3.2` |
| **Coder** | Writes all JSX/React files | `qwen3-coder:30b` · `codellama:34b` · `deepseek-coder:33b` |

**Thinker = bigger/smarter model.** Coder = fast code-focused model.

You can use the **same model for both** if compute is limited.

---

## Adding Anthropic Claude

In the UI, switch the **Engine** selector to `Anthropic`. Then set your key in `.env`:

```bash
# nsrd_ui/.env
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
```

Supported models: `claude-opus-4-5`, `claude-sonnet-4-5`, `claude-3-5-haiku`

---

## Full Demo Walkthrough

1. **Open** http://localhost:8432
2. **Add a page** — click `+ Add Page` in the sidebar
3. **Name it** and pick a type (Home / Base / Geo / Map)
4. **Describe it** — write natural language requirements, e.g.:
   > *"A dashboard page with a bar chart of species counts by site, a filterable data table, and a header with the project title EcoWatch"*
5. **Upload an SVG mockup** (optional) — draw a wireframe and the LLM will follow it
6. **Upload CSV data** (optional, for Geo pages) — lat/lng columns are detected automatically
7. **Select models** — pick your Thinker and Coder models from the dropdowns
8. **Click Generate & Deploy** — watch the pipeline run in the right panel
9. **Live preview** — the app appears in the iframe when complete
10. **Download** — get a `.tar.gz` of the full source (`npm install && npm run dev` to run it)

---

## Project Structure

```
nsrd_ui/
├── nsrd_ui/                   ← Main application (git root)
│   ├── src/                   ← React frontend (TypeScript)
│   │   ├── App.tsx            ← Main UI component
│   │   ├── App.css            ← Swiss brutalist theme
│   │   └── components/        ← FileUpload, SVGEditor, ModelSelector, TabHealthBadges
│   ├── server.js              ← Express backend + Ollama proxy
│   ├── pipeline.js            ← Thinker→Coder→Build pipeline
│   ├── sanitizer.js           ← LLM output validation & repair
│   ├── referenceAnalyzer_rag.js ← RAG retrieval from golden examples
│   ├── rag_server.py          ← Python FAISS + sentence-transformers
│   ├── templates/react-app/   ← Vite template for generated apps
│   ├── reference-codebases/   ← Golden example components for RAG
│   ├── Dockerfile
│   └── docker-compose.yml
├── docs/
│   ├── screenshots/
│   └── deployment/
└── README.md
```

---

## RAG-Assisted Code Generation

SmartGIScavp includes a **FAISS-based RAG engine** that retrieves relevant golden-example components before generating code. This dramatically improves code quality for charts, maps, and data tables.

The Python microservice runs inside Docker automatically:

```bash
# Manually rebuild the RAG index:
docker exec nsrd-ui python3 rag_server.py
```

Golden examples live in `reference-codebases/golden-examples/src/` — add your own `.jsx` files there to extend what the LLM can reference.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `80` | Express backend port |
| `NODE_ENV` | `production` | Node environment |
| `ANTHROPIC_API_KEY` | *(none)* | Enable Anthropic Claude backend |
| `VIRTUAL_HOST` | *(none)* | nginx-proxy hostname for reverse proxy |

Edit `docker-compose.yml` → `environment:` section to set them.

---

## Deployment

### Behind a reverse proxy (nginx-proxy)

```yaml
# docker-compose.yml
environment:
  - VIRTUAL_HOST=your-domain.example.com
  - LETSENCRYPT_HOST=your-domain.example.com
```

### Custom port

```yaml
ports:
  - "9000:80"   # expose on port 9000
```

### Production build only (no volume mounts)

```bash
docker build -t smartgiscavp .
docker run -p 8432:80 smartgiscavp
```

---

## Architecture

```
Browser
  │
  ├─ React 18 (TypeScript) — SmartGIScavp UI
  │     └─ src/App.tsx · components/
  │
  └─ Express.js server (server.js)
        ├─ POST /api/pipeline/run     → start generation job
        ├─ GET  /api/pipeline/stream/:id → SSE event stream
        ├─ GET  /api/models           → proxy Ollama /api/tags
        ├─ POST /api/pipeline/clarify → answer model questions
        └─ GET  /preview/:id/         → serve generated app
              │
              ├─ pipeline.js
              │     ├─ [Thinker LLM] architectural reasoning
              │     ├─ [Coder LLM]   JSX code generation
              │     ├─ Vite build
              │     └─ Runtime review + auto-fix
              │
              ├─ referenceAnalyzer_rag.js ← RAG lookups
              │
              └─ rag_server.py (FastAPI + FAISS)
                    └─ sentence-transformers embeddings
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 · TypeScript · IBM Plex Mono · Playfair Display |
| Backend | Node.js · Express.js · SSE streaming |
| LLM | Ollama · Anthropic Claude · LangChain.js |
| Build | Vite · Tailwind CSS (generated apps) |
| RAG | Python · FastAPI · FAISS · sentence-transformers |
| Deploy | Docker · nginx |

---

## Contributing

Pull requests welcome. For major changes, open an issue first.

Golden example components in `reference-codebases/golden-examples/src/` are especially valuable — high-quality React components improve LLM output for everyone.

---

## License

MIT © Oak Ridge National Laboratory

---

<div align="center">
<sub>SmartGIScavp · Oak Ridge National Laboratory · Built with Ollama + React</sub>
</div>
