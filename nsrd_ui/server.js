const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const pipeline = require('./pipeline');

const app = express();
const PORT = process.env.PORT || 80;

// Projects directory - where we'll save all projects
const PROJECTS_DIR = path.join(__dirname, 'projects');

// Deduplicate pipeline runs — keyed by a fingerprint of the request body
// so a client reconnect does not launch a second generation.
const activeRuns = new Map(); // fingerprint → { projectId, promise }

// ─── Async job store ──────────────────────────────────────────────────────────
// Buffers every SSE event so clients can disconnect and reconnect without losing
// progress.  The GET /api/pipeline/stream/:projectId endpoint replays the buffer
// from Last-Event-ID+1 then subscribes to future events.
const activeJobs = new Map();
// Map<projectId, { status: 'running'|'done'|'error', events: string[], clients: Set<res> }>

function jobCreate(projectId) {
  const job = { status: 'running', events: [], clients: new Set(), pendingClarification: null };
  activeJobs.set(projectId, job);
  setTimeout(() => activeJobs.delete(projectId), 2 * 60 * 60 * 1000); // TTL 2 h
  return job;
}

function jobWrite(job, data) {
  // Token events are live-only — skip buffering to keep the replay buffer small.
  // Replaying thousands of tiny token chunks is useless and causes the client to
  // reconnect-loop when replaying from id 0 every time.
  if (data.token) {
    for (const client of [...job.clients]) {
      try { client.write(`data: ${JSON.stringify(data)}\n\n`); } catch { job.clients.delete(client); }
    }
    return;
  }
  const eventId = job.events.length;
  const line = `id: ${eventId}\ndata: ${JSON.stringify(data)}\n\n`;
  job.events.push(line);
  if (data.step === 'complete') job.status = 'done';
  if (data.step === 'error')    job.status = 'error';
  for (const client of [...job.clients]) {
    try { client.write(line); } catch { job.clients.delete(client); }
  }
}

// ─── Detect situations that need user clarification before auto-fixing ───────
// Returns a question string when the pipeline cannot make a safe choice alone,
// or null when auto-repair is appropriate.
function detectDataMismatchQuestion(pageCtx) {
  if (!pageCtx || pageCtx.type !== 'geovisualization' || !pageCtx.csvFile) return null;
  const headerLine = pageCtx.csvFile.content.split('\n')[0] || '';
  const cols = headerLine.split(',').map(c => c.trim());
  const lower = cols.map(c => c.toLowerCase());
  const hasLat = lower.some(c => /^lat/.test(c) || c === 'y' || c === 'latitude');
  const hasLng = lower.some(c => /^lon|^lng/.test(c) || c === 'x' || c === 'longitude');
  if (!hasLat || !hasLng) {
    return [
      `The page "${pageCtx.name}" is a geovisualization (map) but its CSV has no latitude/longitude columns.`,
      `CSV columns found: ${cols.join(', ')}`,
      ``,
      `What should I do? Please choose one:`,
      `  a) lat=<col>, lng=<col>  — treat existing columns as coordinates (e.g. lat=y, lng=x)`,
      `  b) chart                 — render this page as a chart/table instead`,
      `  c) placeholder           — keep the map with hardcoded example coordinates`,
    ].join('\n');
  }
  return null;
}

// Ollama configuration — set these in .env (never hardcode credentials)
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const USERNAME    = process.env.OLLAMA_USER || '';
const PASSWORD    = process.env.OLLAMA_PASSWORD || '';

// Create auth header — empty string when no credentials are configured
const authHeader = (USERNAME && PASSWORD)
  ? 'Basic ' + Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')
  : (process.env.OLLAMA_API_KEY ? `Bearer ${process.env.OLLAMA_API_KEY}` : '');

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Initialize projects directory
async function initProjectsDir() {
  try {
    await fs.mkdir(PROJECTS_DIR, { recursive: true });
    console.log(`📁 Projects directory initialized: ${PROJECTS_DIR}`);
  } catch (error) {
    console.error('Error creating projects directory:', error);
  }
}

initProjectsDir();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend proxy server is running' });
});

// Save project to physical folder
app.post('/api/project/save', async (req, res) => {
  try {
    const { project } = req.body;
    
    if (!project || !project.id || !project.folderName) {
      return res.status(400).json({
        error: 'Invalid project data',
        message: 'Project must have id and folderName'
      });
    }

    const projectDir = path.join(PROJECTS_DIR, project.id);
    
    // Create project directory
    await fs.mkdir(projectDir, { recursive: true });
    
    // Save project metadata
    const metadataPath = path.join(projectDir, 'project.json');
    await fs.writeFile(metadataPath, JSON.stringify(project, null, 2));
    
    // Save each page's data files
    for (const page of project.pages) {
      if (page.dataFile) {
        const dataFilePath = path.join(projectDir, `page_${page.id}_data.csv`);
        await fs.writeFile(dataFilePath, page.dataFile.content);
      }
      
      if (page.mockupFile) {
        const mockupFilePath = path.join(projectDir, `page_${page.id}_mockup.svg`);
        await fs.writeFile(mockupFilePath, page.mockupFile.content);
      }
    }
    
    console.log(`✅ Project saved: ${project.id} (${project.folderName})`);
    
    res.json({
      success: true,
      message: 'Project saved successfully',
      projectId: project.id,
      path: projectDir
    });
  } catch (error) {
    console.error('Error saving project:', error);
    res.status(500).json({
      error: 'Failed to save project',
      message: error.message
    });
  }
});

