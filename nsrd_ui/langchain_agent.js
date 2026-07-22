/**
 * Self-Correcting Codegen Agent
 *
 * Implements the agentic loop pattern manually using our proven
 * axios-based streaming chat (which keeps the connection alive through
 * nginx proxies). The key improvement over the old pipeline is that
 * conversation history PERSISTS between retry attempts — the model
 * sees its own previous code AND the exact build errors in context,
 * so it can make targeted fixes rather than regenerating everything.
 *
 * Loop:
 *   1. Build system + user messages from requirements
 *   2. Stream response via pipeline.chat() (nginx-safe)
 *   3. Extract files from ===FILE:=== delimiters
 *   4. Run Vite build
 *   5. If build fails → append error as user message → go to 2
 *   6. If build succeeds → done
 */

const { chat, extractFiles, sanitizeFiles } = require('./pipeline');

/* ══════════════════════════════════════════════════════
   Build the initial system + user messages
   ══════════════════════════════════════════════════════ */
function buildInitialMessages({ pages, architecturePlan, ragSummary, expectedPageNames }) {
  const systemContent = `You are an expert React developer. Generate complete, working React page components.

TECH STACK: React 18, React Router v6, Recharts (charts), react-leaflet + leaflet (maps).

JSX RULES — violations cause Vite build failure:
1. Leaflet attribution MUST use template literal expression:
   attribution={\`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>\`}
2. TileLayer url MUST be a complete string on ONE line:
   url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
3. JSX prop arrays/objects MUST have =:   position={[lat, lng]}  NOT  position[lat, lng]
4. No raw HTML tags inside string props — use {\`template literals\`}
5. Every <Tag> needs </Tag> or must be self-closing <Tag />
6. Import leaflet CSS when using maps: import 'leaflet/dist/leaflet.css';

OUTPUT FORMAT — use EXACTLY this format for every file:
===FILE: src/pages/Name.jsx===
// complete file content here
===END FILE===

RULES:
- Output ONLY the page files listed below — do NOT output App.jsx or App.css
- Every file must be complete and valid JSX
- No placeholder comments, no TODOs, no ellipsis (...)
- DO NOT ask for confirmation, clarification, or feedback
- DO NOT end with questions like "Would you like me to..." or "Should I..."
- DO NOT output a plan or description — output CODE immediately
- Start your response with ===FILE: and nothing else

FILES TO GENERATE:
${expectedPageNames.map((n) => `  • src/pages/${n}.jsx`).join('\n')}`;

  let userContent = '';

  if (architecturePlan) {
    userContent += `ARCHITECTURE PLAN:\n${architecturePlan}\n\n`;
  }

  if (ragSummary) {
    userContent += `REFERENCE PATTERNS (use similar visual styles and structure):\n${ragSummary}\n\n`;
  }

  userContent += `PAGE REQUIREMENTS:\n`;
  for (const pg of pages) {
    userContent += `\n── ${pg.name} (${pg.type}) ──\n`;
    if (pg.requirements) userContent += `${pg.requirements}\n`;
    if (pg.type === 'geovisualization') {
      userContent += 'Use MapContainer, TileLayer, Marker, Popup from react-leaflet.\n';
      userContent += "Import 'leaflet/dist/leaflet.css'.\n";
      userContent += 'attribution must be: attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>`}\n';
      if (pg.csvFile) userContent += `CSV data:\n${pg.csvFile.content}\n`;
    }
    if (pg.svgFile) userContent += `SVG mockup (follow this layout):\n${pg.svgFile.content}\n`;
  }

  userContent += `\nGenerate all ${expectedPageNames.length} page file(s) now. Start your response with ===FILE: and output nothing else before it. No plan, no preamble, no questions.`;

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: userContent },
  ];
}

/* ══════════════════════════════════════════════════════
   Main export: run the self-correcting agent
   ══════════════════════════════════════════════════════ */