// Update a specific file in the project
app.post('/api/project/update-file', async (req, res) => {
  try {
    const { projectId, filePath: relFilePath, content } = req.body;
    
    if (!projectId || !relFilePath || content === undefined) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'projectId, filePath, and content are required'
      });
    }

    const projectDir = path.join(PROJECTS_DIR, projectId);
    
    // Check if project exists
    try {
      await fs.access(projectDir);
    } catch {
      return res.status(404).json({
        error: 'Project not found',
        message: `Project ${projectId} does not exist`
      });
    }

    // Construct full file path (ensure it's within project directory)
    const fullFilePath = path.join(projectDir, relFilePath);
    if (!fullFilePath.startsWith(projectDir)) {
      return res.status(400).json({
        error: 'Invalid file path',
        message: 'File path must be within project directory'
      });
    }

    // Ensure parent directory exists
    const fileDir = path.dirname(fullFilePath);
    await fs.mkdir(fileDir, { recursive: true });
    
    // Write the updated content
    await fs.writeFile(fullFilePath, content, 'utf8');
    
    console.log(`✅ File updated: ${relFilePath} in project ${projectId}`);
    
    res.json({
      success: true,
      message: 'File updated successfully',
      filePath: relFilePath
    });
  } catch (error) {
    console.error('Error updating file:', error);
    res.status(500).json({
      error: 'Failed to update file',
      message: error.message
    });
  }
});

// Rebuild project after manual file edits
// Reads current src/ files from disk, then re-runs the full Vite build via deploy().
app.post('/api/project/rebuild', async (req, res) => {
  try {
    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId required' });

    const projectDir = path.join(PROJECTS_DIR, projectId);
    try { await fs.access(projectDir); }
    catch { return res.status(404).json({ error: 'Project not found' }); }

    // Collect all src/ files BEFORE deploy() wipes the project directory
    const srcDir = path.join(projectDir, 'src');
    const files = [];
    async function walkSrc(dir, relPrefix) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const absPath = path.join(dir, e.name);
        const relPath = relPrefix + '/' + e.name;
        if (e.isDirectory()) {
          await walkSrc(absPath, relPath);
        } else {
          files.push({ path: relPath, content: await fs.readFile(absPath, 'utf8') });
        }
      }
    }
    await walkSrc(srcDir, 'src');

    await pipeline.deploy(projectId, files);
    console.log(`[Rebuild] Project ${projectId} rebuilt (${files.length} src files)`);
    res.json({ success: true, previewUrl: `/preview/${projectId}/` });
  } catch (err) {
    console.error('[Rebuild] Error:', err);
    res.status(500).json({ error: 'Rebuild failed', message: err.stderr || err.message });
  }
});

// ── Download project as tar.gz ──────────────────────────────────────────────
// Streams a tar.gz of the project src/ directory so the user can save and
// open it locally (untar → npm install → npm run dev).
app.get('/api/project/download/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const projectDir = path.join(PROJECTS_DIR, projectId);
    try { await fs.access(projectDir); }
    catch { return res.status(404).json({ error: 'Project not found' }); }

    const filename = `${projectId}.tar.gz`;
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Stream tar directly to the response — no temp file needed
    const { spawn } = require('child_process');
    const tar = spawn('tar', [
      '-czf', '-',                  // write compressed archive to stdout
      '-C', projectDir,             // change into project dir first
      '--exclude=node_modules',
      '--exclude=dist',
      '--exclude=.cache',
      '.',                          // archive everything else (src/, package.json, vite.config…)
    ]);

    tar.stdout.pipe(res);
    tar.stderr.on('data', d => console.error('[Download] tar stderr:', d.toString()));
    tar.on('close', code => {
      if (code !== 0) console.error(`[Download] tar exited with code ${code}`);
    });
    req.on('close', () => tar.kill());

  } catch (err) {
    console.error('[Download] Error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Download failed', message: err.message });
  }
});

// Load project from physical folder
app.get('/api/project/load/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const projectDir = path.join(PROJECTS_DIR, projectId);
    
    // Check if project exists
    try {
      await fs.access(projectDir);
    } catch {
      return res.status(404).json({
        error: 'Project not found',
        message: `No project found with ID: ${projectId}`
      });
    }
    
    // Load project metadata
    const metadataPath = path.join(projectDir, 'project.json');
    const projectData = await fs.readFile(metadataPath, 'utf-8');
    const project = JSON.parse(projectData);
    
    // Load data files for each page
    for (const page of project.pages) {
      const dataFilePath = path.join(projectDir, `page_${page.id}_data.csv`);
      const mockupFilePath = path.join(projectDir, `page_${page.id}_mockup.svg`);
      
      try {
        const dataContent = await fs.readFile(dataFilePath, 'utf-8');
        page.dataFile = {
          type: 'csv',
          content: dataContent,
          name: `page_${page.id}_data.csv`
        };
      } catch {
        // File doesn't exist, skip
      }
      
      try {
        const mockupContent = await fs.readFile(mockupFilePath, 'utf-8');
        page.mockupFile = {
          content: mockupContent,
          name: `page_${page.id}_mockup.svg`
        };
      } catch {
        // File doesn't exist, skip
      }
    }
    
    console.log(`📂 Project loaded: ${projectId}`);
    
    res.json({
      success: true,
      project
    });
  } catch (error) {
    console.error('Error loading project:', error);
    res.status(500).json({
      error: 'Failed to load project',
      message: error.message
    });
  }
});

// List all projects
app.get('/api/projects/list', async (req, res) => {
  try {
    const projects = [];
    const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const metadataPath = path.join(PROJECTS_DIR, entry.name, 'project.json');
        try {
          const data = await fs.readFile(metadataPath, 'utf-8');
          const project = JSON.parse(data);
          projects.push({
            id: project.id,
            folderName: project.folderName,
            createdAt: project.createdAt,
            lastModified: project.lastModified,
            pageCount: project.pages.length
          });
        } catch {
          // Skip invalid projects
        }
      }
    }
    
    res.json({
      success: true,
      projects
    });
  } catch (error) {
    console.error('Error listing projects:', error);
    res.status(500).json({
      error: 'Failed to list projects',
      message: error.message
    });
  }
});

// Get available models from Ollama
app.get('/api/ollama/tags', async (req, res) => {
  try {
    console.log('Fetching models from Viridian Ollama...');
    console.log(`URL: ${OLLAMA_HOST}/api/tags`);
    
    const response = await axios.get(`${OLLAMA_HOST}/api/tags`, {
      headers: {
        'Authorization': authHeader
      },
      timeout: 15000, // 15 second timeout
      validateStatus: function (status) {
        return status < 500; // Resolve only if status is less than 500
      }
    });
    
    if (response.status === 200) {
      console.log(`Successfully fetched ${response.data.models?.length || 0} models`);
      res.json(response.data);
    } else if (response.status === 401 || response.status === 403) {
      console.error('Authentication failed:', response.status, response.statusText);
      res.status(response.status).json({
        error: 'Authentication failed',
        message: 'Invalid credentials for Viridian Ollama server',
        status: response.status
      });
    } else {
      console.error('Unexpected status:', response.status, response.statusText);
      res.status(response.status).json({
        error: 'Server error',
        message: response.statusText || 'Unknown error from Ollama server',
        status: response.status
      });
    }
  } catch (error) {
    console.error('Error fetching models:');
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    
    if (error.response) {
      // Server responded with error
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      res.status(error.response.status).json({
        error: 'Server responded with error',
        message: error.message,
        status: error.response.status,
        details: error.response.data
      });
    } else if (error.request) {
      // Request made but no response
      console.error('No response received from server');
      res.status(503).json({
        error: 'Cannot reach Ollama server',
        message: 'The Viridian Ollama server is not responding. It may be down or unreachable.',
        hint: 'Check if the server is accessible from this network'
      });
    } else {
      // Error setting up request
      console.error('Request setup error:', error.message);
      res.status(500).json({
        error: 'Failed to fetch models',
        message: error.message
      });
    }
  }
});

// Generate text using Ollama (STREAMING)
app.post('/api/ollama/generate', async (req, res) => {
  try {
    const { model, prompt } = req.body;
    
    if (!model || !prompt) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Both model and prompt are required'
      });
    }

    console.log(`Generating with model: ${model}`);
    console.log(`Prompt length: ${prompt.length} characters`);
    
    // Always stream from Ollama — prevents upstream proxy timeouts
    const response = await axios.post(
      `${OLLAMA_HOST}/api/generate`,
      { model, prompt, stream: true },
      {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        responseType: 'stream',
        timeout: 600000, // 10 minute timeout for generation
      }
    );
    
    console.log('Ollama stream connected, piping to client…');

    // Stream the response back to the browser
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // tell nginx-proxy not to buffer

    response.data.on('data', (chunk) => {
      res.write(chunk);
    });

    response.data.on('end', () => {
      console.log('Generation stream complete');
      res.end();
    });

    response.data.on('error', (err) => {
      console.error('Stream error from Ollama:', err.message);
      res.end();
    });

    // If client disconnects early, abort the Ollama request
    req.on('close', () => {
      response.data.destroy();
    });
  } catch (error) {
    console.error('Error generating text:');
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      res.status(error.response.status).json({
        error: 'Server error during generation',
        message: error.message,
      });
    } else if (error.request) {
      console.error('No response from server during generation');
      res.status(503).json({
        error: 'Cannot reach Ollama server',
        message: 'The Viridian Ollama server is not responding during generation. It may be down or the request timed out.'
      });
    } else {
      console.error('Request setup error:', error.message);
      res.status(500).json({
        error: 'Failed to generate text',
        message: error.message
      });
    }
  }
});