async function runCodegenAgent({
  coderModel,
  pages,
  architecturePlan,
  ragSummary,
  deployFn,
  projectId,
  scaffoldFiles,
  onStatus,
  maxRetries = 5,
}) {
  const expectedPageNames = pages.map((pg) => pg.name.replace(/[^a-zA-Z0-9]/g, ''));

  // Build persistent conversation — history accumulates across retries
  const messages = buildInitialMessages({ pages, architecturePlan, ragSummary, expectedPageNames });

  onStatus({ step: 'agent', status: 'running', message: `🤖 Agent starting (model: ${coderModel})…` });
  console.log(`[Agent] Starting: model=${coderModel}, pages=${expectedPageNames.join(', ')}`);

  let lastFiles = null;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    onStatus({
      step: 'generating',
      status: 'running',
      message: attempt === 1
        ? `💬 Generating code (attempt ${attempt}/${maxRetries})…`
        : `🔧 Fixing errors (attempt ${attempt}/${maxRetries}) — model has full error context…`,
    });
    console.log(`[Agent] LLM call attempt ${attempt}, conversation length: ${messages.length} messages`);

    // ── Stream response (nginx-safe, uses proven axios approach) ──
    let rawResponse;
    try {
      rawResponse = await chat(coderModel, messages, (tok) => {
        onStatus({ step: attempt === 1 ? 'generating' : 'fixing', token: tok });
      });
    } catch (err) {
      console.error(`[Agent] LLM call failed (attempt ${attempt}):`, err.message);
      onStatus({ step: 'agent', status: 'error', message: `LLM call failed: ${err.message}` });
      throw err;
    }

    // Append assistant response to conversation history
    messages.push({ role: 'assistant', content: rawResponse });

    onStatus({
      step: attempt === 1 ? 'generating' : 'fixing',
      status: 'done',
      message: `Response received (${rawResponse.length} chars)`,
    });

    // ── Extract files ──
    let llmFiles = extractFiles(rawResponse);

    if (!llmFiles.length) {
      console.warn(`[Agent] No files extracted from response (attempt ${attempt})`);
      // Detect if model asked for confirmation / gave a plan instead of code
      const askedForConfirmation = /would you like|shall i|should i|do you want|let me know|elaborate|clarify/i.test(rawResponse);
      const gavePlan = /##|###|\*\*|architecture|plan|overview|summary/i.test(rawResponse) && !rawResponse.includes('===FILE:');
      if (askedForConfirmation || gavePlan) {
        console.warn('[Agent] Model gave plan or asked for confirmation — sending hard nudge');
        messages.push({
          role: 'user',
          content: 'DO NOT ask questions. DO NOT give a plan. Generate the code RIGHT NOW.\n\nStart your response with ===FILE: src/pages/ and output complete working JSX. No other text.',
        });
      } else {
        messages.push({
          role: 'user',
          content: 'Your response did not contain any files in ===FILE: path=== ... ===END FILE=== format. Output the complete page files using that exact format now. Start with ===FILE:',
        });
      }
      continue;
    }

    // Remove any App.jsx / App.css the model generated (scaffold owns those)
    llmFiles = llmFiles.filter((f) => f.path !== 'src/App.jsx' && f.path !== 'src/App.css');

    // Normalize page filenames to match scaffold imports
    const pageFiles = llmFiles.filter((f) => f.path.startsWith('src/pages/'));
    const otherFiles = llmFiles.filter((f) => !f.path.startsWith('src/pages/'));
    const renamedPages = pageFiles.map((f, idx) => {
      const name = expectedPageNames[idx];
      if (!name) return f;
      const expected = `src/pages/${name}.jsx`;
      if (f.path !== expected) console.log(`[Agent] Renaming ${f.path} → ${expected}`);
      return { ...f, path: expected };
    });
    llmFiles = [...renamedPages, ...otherFiles];

    // Merge with scaffold
    let files = [...scaffoldFiles, ...llmFiles];

    // Run sanitizer (fast regex pre-build fixes)
    const sanitized = sanitizeFiles(files);
    files = sanitized.files;
    if (sanitized.report.totalFixes > 0) {
      console.log(`[Agent] Sanitizer fixed ${sanitized.report.totalFixes} issue(s) before build`);
      onStatus({ step: 'sanitizing', status: 'done', message: `Auto-fixed ${sanitized.report.totalFixes} syntax issue(s)` });
    }

    onStatus({ step: 'deploying', status: 'running', message: `🔨 Building with Vite (attempt ${attempt})…` });

    // ── Try to build ──
    try {
      await deployFn(projectId, files);
      onStatus({ step: 'deploying', status: 'done', message: `✅ Build succeeded (attempt ${attempt})` });
      lastFiles = files;
      console.log(`[Agent] Build succeeded on attempt ${attempt}`);
      break;
    } catch (buildErr) {
      const errors = buildErr.stderr || buildErr.stdout || buildErr.message || String(buildErr);
      console.error(`[Agent] Build failed (attempt ${attempt}):`, errors.slice(0, 500));

      onStatus({
        step: 'build-output',
        status: 'error',
        message: `Build failed (attempt ${attempt})`,
        stderr: errors,
        stdout: buildErr.stdout || '',
      });

      if (attempt >= maxRetries) {
        onStatus({ step: 'deploying', status: 'error', message: `Build failed after ${maxRetries} attempts` });
        throw new Error(`Agent: build failed after ${maxRetries} attempts. Last errors:\n${errors}`);
      }

      // ── Feed errors back into conversation ──
      // Model sees its own previous code + exact errors → makes targeted fixes
      const currentPageContent = llmFiles
        .filter((f) => f.path.startsWith('src/pages/'))
        .map((f) => `===FILE: ${f.path}===\n${f.content}\n===END FILE===`)
        .join('\n\n');

      messages.push({
        role: 'user',
        content: `The Vite build FAILED with these errors:\n\n${errors}\n\nYour current code:\n${currentPageContent}\n\nFix ONLY the lines causing these specific errors and re-output ALL page files in ===FILE:=== format.`,
      });

      onStatus({
        step: 'thinking-fix',
        status: 'done',
        message: `Errors fed back to model (${errors.length} chars) — retrying with full context…`,
      });
    }
  }

  if (!lastFiles) {
    throw new Error('Agent: no successful build');
  }

  return { files: lastFiles, attempts: attempt };
}

module.exports = { runCodegenAgent };