// ═══ PIPELINE ENDPOINT ════════════════════════════════
// Runs the full Generate → Extract → Deploy → Fix loop.
// Immediately returns { projectId } as JSON, then runs the pipeline
// fully async in the background. The client subscribes to progress via
// GET /api/pipeline/stream/:projectId (all events are buffered there).
app.post('/api/pipeline/run', (req, res) => {
  const { pages, model, thinkerModel, existingProjectId, experimentMode } = req.body;
  if (!pages || !model) {
    return res.status(400).json({ error: 'pages and model required' });
  }
  const thinkModel = thinkerModel || pipeline.THINKER_MODEL;

  const projectId = (existingProjectId && existingProjectId.trim())
    ? existingProjectId.trim()
    : 'proj_' + crypto.randomBytes(6).toString('hex');
  const job = jobCreate(projectId);

  // Respond immediately — pipeline runs in background.
  res.json({ projectId });

  // Fire-and-forget: errors are written into the job event buffer.
  (async () => {
  const trimmedPages = pages.map((pg) => {
    if (!pg.csvFile) return pg;
    const lines = pg.csvFile.content.split('\n');
    if (lines.length <= 51) return pg; // header + 50 rows already fits
    const truncated = lines.slice(0, 51).join('\n') + `\n… (${lines.length - 51} more rows truncated)`;
    console.log(`[Pipeline] CSV truncated: ${lines.length} → 51 rows for page "${pg.name}"`);
    return { ...pg, csvFile: { ...pg.csvFile, content: truncated } };
  });

  // Create the job entry BEFORE opening SSE so the reconnect endpoint can
  // find it immediately if the client disconnects during the very first event.

  // All SSE writes go through jobWrite so events are buffered for reconnect.
  const send = (data) => jobWrite(job, data);

  // Pause the pipeline and ask the user a question.
  // Emits a 'clarification' SSE event then waits until POST /api/pipeline/clarify/:id is called.
  // Resolves with the user's plain-text answer so the caller can continue the loop.
  const askUser = (questionId, question, context = {}) => new Promise((resolve, reject) => {
    job.pendingClarification = { resolve, reject };
    send({ step: 'clarification', status: 'waiting', questionId, question, context,
      message: `❓ Clarification needed — waiting for your reply…` });
    console.log(`[Pipeline] Awaiting clarification [${questionId}]: ${question.split('\n')[0]}`);
  });

  // If merging into an existing project, pre-load its current src files so
  // pages that were NOT re-generated are preserved in the final deploy.
  let existingFiles = [];
  if (existingProjectId && existingProjectId.trim()) {
    try {
      const existingSrcDir = path.join(PROJECTS_DIR, projectId, 'src');
      const walkExisting = async (dir, prefix) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
          const abs = path.join(dir, e.name);
          const rel = prefix + '/' + e.name;
          if (e.isDirectory()) await walkExisting(abs, rel);
          else existingFiles.push({ path: rel, content: await fs.readFile(abs, 'utf8') });
        }
      };
      await walkExisting(existingSrcDir, 'src');
      send({ step: 'merging', status: 'running', message: `📂 Loaded ${existingFiles.length} existing files from project ${projectId} — new pages will be merged in` });
    } catch {
      // Project folder not found — treat as fresh generation
      existingFiles = [];
    }
  }

  try {
    // ── Step 0: Scaffold (deterministic routing — no LLM) ──
    // Emit the projectId immediately as event #0 so the frontend can store it
    // before any slow LLM calls begin — critical for reconnect support.
    send({ step: 'start', projectId, status: 'running', message: `Job ${projectId} started` });
    const scaffoldFiles = pipeline.scaffoldApp(pages);
    send({ step: 'scaffolding', status: 'done', files: scaffoldFiles.map((f) => f.path), message: `Scaffolded ${scaffoldFiles.length} files (App.jsx + App.css — routing is fixed)` });

    // ── Outer regeneration loop: up to 5 full regenerations × 5 fix attempts = 25 total ──
    const MAX_REGEN = 1; // 0‥1 → 2 total generations from scratch
    const MAX_FIX   = 7; // 0‥7 → 8 build/fix attempts per generation
    let regenAttempt = 0;
    let lastFiles = null;
    let lastFixAttempt = 0;
    const { getRelevantExamples } = require('./referenceAnalyzer_rag');

    while (regenAttempt <= MAX_REGEN) {
      if (regenAttempt > 0) {
        send({
          step: 'regenerating',
          status: 'running',
          message: `♻️ Regenerating from scratch (generation ${regenAttempt + 1} of ${MAX_REGEN + 1})…`,
        });
      }

      try {
        // ── Step 1: Deep Think (Architecture) ──
        send({ step: 'thinking', status: 'running', message: `📦 Loading thinker model ${thinkModel}… (this may take 60–120s for large models)` });
        const thinkPrompt = pipeline.buildThinkPrompt(trimmedPages, { experimentMode });
        console.log(`[Pipeline] Project ${projectId} — gen ${regenAttempt + 1}, thinker: ${thinkModel}, coder: ${model}`);
        console.log(`[Pipeline] Project ${projectId} — think prompt ${thinkPrompt.length} chars`);
        let thinkTokenCount = 0;
        const thinkRaw = await pipeline.think(thinkModel, thinkPrompt, (tok) => {
          if (thinkTokenCount === 0) send({ step: 'thinking', status: 'running', message: `🧠 Deep thinking with ${thinkModel}… (gen ${regenAttempt + 1}/${MAX_REGEN + 1})` });
          thinkTokenCount++;
          send({ step: 'thinking', token: tok });
        });
        // Explicitly unload thinker before loading coder — frees VRAM immediately
        send({ step: 'thinking', status: 'done', message: `Architecture plan ready — unloading thinker…` });
        await pipeline.unloadModel(thinkModel);
        const architecturePlan = pipeline.extractPlan(thinkRaw);

        // Guard: if thinker returned nothing, retry the generation immediately
        if (!architecturePlan || architecturePlan.trim().length < 20) {
          console.warn(`[Pipeline] Thinker returned empty/tiny plan (${(architecturePlan || '').length} chars) — forcing regen`);
          throw new Error('Thinker returned empty plan — regenerating');
        }

        // Get RAG examples for the agent.
        // Every interface field contributes to the query vector:
        //   name + type       → page category
        //   requirements      → natural language intent (primary signal)
        //   CSV header row    → data shape (lat/lng → map; date → timeseries…)
        //   SVG id/class names → layout regions (sidebar, map, chart, table, legend…)
        const ragQuery = trimmedPages.map(pg => {
          const parts = [pg.name, pg.type, pg.requirements || ''];
          if (pg.csvFile) {
            const csvHeader = pg.csvFile.content.split('\n')[0] || '';
            parts.push(`CSV columns: ${csvHeader}`);
          }
          if (pg.svgFile) {
            const svgTokens = [...pg.svgFile.content.matchAll(/(?:id|class)="([^"]+)"|<(\w+)/g)]
              .map(m => (m[1] || m[2] || '').toLowerCase())
              .filter(t => t.length > 2 && !['svg','defs','path','rect','g','use'].includes(t))
              .slice(0, 20)
              .join(' ');
            parts.push(svgTokens ? `SVG layout regions: ${svgTokens}` : 'SVG layout mockup provided');
          }
          return parts.join(' ');
        }).join(' | ');
        const { summary: ragSummary } = getRelevantExamples(ragQuery, 4);
        if (ragSummary) {
          const fileRefs = ragSummary.split('\n').filter(l => l.startsWith('File:')).map(l => l.replace('File:', '').trim());
          console.log(`[RAG] Code phase: ${fileRefs.length} example(s) — ${fileRefs.join(', ') || '(no file refs)'}`);
          console.log(`[RAG] Content preview:\n${ragSummary.slice(0, 500)}`);
        } else {
          console.log('[RAG] Code phase: no examples retrieved');
        }

        // ── Step 2: Analyze CSV data (before generation) ──
        const csvPages = trimmedPages.filter(pg => pg.csvFile);
        if (csvPages.length > 0) {
          const analyses = csvPages.map(pg => {
            const safe = pg.name.replace(/[^a-zA-Z0-9]/g, '');
            const a = pipeline.analyzeCSV(pg.csvFile.content);
            const rolesStr = Object.entries(a.roles).filter(([,v])=>v).map(([r,c])=>`${c}→${r}`).join(', ');
            return `${safe}: ${a.cols.length} columns, ${a.parsedRows} rows${rolesStr ? ` | ${rolesStr}` : ''}${a.roles.lat ? ` | center:[${a.mapCenter}] zoom:${a.mapZoom}` : ''}`;
          });
          send({ step: 'analyzing', status: 'done', message: `📊 CSV analyzed — ${analyses.join(' | ')}` });
          console.log(`[Pipeline] CSV analysis: ${analyses.join(' | ')}`);
        }

        // ── Step 3: Generate page files (streaming chat) ──
        send({ step: 'generating', status: 'running', message: `⏳ Loading coder ${model}… (may take 60–120s for large models)` });
        const messages = pipeline.buildChatMessages(trimmedPages, architecturePlan, ragSummary, { experimentMode });
        const coderPromptChars = messages.reduce((s, m) => s + (m.content || '').length, 0);
        console.log(`[Pipeline] Coder prompt: ${coderPromptChars} chars (${messages.length} messages, gen ${regenAttempt + 1})`);
        // Surface the full prompt over SSE so external test harnesses can log it.
        send({
          step: 'prompt',
          phase: 'generate',
          gen: regenAttempt + 1,
          model,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        });
        let genTokenCount = 0;
        const rawCode = await pipeline.chat(model, messages, (tok) => {
          if (genTokenCount === 0) send({ step: 'generating', status: 'running', message: `💬 Generating code with ${model}…` });
          genTokenCount++;
          send({ step: 'generating', token: tok });
        });
        // Prepend prefill so extractFiles sees the full ===FILE: header
        const lastAssistant = messages.at(-1)?.role === 'assistant' ? messages.at(-1).content : '';
        const rawCodeFull = lastAssistant ? lastAssistant + '\n' + rawCode : rawCode;
        send({ step: 'generating', status: 'done', message: `Code generated (${rawCode.length} chars) — unloading coder…` });
        console.log(`[Pipeline] Coder output: ${rawCode.length} chars (gen ${regenAttempt + 1})`);
        await pipeline.unloadModel(model);

        // ── Step 3: Extract + sanitize files ──
        let llmFiles = pipeline.extractFiles(rawCodeFull);
        // Remove any App.jsx/App.css the LLM generated — scaffold owns those
        llmFiles = llmFiles.filter((f) => f.path !== 'src/App.jsx' && f.path !== 'src/App.css');

        // Guard: if coder produced no extractable page files, retry
        const llmPageFiles = llmFiles.filter(f => f.path.startsWith('src/pages/'));
        if (llmPageFiles.length === 0) {
          console.warn(`[Pipeline] Coder produced 0 page files from ${rawCode.length} chars output — forcing regen`);
          throw new Error('Coder produced no extractable page files — regenerating');
        }

        // Normalize page filenames to match scaffold imports
        const expectedPageNames = trimmedPages.map((pg) => pg.name.replace(/[^a-zA-Z0-9]/g, ''));
        const pageFiles = llmFiles.filter((f) => f.path.startsWith('src/pages/'));
        const otherFiles = llmFiles.filter((f) => !f.path.startsWith('src/pages/'));
        const renamedPages = pageFiles.map((f, idx) => {
          const name = expectedPageNames[idx];
          if (!name) return f;
          const expected = `src/pages/${name}.jsx`;
          if (f.path !== expected) console.log(`[Pipeline] Renaming ${f.path} → ${expected}`);
          return { ...f, path: expected };
        });
        llmFiles = [...renamedPages, ...otherFiles];

        let files = [...scaffoldFiles, ...llmFiles];
        const sanitized = pipeline.sanitizeFiles(files);
        files = sanitized.files;
        if (sanitized.report.totalFixes > 0) {
          console.log(`[Pipeline] Sanitizer fixed ${sanitized.report.totalFixes} issue(s)`);
          send({ step: 'sanitizing', status: 'done', message: `Auto-fixed ${sanitized.report.totalFixes} syntax issue(s)` });
        }

        // Merge with existing project files: new files overwrite, old files kept
        if (existingFiles.length > 0) {
          const newPaths = new Set(files.map(f => f.path));
          const preserved = existingFiles.filter(f =>
            !newPaths.has(f.path) &&
            f.path !== 'src/App.jsx' &&
            f.path !== 'src/App.css'
          );
          if (preserved.length > 0) {
            send({ step: 'merging', status: 'done', message: `🔀 Merged: kept ${preserved.length} existing page(s), added/replaced ${newPaths.size} new file(s)` });
            files = [...files, ...preserved];
          }
        }

        // ── Step 3.5: Static white-screen detection + auto-fix (no model call) ──
        const wsIssues = pipeline.detectWhiteScreen(files, trimmedPages);
        if (wsIssues.length > 0) {
          const wsSummary = wsIssues.map(({ file, issues }) =>
            `  ${file.split('/').pop()}:\n${issues.map(i => `    • ${i}`).join('\n')}`
          ).join('\n');
          send({ step: 'whitescreencheck', status: 'warning', message: `⚠️ White-screen patterns detected — auto-fixing…\n${wsSummary}` });
        }
        const { files: wsFixed, fixed: wsLog } = pipeline.autoFixWhiteScreen(files);
        if (wsLog.length > 0) {
          const wsMsg = wsLog.map(f => `  ✅ ${f.file.split('/').pop()}: ${f.description}`).join('\n');
          send({ step: 'whitescreencheck', status: 'done', message: `🔧 Auto-patched before build:\n${wsMsg}` });
          files = wsFixed;
        }

        // ── Step 4: Build + fix loop (up to 5 attempts per generation) ──
        let attempt = 0;
        lastFiles = files;
        const fixHistory = new Map(); // path → [{errors, code, result}]
        let reviewPassed = false;     // runtime review runs at most once per generation

        while (attempt <= MAX_FIX) {
          send({
            step: 'deploying',
            status: 'running',
            message: `🔨 Building — gen ${regenAttempt + 1}/${MAX_REGEN + 1}, fix ${attempt + 1}/${MAX_FIX + 1}…`,
          });
          try {
            await pipeline.deploy(projectId, lastFiles);
            send({
              step: 'deploying',
              status: 'done',
              message: `✅ Build succeeded (gen ${regenAttempt + 1}, fix ${attempt + 1})`,
            });
            lastFixAttempt = attempt;

            // ── Runtime review: ask the coder model to spot issues that compile
            //    fine but crash in the browser (wrong fetch paths, missing L import,
            //    NaN coords, absolute-position overflow, etc.) ──
            const reviewMsgs = pipeline.buildRuntimeReviewMessages(lastFiles, trimmedPages, { experimentMode });
            if (reviewMsgs && !reviewPassed && attempt < MAX_FIX) {
              send({ step: 'reviewing', status: 'running', message: `🔍 Reviewing for runtime issues…` });
              send({
                step: 'prompt',
                phase: 'review',
                gen: regenAttempt + 1,
                fix: attempt + 1,
                model,
                messages: reviewMsgs.map(m => ({ role: m.role, content: m.content })),
              });
              const reviewRaw = await pipeline.chat(model, reviewMsgs, null);
              const issues = pipeline.parseRuntimeIssues(reviewRaw);
              if (issues) {
                console.log(`[Pipeline] Runtime review found issues (gen ${regenAttempt + 1}):\n${issues.slice(0, 600)}`);
                send({ step: 'reviewing', status: 'running', message: `⚠️ Runtime issues found — fixing…\n${issues.slice(0, 400)}` });
                // Re-use the single-file fixer for each affected file
                const affectedPaths = [...lastFiles.filter(f => f.path.startsWith('src/pages/')).map(f => f.path)];
                let updatedFiles = [...lastFiles];
                for (const brokenPath of affectedPaths) {
                  const brokenFile = updatedFiles.find(f => f.path === brokenPath);
                  if (!brokenFile) continue;
                  const pageSafe = brokenPath.replace('src/pages/', '').replace('.jsx', '');
                  const pageCtx = trimmedPages.find(pg => pg.name.replace(/[^a-zA-Z0-9]/g, '') === pageSafe) || null;
                  const history = fixHistory.get(brokenPath) || [];
                  const fixMsgs = pipeline.buildSingleFileFixMessages(
                    brokenPath, brokenFile.content, issues, attempt, history, pageCtx, { experimentMode }
                  );
                  send({
                    step: 'prompt',
                    phase: 'review-fix',
                    gen: regenAttempt + 1,
                    fix: attempt + 1,
                    file: brokenPath,
                    model,
                    messages: fixMsgs.map(m => ({ role: m.role, content: m.content })),
                  });
                  const fixedRaw = await pipeline.chat(model, fixMsgs, (tok) => {
                    send({ step: 'reviewing', token: tok });
                  });
                  const fixPrefill = fixMsgs.at(-1)?.role === 'assistant' ? fixMsgs.at(-1).content : '';
                  const fixedRawFull = fixPrefill ? fixPrefill + '\n' + fixedRaw : fixedRaw;
                  const extracted = pipeline.extractFiles(fixedRawFull).filter(
                    f => f.path !== 'src/App.jsx' && f.path !== 'src/App.css'
                  );
                  const fixedFile = extracted.find(f => f.path === brokenPath)
                    || (extracted.length === 1 ? { ...extracted[0], path: brokenPath } : null);
                  if (fixedFile) {
                    updatedFiles = updatedFiles.map(f => f.path === brokenPath ? fixedFile : f);
                    fixHistory.set(brokenPath, [...history, { errors: issues, code: brokenFile.content, result: fixedFile.content }]);
                  }
                }
                const reviewSanitized = pipeline.sanitizeFiles(updatedFiles);
                lastFiles = reviewSanitized.files;
                reviewPassed = true; // don't re-review after the rebuild — one pass is enough
                send({ step: 'reviewing', status: 'done', message: `Runtime fixes applied — rebuilding…` });
                attempt++; // consume one fix slot for the rebuild
                continue;  // go back to top of while loop to rebuild once
              } else {
                reviewPassed = true;
                send({ step: 'reviewing', status: 'done', message: `✅ No runtime issues detected` });
              }
            }

            break; // build + review passed — done
          } catch (buildErr) {
            const errors = buildErr.stderr || buildErr.stdout || buildErr.message || String(buildErr);
            console.error(`[Pipeline] Build failed (gen ${regenAttempt + 1}, fix ${attempt + 1}):`, errors.slice(0, 400));
            if (buildErr.stack && !buildErr.stderr) {
              // Not a Vite build error — log stack trace to find JS bug
              console.error('[Pipeline] Build error stack:', buildErr.stack);
            }
            const isFinalAttempt = attempt >= MAX_FIX && regenAttempt >= MAX_REGEN;
            send({
              step: 'build-output',
              // Intermediate failures inside the fix loop are recoverable — emit
              // 'warning' so the UI doesn't show a red ❌ when a later attempt
              // succeeds. Only the truly terminal failure (last fix of last
              // regeneration) is a hard error.
              status: isFinalAttempt ? 'error' : 'warning',
              message: isFinalAttempt
                ? `Build failed (gen ${regenAttempt + 1}, fix ${attempt + 1}) — no more attempts`
                : `Build attempt failed (gen ${regenAttempt + 1}, fix ${attempt + 1}) — retrying…`,
              stderr: errors,
              stdout: buildErr.stdout || '',
              intermediate: !isFinalAttempt,
            });

            if (attempt >= MAX_FIX) {
              // All fix attempts exhausted for this generation — throw so outer regen loop catches it
              throw new Error(`Build failed after ${MAX_FIX + 1} fix attempts. Last error:\n${errors}`);
            }

            // ── Per-file targeted repair ──
            const errorsByFile = pipeline.parseErrorsByFile(errors);
            const brokenPaths = errorsByFile.size > 0
              ? [...errorsByFile.keys()]
              : lastFiles.filter(f => f.path.startsWith('src/pages/')).map(f => f.path);

            send({
              step: 'fixing',
              status: 'running',
              message: `🔧 Fixing ${brokenPaths.length} file(s): ${brokenPaths.map(p => p.split('/').pop()).join(', ')} (gen ${regenAttempt + 1}, fix ${attempt + 1})…`,
            });

            let updatedFiles = [...lastFiles];
            for (const brokenPath of brokenPaths) {
              const brokenFile = updatedFiles.find(f => f.path === brokenPath);
              // brokenFile may be undefined when the file was never generated
              // (e.g. "Could not resolve ./pages/Home.jsx"). Pass null so
              // buildSingleFileFixMessages generates it from scratch.

              const fileErrors = errorsByFile.get(brokenPath) || errors;
              const history = fixHistory.get(brokenPath) || [];

              // Find the page context for this broken file so the fixer knows CSV/SVG data
              const pageSafe = brokenPath.replace('src/pages/', '').replace('.jsx', '');
              const pageCtx = trimmedPages.find(pg => pg.name.replace(/[^a-zA-Z0-9]/g, '') === pageSafe) || null;
              const fixMessages = pipeline.buildSingleFileFixMessages(
                brokenPath, brokenFile ? brokenFile.content : null, fileErrors, attempt, history, pageCtx, { experimentMode }
              );
              send({
                step: 'prompt',
                phase: 'fix',
                gen: regenAttempt + 1,
                fix: attempt + 1,
                file: brokenPath,
                model,
                messages: fixMessages.map(m => ({ role: m.role, content: m.content })),
              });
              const fixedRaw = await pipeline.chat(model, fixMessages, (tok) => {
                send({ step: 'fixing', token: tok });
              });
              // Prepend prefill so extractFiles sees the full ===FILE: header
              const fixPrefill = fixMessages.at(-1)?.role === 'assistant' ? fixMessages.at(-1).content : '';
              const fixedRawFull = fixPrefill ? fixPrefill + '\n' + fixedRaw : fixedRaw;

              const allExtracted = pipeline.extractFiles(fixedRawFull).filter(
                f => f.path !== 'src/App.jsx' && f.path !== 'src/App.css'
              );
              const fixedFile = allExtracted.find(f => f.path === brokenPath)
                || (allExtracted.length === 1 ? { ...allExtracted[0], path: brokenPath } : null);

              if (fixedFile) {
                fixHistory.set(brokenPath, [
                  ...history,
                  { errors: fileErrors, code: brokenFile ? brokenFile.content : null, result: fixedFile.content },
                ]);
                if (brokenFile) {
                  // Replace existing broken file
                  updatedFiles = updatedFiles.map(f => f.path === brokenPath ? fixedFile : f);
                } else {
                  // Insert newly generated file that was previously missing
                  updatedFiles = [...updatedFiles, fixedFile];
                }
                console.log(`[Pipeline] Fix gen ${regenAttempt + 1}, attempt ${attempt + 1}: ${
                  brokenFile ? 'patched' : 'created'} ${brokenPath}`);
              } else {
                console.warn(`[Pipeline] Fix gen ${regenAttempt + 1}, attempt ${attempt + 1}: no output for ${brokenPath}, keeping previous`);
              }
            }

            send({ step: 'fixing', status: 'done', message: `Fix generated, rebuilding…` });

            const fixedSanitized = pipeline.sanitizeFiles(updatedFiles);
            lastFiles = fixedSanitized.files;
            attempt++;
          }
        }

        // Build succeeded — exit regen loop
        break;

      } catch (innerErr) {
        if (regenAttempt >= MAX_REGEN) {
          // All regenerations exhausted — surface the error
          throw innerErr;
        }
        console.warn(`[Pipeline] Generation ${regenAttempt + 1} exhausted all ${MAX_FIX + 1} fix attempts — regenerating from scratch…`);
        console.error(`[Pipeline] Error: ${innerErr.message || innerErr}`);
        if (innerErr.stack) console.error(`[Pipeline] Stack: ${innerErr.stack.split('\n').slice(0, 3).join('\n')}`);
        send({
          step: 'regenerating',
          status: 'error',
          message: `❌ Generation ${regenAttempt + 1}/${MAX_REGEN + 1} exhausted ${MAX_FIX + 1} fix attempts — regenerating from scratch…`,
        });
        regenAttempt++;
      }
    }

    send({
      step: 'complete',
      projectId,
      files: lastFiles,
      previewUrl: `/preview/${projectId}/`,
      message: `✅ Done! (generation ${regenAttempt + 1}/${MAX_REGEN + 1}, build attempt ${lastFixAttempt + 1}/${MAX_FIX + 1})`,
    });
    console.log(`[Pipeline] ✅ Complete event sent for ${projectId} — preview at /preview/${projectId}/`);
  } catch (err) {
    console.error('[Pipeline] Error:', err.message);
    send({ step: 'error', message: err.message });
  } finally {
    job.status = job.status === 'running' ? 'done' : job.status;
  }

  })(); // end background async pipeline
});

// ── User clarification reply ─────────────────────────────────────────────────
// The frontend POSTs the user's answer here; the pipeline is awaiting this call
// via the askUser() Promise defined in the run handler.
app.post('/api/pipeline/clarify/:projectId', (req, res) => {
  const { projectId } = req.params;
  const { answer } = req.body || {};
  const job = activeJobs.get(projectId);
  if (!job) return res.status(404).json({ error: 'Job not found or expired' });
  if (!job.pendingClarification) return res.status(400).json({ error: 'No clarification pending for this job' });
  const { resolve } = job.pendingClarification;
  job.pendingClarification = null;
  // Update the step to 'done' so the UI shows the confirmed answer
  jobWrite(job, { step: 'clarification', status: 'done', message: `💬 You replied: ${String(answer || '').slice(0, 200)}` });
  resolve(String(answer || '').trim());
  res.json({ ok: true });
});

// ── Pipeline SSE reconnect endpoint ──────────────────────────────────────────
// Clients that dropped their connection during a pipeline run reconnect here.
// All buffered events are replayed from Last-Event-ID+1, then the client is
// subscribed to future events until the job completes.
app.get('/api/pipeline/stream/:projectId', (req, res) => {
  const { projectId } = req.params;
  const job = activeJobs.get(projectId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found or expired. The pipeline may have completed or the server was restarted.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Replay events from after Last-Event-ID (browser sends this automatically
  // when using native EventSource after a reconnect).
  const lastId = parseInt(req.headers['last-event-id'] || '-1', 10);
  const replayFrom = Math.max(0, lastId + 1);
  console.log(`[Pipeline] Reconnect: ${projectId}, replaying ${job.events.length - replayFrom} events (from id ${replayFrom})`);
  for (let i = replayFrom; i < job.events.length; i++) {
    res.write(job.events[i]);
  }

  // If job already finished, close after replay.
  if (job.status !== 'running') {
    res.end();
    return;
  }

  // Subscribe to future events.
  job.clients.add(res);
  req.on('close', () => job.clients.delete(res));
});

// ── Serve deployed project previews ───────────────
app.use('/preview', (req, res, next) => {
  const segs = req.path.split('/').filter(Boolean);
  if (!segs.length) return next();
  const projectId = segs[0];
  const distDir = path.join(pipeline.PROJECTS_DIR, projectId, 'dist');
  // Strip the projectId prefix so express.static finds the file
  const origUrl = req.url;
  req.url = '/' + segs.slice(1).join('/') || '/';
  express.static(distDir)(req, res, () => {
    req.url = origUrl;
    // SPA fallback for the generated app's routes
    res.sendFile(path.join(distDir, 'index.html'), (err) => {
      if (err) next();
    });
  });
});

// ── Serve React static build (our builder UI) ─────
const BUILD_DIR = path.join(__dirname, 'build');
app.use(express.static(BUILD_DIR));

// SPA fallback — any non-API route serves index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(BUILD_DIR, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`   ├─ Static files: ${BUILD_DIR}`);
  console.log(`   ├─ Ollama proxy: ${OLLAMA_HOST}`);
  console.log(`   └─ Health check: http://localhost:${PORT}/health`);
});
