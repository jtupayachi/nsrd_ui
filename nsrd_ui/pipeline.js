/**
 * NSRD Pipeline — Multi-step React App Generation & Deployment
 *
 * Step 1 (Generator):  Sends prompt to Ollama, streams response
 * Step 2 (Extractor):  Parses LLM output into individual files
 * Step 3 (Deployer):   Scaffolds React project, builds with Vite
 * Step 4 (Fixer):      Retries with error context on build failure
 */

const axios = require('axios');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/* ── Golden examples: working reference files injected directly into prompts ── */
const GOLDEN_DIR = fsSync.existsSync('/reference-codebases')
  ? '/reference-codebases/golden-examples/src'
  : path.join(__dirname, '..', 'reference-codebases', 'golden-examples', 'src');

function loadGoldenExample(relPath) {
  try {
    return fsSync.readFileSync(path.join(GOLDEN_DIR, relPath), 'utf8');
  } catch (e) {
    console.warn('[GoldenExample] Could not load', relPath, e.message);
    return null;
  }
}
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const { sanitizeFiles, validateFiles } = require('./sanitizer');
// Try RAG first, fall back to legacy analyzer
const { getRelevantExamples } = require('./referenceAnalyzer_rag');

/* ── Config ────────────────────────────────────────── */
const OLLAMA_HOST = 'https://ollama.viridian.ise.utk.edu';
const USERNAME = 'ollama_user';
const PASSWORD = 'ollama4Viridian';
const authHeader =
  'Basic ' + Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');

const PROJECTS_DIR = path.join(__dirname, 'projects');
const TEMPLATE_DIR = path.join(__dirname, 'templates', 'react-app');

/* Deep-thinking model for architectural reasoning — swap to qwen3-coder:480b when available */
const THINKER_MODEL = 'qwen3-coder-next:latest';

/* ─── Helper: infer semantic roles for CSV columns ──────────────────────── */
// Normalize a CSV header the same way the Papa.parse transformHeader does,
// so role detection always works regardless of case, spaces, or special chars.
// e.g. "Latitude (DD)", "LAT_WGS84", " lat " → "latitude_dd", "lat_wgs84", "lat"
function normalizeHeader(h) {
  return h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// Legacy thin wrapper — kept so callers that only need col names still work.
function inferColumnRoles(headerLine) {
  return analyzeCSV(headerLine + '\n');
}

/**
 * analyzeCSV — full data-aware column analysis.
 *
 * Parses up to 50 data rows and:
 *  • Normalizes every header the same way the generated snippet's transformHeader does
 *    → detection works for "Latitude", "LAT_DD", "lat (deg)", "Y", "site_lat", etc.
 *  • Confirms lat/lng by actual numeric value ranges (not just names)
 *  • Computes map center + zoom from real data bounds
 *  • Produces a ready-to-paste Papa.parse snippet using normalized names throughout
 *
 * Returns: { cols, normCols, roles, colMeta, mapCenter, mapZoom, parsedRows, papaSnippet }
 *   roles.*  → normalized column name (matches what row['...'] returns after transformHeader)
 *   cols     → original column names (for display only)
 */
function analyzeCSV(csvContent) {
  const lines = csvContent.trim().split('\n').filter(l => l.trim());
  if (!lines.length) return { cols: [], normCols: [], roles: {}, colMeta: [], mapCenter: [0, 0], mapZoom: 2, parsedRows: 0, papaSnippet: '' };

  const cols    = lines[0].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
  const normCols = cols.map(normalizeHeader);  // what row[key] will be after transformHeader

  // Parse up to 50 data rows
  const maxRows = Math.min(lines.length - 1, 50);
  const colValues = cols.map(() => []);
  for (let r = 1; r <= maxRows; r++) {
    const cells = lines[r].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    for (let i = 0; i < cols.length; i++) colValues[i].push(cells[i] ?? '');
  }

  // Per-column stats using normalized names for pattern matching
  const colMeta = cols.map((col, i) => {
    const norm = normCols[i];
    const vals = colValues[i].filter(v => v !== '' && v !== 'null' && v !== 'undefined');
    const nums = vals.map(v => parseFloat(v)).filter(n => !isNaN(n));
    const isAllNumeric = nums.length > 0 && nums.length >= vals.length * 0.8;
    const min = isAllNumeric ? Math.min(...nums) : null;
    const max = isAllNumeric ? Math.max(...nums) : null;
    const samples = vals.slice(0, 3);
    return { col, norm, index: i, min, max, samples, isAllNumeric };
  });

  // ── Role assignment ────────────────────────────────────────────────────────
  // Phase 1: name-based (using normalized names so casing/spaces don't matter)
  const roles = {};
  for (let i = 0; i < normCols.length; i++) {
    const n = normCols[i];
    const m = colMeta[i];
    // Lat: exact match, starts-with, contains lat/latitude
    if (!roles.lat && m.isAllNumeric && m.min >= -90 && m.max <= 90 && (
      /^lat$|^latitude$|^lat_/.test(n) || /_lat$|_lat_|_latitude/.test(n) || n === 'y' || n === 'y_coord' || n === 'northing'
    )) roles.lat = n;
    // Lng: exact match, starts-with, contains lon/lng/longitude
    if (!roles.lng && m.isAllNumeric && m.min >= -180 && m.max <= 180 && (
      /^lon$|^lng$|^longitude$|^lon_|^lng_/.test(n) || /_lon$|_lng$|_lon_|_lng_|_longitude/.test(n) || n === 'x' || n === 'x_coord' || n === 'easting'
    )) roles.lng = n;
  }
  // Phase 2: value-range fallback — any numeric column in the right range
  if (!roles.lat || !roles.lng) {
    // lat candidates: numeric, in [-90,90], with real spread (not row-id)
    const latCands = colMeta.filter(m => m.isAllNumeric && m.min >= -90  && m.max <= 90  && (m.max - m.min) > 0.001 && m.norm !== roles.lng);
    const lngCands = colMeta.filter(m => m.isAllNumeric && m.min >= -180 && m.max <= 180 && (m.max - m.min) > 0.001 && m.norm !== roles.lat);
    if (!roles.lat && latCands.length) roles.lat = latCands[0].norm;
    if (!roles.lng && lngCands.length) {
      const pick = lngCands.find(m => m.norm !== roles.lat) || lngCands[0];
      roles.lng = pick.norm;
    }
  }
  // Label, value, date, cat — all use normalized names for matching, store normalized
  for (let i = 0; i < normCols.length; i++) {
    const n = normCols[i];
    const m = colMeta[i];
    if (!roles.label && /name|label|title|site|station|facility|location|id|tower|sensor|device/.test(n) && n !== roles.lat && n !== roles.lng) roles.label = n;
    if (!roles.value && m.isAllNumeric && n !== roles.lat && n !== roles.lng) roles.value = n;
    if (!roles.date  && (/date|time|year|month|period|datetime|timestamp/.test(n) || /^\d{4}-\d{2}-\d{2}/.test(m.samples[0] || ''))) roles.date = n;
    if (!roles.cat   && /status|type|category|class|kind|group/.test(n)) roles.cat = n;
  }

  // ── Map center + zoom from actual data ─────────────────────────────────────
  let mapCenter = [20, 0];
  let mapZoom = 2;
  if (roles.lat && roles.lng) {
    const latIdx = normCols.indexOf(roles.lat);
    const lngIdx = normCols.indexOf(roles.lng);
    const lats = colValues[latIdx].map(Number).filter(n => !isNaN(n) && n >= -90  && n <= 90);
    const lngs = colValues[lngIdx].map(Number).filter(n => !isNaN(n) && n >= -180 && n <= 180);
    if (lats.length && lngs.length) {
      const clat = (Math.min(...lats) + Math.max(...lats)) / 2;
      const clng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
      mapCenter = [parseFloat(clat.toFixed(4)), parseFloat(clng.toFixed(4))];
      const spread = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs));
      mapZoom = spread < 0.1 ? 14 : spread < 1 ? 11 : spread < 5 ? 9 : spread < 20 ? 7 : 4;
    }
  }

  // ── Build verified Papa.parse snippet ──────────────────────────────────────
  // transformHeader normalizes headers the same way we did → row keys are always normalized.
  // The model copies this verbatim; there's NO guessing about column names.
  const numericExtra = colMeta.filter(m => m.isAllNumeric && m.norm !== roles.lat && m.norm !== roles.lng);
  const stringExtra  = colMeta.filter(m => !m.isAllNumeric && m.norm !== roles.lat && m.norm !== roles.lng && m.norm !== roles.label && m.norm !== roles.date);

  const papaLines = [
    `Papa.parse(text, {`,
    `  header: true,`,
    `  skipEmptyLines: true,`,
    `  // normalizes "Latitude (DD)", "LAT_WGS84", " lat " → "latitude_dd", "lat_wgs84", "lat"`,
    `  transformHeader: h => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/, ''),`,
    `  complete: (results) => {`,
    `    const data = results.data.map((row, i) => ({`,
    `      id: i,`,
  ];
  if (roles.lat)   papaLines.push(`      lat:   parseFloat(row['${roles.lat}']),   // original: "${cols[normCols.indexOf(roles.lat)]}"`);
  if (roles.lng)   papaLines.push(`      lng:   parseFloat(row['${roles.lng}']),   // original: "${cols[normCols.indexOf(roles.lng)]}"`);
  if (roles.label) papaLines.push(`      label: row['${roles.label}'],             // original: "${cols[normCols.indexOf(roles.label)]}"`);
  if (roles.date)  papaLines.push(`      date:  row['${roles.date}'],              // original: "${cols[normCols.indexOf(roles.date)]}"`);
  for (const m of numericExtra.slice(0, 5)) {
    papaLines.push(`      ${m.norm}: parseFloat(row['${m.norm}']),  // original: "${m.col}"  range:${m.min}–${m.max}`);
  }
  for (const m of stringExtra.slice(0, 2)) {
    papaLines.push(`      ${m.norm}: row['${m.norm}'],              // original: "${m.col}"`);
  }
  papaLines.push(
    roles.lat && roles.lng
      ? `    })).filter(d => !isNaN(d.lat) && !isNaN(d.lng));`
      : `    }));`,
    `    setData(data);`,
    `  }`,
    `});`,
  );
  const papaSnippet = papaLines.join('\n');

  return { cols, normCols, roles, colMeta, mapCenter, mapZoom, parsedRows: maxRows, papaSnippet };
}

/* ─── Helper: map SVG region IDs to semantic labels (no component suggestions) ─ */
function mapSvgRegions(svgContent) {
  const ids = [...svgContent.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  return ids.map(id => {
    const lc = id.toLowerCase();
    let kind = 'region';
    if (/map/.test(lc))                  kind = 'map';
    else if (/sidebar|side/.test(lc))    kind = 'sidebar';
    else if (/header|nav|top/.test(lc))  kind = 'header/nav';
    else if (/chart|graph|plot/.test(lc))kind = 'chart';
    else if (/table|list|grid/.test(lc)) kind = 'table';
    else if (/legend|key/.test(lc))      kind = 'legend';
    else if (/filter|control|panel/.test(lc)) kind = 'filter/controls';
    else if (/footer|bottom/.test(lc))   kind = 'footer';
    else if (/content|main|body/.test(lc)) kind = 'main content';
    return `id="${id}" (${kind})`;
  });
}

/* ─── Helper: describe SVG layout geometrically ───────────────────────────────
   The SVG editor (and most user-drawn mockups) does not include id attributes,
   only raw <rect>/<text>/<circle> with x/y/width/height. We turn that geometry
   into a human-readable layout spec the LLM can actually follow:
     • compute viewBox bounds
     • collect rectangles with their position as % of canvas
     • pair each rect with the text label whose center falls inside it
     • derive a semantic role from the label (map, chart, sidebar, header, …)
     • output a sorted list "Region N: <role> at top-left ~Y%×X%, ~W%×H%, label 'Foo'"
   This is what gets injected into both the THINK and CODE prompts so the model
   plans CSS Grid / Flex layout that matches the mockup.
   ───────────────────────────────────────────────────────────────────────────── */
function describeSvgLayout(svgContent) {
  if (!svgContent || typeof svgContent !== 'string') return null;

  // ── viewBox ──
  let vbW = 800, vbH = 500;
  const vbMatch = svgContent.match(/viewBox="([\d.\s\-]+)"/);
  if (vbMatch) {
    const parts = vbMatch[1].trim().split(/\s+/).map(Number);
    if (parts.length === 4 && parts.every(n => Number.isFinite(n))) {
      vbW = parts[2] || vbW;
      vbH = parts[3] || vbH;
    }
  } else {
    const w = parseFloat(svgContent.match(/<svg[^>]*\swidth="(\d+)"/)?.[1] || '');
    const h = parseFloat(svgContent.match(/<svg[^>]*\sheight="(\d+)"/)?.[1] || '');
    if (Number.isFinite(w) && w > 0) vbW = w;
    if (Number.isFinite(h) && h > 0) vbH = h;
  }

  // ── rectangles (skip the full-canvas background rect) ──
  const rects = [];
  const rectRe = /<rect\b([^>]*)\/?>/g;
  let m;
  while ((m = rectRe.exec(svgContent)) !== null) {
    const attrs = m[1];
    const get = (name) => {
      const r = new RegExp(`\\s${name}="([^"]+)"`).exec(attrs);
      return r ? r[1] : null;
    };
    const x = parseFloat(get('x') || '0');
    const y = parseFloat(get('y') || '0');
    const wRaw = get('width');
    const hRaw = get('height');
    if (!wRaw || !hRaw) continue;
    // Skip 100%/100% background rect
    if (/%/.test(wRaw) && /%/.test(hRaw)) continue;
    const w = parseFloat(wRaw);
    const h = parseFloat(hRaw);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 5 || h < 5) continue;
    rects.push({
      x, y, w, h,
      cx: x + w / 2,
      cy: y + h / 2,
      id: get('id'),
      fill: get('fill'),
    });
  }

  // ── text labels ──
  const texts = [];
  const textRe = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
  while ((m = textRe.exec(svgContent)) !== null) {
    const attrs = m[1];
    const body = m[2].replace(/<[^>]+>/g, '').trim();
    if (!body) continue;
    const get = (name) => {
      const r = new RegExp(`\\s${name}="([^"]+)"`).exec(attrs);
      return r ? r[1] : null;
    };
    const x = parseFloat(get('x') || '0');
    const y = parseFloat(get('y') || '0');
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    texts.push({ x, y, text: body });
  }

  if (rects.length === 0 && texts.length === 0) return null;

  // ── attach text labels to rectangles (text point inside rect bounds) ──
  for (const r of rects) {
    r.labels = [];
    for (const t of texts) {
      if (t.x >= r.x && t.x <= r.x + r.w && t.y >= r.y && t.y <= r.y + r.h) {
        r.labels.push(t.text);
      }
    }
  }

  // Texts not assigned to any rect → standalone labels
  const orphanTexts = texts.filter(t =>
    !rects.some(r => t.x >= r.x && t.x <= r.x + r.w && t.y >= r.y && t.y <= r.y + r.h)
  );

  // ── derive semantic role from labels + id + geometry ──
  const inferRole = (rect) => {
    const tokens = [
      ...(rect.labels || []),
      rect.id || '',
    ].join(' ').toLowerCase();
    if (/\bmap\b|leaflet|geo/.test(tokens)) return 'map';
    if (/sidebar|side panel|filter|control/.test(tokens)) return 'sidebar';
    if (/header|nav|top bar|menu/.test(tokens)) return 'header';
    if (/chart|graph|plot|bar|line|pie|hist/.test(tokens)) return 'chart';
    if (/table|list|grid|rows/.test(tokens)) return 'table';
    if (/legend|key/.test(tokens)) return 'legend';
    if (/footer|bottom/.test(tokens)) return 'footer';
    if (/title|heading|hero/.test(tokens)) return 'title';
    if (/card|tile|kpi|metric|stat/.test(tokens)) return 'card';
    if (/text|description|paragraph|info/.test(tokens)) return 'text block';
    // Geometry hints (no label)
    const wPct = rect.w / vbW;
    const hPct = rect.h / vbH;
    const yPct = rect.y / vbH;
    if (wPct > 0.85 && hPct < 0.15 && yPct < 0.15) return 'header (full-width top strip)';
    if (wPct > 0.85 && hPct < 0.15 && yPct > 0.85) return 'footer (full-width bottom strip)';
    if (hPct > 0.6 && wPct < 0.3 && rect.x < vbW * 0.15) return 'sidebar (left column)';
    if (hPct > 0.6 && wPct < 0.3 && rect.x + rect.w > vbW * 0.85) return 'sidebar (right column)';
    return 'panel';
  };

  // Sort rectangles top-to-bottom, then left-to-right (reading order)
  const sorted = [...rects].sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > Math.min(a.h, b.h) * 0.5) return yDiff;
    return a.x - b.x;
  });

  const pct = (n, total) => Math.round((n / total) * 100);

  const lines = [];
  lines.push(`Canvas: ${Math.round(vbW)}×${Math.round(vbH)} (use as relative proportions)`);
  if (sorted.length > 0) {
    lines.push(`Layout regions (${sorted.length}, in reading order):`);
    sorted.forEach((r, i) => {
      const role = inferRole(r);
      const labelStr = r.labels.length ? ` label="${r.labels.join(' / ').slice(0, 60)}"` : '';
      lines.push(
        `  ${i + 1}. ${role}: top ${pct(r.y, vbH)}%, left ${pct(r.x, vbW)}%, ` +
        `width ${pct(r.w, vbW)}%, height ${pct(r.h, vbH)}%${labelStr}`
      );
    });
  }
  if (orphanTexts.length > 0) {
    const sample = orphanTexts.slice(0, 6).map(t => `"${t.text.slice(0, 40)}"`).join(', ');
    lines.push(`Standalone text labels: ${sample}${orphanTexts.length > 6 ? ` (+${orphanTexts.length - 6} more)` : ''}`);
  }

  return lines.join('\n');
}

/* ═══════════════════════════════════════════════════════
   DEEP THINKING AGENT
   Uses a reasoning model (with <think> traces) to produce
   a structured architecture plan before code generation.
   Also used to analyze errors for the fix step.
   ═══════════════════════════════════════════════════════ */
function buildThinkPrompt(pages, opts = {}) {
  const fileList = pages.map((pg) => `src/pages/${pg.name.replace(/[^a-zA-Z0-9]/g, '')}.jsx`).join(', ');

  const pageList = pages.map((pg) => {
    const lines = [];
    lines.push(`• ${pg.name} (${pg.type})`);
    if (pg.requirements) lines.push(`  Requirements: ${pg.requirements.slice(0, 300)}`);

    // ── Type-specific context ──
    if (pg.type === 'home') {
      lines.push('  This is a LANDING / HOME page — typically contains:');
      lines.push('    • Hero banner with title + subtitle');
      lines.push('    • Navigation cards linking to other pages in the app');
      lines.push('    • Project description / overview section');
      lines.push('    • Footer or call-to-action');
      lines.push('  ⚠ NO CSV data, NO charts, NO maps — content is STATIC / hardcoded.');
      lines.push('  Use Tailwind CSS for styling. Use react-router-dom Link for navigation cards.');
    }

    if (pg.type === 'geovisualization') {
      lines.push('  Map library: react-leaflet (MapContainer, TileLayer, Marker, Popup, useMap)');
      lines.push('  CRITICAL: attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>`}');
      if (pg.csvFile) {
        const csvHeader = pg.csvFile.content.split('\n')[0];
        const rowCount = pg.csvFile.content.split('\n').length - 1;
        const { cols: csvCols, roles } = inferColumnRoles(csvHeader);
        const rolesStr = Object.entries(roles).map(([r, c]) => `${c}=${r}`).join(', ');
        lines.push(`  CSV: ${csvCols.join(', ')} (${rowCount} rows)${rolesStr ? ` | inferred roles: ${rolesStr}` : ''}`);
        if (opts.experimentMode) {
          lines.push('  CSV will be embedded INLINE as a JS template literal — DO NOT plan a fetch() call, DO NOT reference /data/*.csv paths.');
        } else {
          lines.push(`  CSV is a static asset at /data/${pg.name.replace(/[^a-zA-Z0-9]/g, '')}.csv — fetch() at runtime`);
        }
      } else {
        lines.push('  ⚠ No CSV provided — use placeholder coordinates or a basic map view.');
      }
    }

    if (pg.type === 'base') {
      lines.push('  Charts: use Recharts (BarChart, LineChart, PieChart, ResponsiveContainer)');
      if (pg.csvFile) {
        const csvHeader = pg.csvFile.content.split('\n')[0];
        const rowCount = pg.csvFile.content.split('\n').length - 1;
        const { cols: csvCols, roles } = inferColumnRoles(csvHeader);
        const rolesStr = Object.entries(roles).map(([r, c]) => `${c}=${r}`).join(', ');
        lines.push(`  CSV: ${csvCols.join(', ')} (${rowCount} rows)${rolesStr ? ` | roles: ${rolesStr}` : ''}`);
        if (opts.experimentMode) {
          lines.push('  CSV will be embedded INLINE as a JS template literal — DO NOT plan a fetch() call, DO NOT reference /data/*.csv paths.');
        } else {
          lines.push(`  CSV is a static asset at /data/${pg.name.replace(/[^a-zA-Z0-9]/g, '')}.csv — fetch() at runtime`);
        }
      } else {
        lines.push('  ⚠ No CSV provided — use sample/hardcoded data for chart demonstration.');
      }
    }

    if (pg.svgFile) {
      const layout = describeSvgLayout(pg.svgFile.content);
      const regions = mapSvgRegions(pg.svgFile.content);
      lines.push('  SVG layout mockup provided — plan your component structure to match it exactly.');
      if (layout) {
        lines.push('  Mockup geometry (CSS Grid / Flex MUST follow these proportions):');
        layout.split('\n').forEach(l => lines.push('    ' + l));
      }
      if (regions.length) lines.push('  Named region IDs: ' + regions.join(', '));
      if (!opts.experimentMode) {
        lines.push('  Full SVG:', pg.svgFile.content);
      }
    }
    return lines.join('\n');
  }).join('\n\n');

  // Add reference examples — every interface field contributes to the RAG query:
  //   name + type       → page category signal
  //   requirements      → natural language intent (main signal)
  //   CSV header row     → data shape: which columns exist (lat/lng → map, date → timeseries…)
  //   SVG tag/id names   → layout intent: sidebar, map, chart, table, legend, header…
  const ragQuery = pages.map(pg => {
    const parts = [pg.name, pg.type, pg.requirements || ''];
    if (pg.csvFile) {
      const csvHeader = pg.csvFile.content.split('\n')[0] || '';
      parts.push(`CSV columns: ${csvHeader}`);
    }
    if (pg.svgFile) {
      // Extract id/class/tag names from SVG — these describe the layout regions
      const svgTokens = [...pg.svgFile.content.matchAll(/(?:id|class)="([^"]+)"|<(\w+)/g)]
        .map(m => (m[1] || m[2] || '').toLowerCase())
        .filter(t => t.length > 2 && !['svg','defs','path','rect','g','use'].includes(t))
        .slice(0, 20)
        .join(' ');
      if (svgTokens) parts.push(`SVG layout regions: ${svgTokens}`);
      else parts.push('SVG layout mockup provided');
    }
    return parts.join(' ');
  }).join(' | ');
  const { summary } = getRelevantExamples(ragQuery, 3);
  if (summary) {
    const lines = summary.split('\n');
    const fileRefs = lines.filter(l => l.startsWith('File:')).map(l => l.replace('File:', '').trim());
    console.log(`[RAG] Think phase: ${fileRefs.length} example(s) retrieved — ${fileRefs.join(', ') || '(no file refs)'}`);
    console.log(`[RAG] Summary preview: ${summary.slice(0, 300).replace(/\n/g, ' ')}…`);
  } else {
    console.log('[RAG] Think phase: no examples retrieved');
  }

  let p = `You are a React architect. Plan ONLY the following ${pages.length} file(s) — no extra components.

FILES TO PLAN: ${fileList}

PAGE DETAILS:
${pageList}

`;

  if (summary) p += `REFERENCE PATTERNS (for style/structure inspiration):\n${summary}\n\n`;

  p += `══════════════════════════════════════════════════════════════
⚠️  CRITICAL: You can ONLY use these pre-installed libraries:
══════════════════════════════════════════════════════════════
  ✓ react, react-dom           — UI framework
  ✓ react-router-dom           — routing (<BrowserRouter>, <Routes>, <Route>, <Link>)
  ✓ leaflet, react-leaflet     — maps (<MapContainer>, <TileLayer>, <Marker>, <Popup>)
  ✓ recharts                   — charts (<LineChart>, <BarChart>, <PieChart>, <Area>, etc.)
${opts.experimentMode
  ? '  ✓ parseCSV helper           — use parseCSV(DATA_CSV) for inline data (DO NOT import papaparse, DO NOT call Papa.parse)'
  : '  ✓ papaparse                  — CSV parsing (import Papa from \'papaparse\'; Papa.parse())'}

  ✗ DO NOT import: csv-parser, d3, chart.js, axios, lodash, or ANY other library
${opts.experimentMode
  ? '  ✗ DO NOT import papaparse or use Papa.parse() — the parseCSV helper is already defined, use it'
  : '  ✗ Use native fetch() for data loading — no axios or other HTTP clients'}
══════════════════════════════════════════════════════════════

OUTPUT — for each file write exactly this block and nothing else:
FILE: <path>
PURPOSE: one sentence describing what this page shows
KEY IMPORTS: list every import needed (components, hooks, CSS)
STATE: what useState/useEffect hooks are needed and why
COLUMN ROLES: if page has CSV → list each column with its role (lat/lng/label/value/date/category/ignore)${opts.experimentMode ? '\n              IMPORTANT: write the EXACT CSV header name, never shorten it. E.g. write "latitude" not "lat", "longitude" not "lng".' : ''}
              if page is 'home' type → write "No CSV — static content only"
SVG → COMPONENTS: for each SVG region id, the React component that implements it
MAIN LOGIC: how data is parsed and rendered — reference exact column names (3-4 sentences)
${opts.experimentMode
  ? '            CRITICAL: data = parseCSV(DATA_CSV). Row keys ARE the raw CSV header names — use row[\'latitude\'] NOT row[\'lat\'], row[\'longitude\'] NOT row[\'lng\']. Never abbreviate.'
  : '            for home pages: describe the layout structure (hero, cards, footer, navigation)'}
STYLING: layout approach, key Tailwind classes for containers, colours, responsive behaviour

Rules:
- Do NOT invent files not listed above
- Do NOT include sub-component breakdowns
- Do NOT invent or rename CSV column names — only use columns listed above
- Home pages have NO CSV data — do not plan fetch/parse logic for them
${opts.experimentMode ? '- Data parsing: parseCSV(DATA_CSV) preserves raw CSV header names as row keys — never use normalized/abbreviated names in the plan.\n- DO NOT plan Papa.parse or transformHeader — they are forbidden in this mode.' : ''}
- Do NOT ask questions — output immediately`;

  return p;
}

function buildThinkFixPrompt(files, errors) {
  let p = `You are debugging a React/Vite build failure. Analyze the errors and produce a precise fix plan.

BUILD ERRORS:
${errors}

FAILING FILES:
`;
  for (const f of files) {
    // Plain code — no line numbers (model copies them back into output)
    p += `\n--- ${f.path} ---\n${f.content}\n`;
  }
  p += `
For each error:
1. Quote the exact error message
2. Identify the file and line number
3. State the root cause in one sentence
4. Give the minimal fix (show before → after if helpful)

Common React/JSX root causes to check:
- HTML inside a JSX string prop (use template literal instead)
- Unterminated string literal (opening quote without closing quote on same line)
- Missing = in JSX prop: position[x,y] should be position={[x,y]}
- Importing a CSS file that does not exist in the project
- Using a variable before it is declared
- Mismatched JSX tags or unclosed elements

Output FIX PLAN now:`;
  return p;
}

/**
 * parseErrorsByFile
 * Reads Vite/esbuild error output and groups error lines by the source file
 * they reference.  Returns a Map<filePath, errorText[]>.
 *
 * Vite formats errors like:
 *   src/pages/Home.jsx:29:16: ERROR: Expected "}" but found ...
 *   /abs/path/proj_xxx/src/pages/Home.jsx:12:8: ERROR: ...
 */
function parseErrorsByFile(errorText) {
  const byFile = new Map();   // relative path → Set of error lines

  // Match both absolute (/app/projects/xxx/src/...) and relative (src/...) paths
  const lineRe = /(?:\/[^\s:]+\/|(?=src\/))(src\/pages\/\S+?)(?::(\d+)(?::\d+)?)?:\s*(ERROR|error):\s*(.+)/g;
  let m;
  while ((m = lineRe.exec(errorText)) !== null) {
    const relPath = m[1];           // e.g. src/pages/Home.jsx
    const errMsg  = `${relPath}:${m[2] || '?'}: ${m[4]}`;
    if (!byFile.has(relPath)) byFile.set(relPath, new Set());
    byFile.get(relPath).add(errMsg);
  }

  // Also handle rollup/Vite missing-module errors:
  //   Could not resolve "./pages/Home.jsx" from "src/App.jsx"
  //   Could not resolve "./pages/Home" from "src/App.jsx"
  const resolveRe = /Could not resolve ["']\.\/pages\/([^"']+)["']/g;
  while ((m = resolveRe.exec(errorText)) !== null) {
    let relPath = `src/pages/${m[1]}`;
    // Ensure .jsx extension
    if (!/\.jsx?$/.test(relPath)) relPath += '.jsx';
    const errMsg = `${relPath}: File is missing — must be generated from scratch`;
    if (!byFile.has(relPath)) byFile.set(relPath, new Set());
    byFile.get(relPath).add(errMsg);
  }

  // Convert sets to sorted strings
  const result = new Map();
  for (const [file, msgs] of byFile) {
    result.set(file, [...msgs].join('\n'));
  }
  return result;
}

/**
 * buildSingleFileFixMessages
 * Creates a hyper-focused fix conversation for ONE broken file.
 * - Sends ONLY the broken file (not all pages)
 * - Injects the previous attempt's output as an assistant turn
 *   so the model can see what it tried before and avoid repeating it
 * - Escalates from surgical fix → full rewrite on later attempts
 */
function buildSingleFileFixMessages(filePath, fileContent, fileErrors, attempt, previousAttempts, pageContext, opts = {}) {
  const isMissing = fileContent === null || fileContent === undefined;
  const isLate = attempt >= 2;   // attempts 3+ allow full rewrite

  // RAG: retrieve fix-pattern examples that match the actual error text
  let ragSection = '';
  try {
    const { summary } = getRelevantExamples(fileErrors, 3);
    if (summary && summary.trim()) {
      const fileRefs = summary.split('\n').filter(l => l.startsWith('File:')).map(l => l.replace('File:', '').trim());
      console.log(`[RAG] Fix phase: ${fileRefs.length} example(s) — ${fileRefs.join(', ') || '(no file refs)'}`);
      ragSection = `\n════ SIMILAR ERROR FIX PATTERNS (from golden examples) ════\n${summary}\n`;
    } else {
      console.log('[RAG] Fix phase: no examples matched this error');
    }
  } catch (_) { /* RAG unavailable — continue without it */ }

  // Build CSV/SVG data context so the fixer doesn't invent column names
  let dataContext = '';
  if (pageContext) {
    const parts = [];
    if (pageContext.requirements) parts.push(`Page requirements: ${pageContext.requirements.slice(0, 200)}`);

    // Type-specific context
    if (pageContext.type === 'home') {
      parts.push('Page type: HOME — static landing page. NO CSV data, NO fetch(), NO useEffect for data.');
      parts.push('Use only: hardcoded content, Tailwind CSS, react-router-dom Link for navigation cards.');
    } else if (pageContext.csvFile) {
      const hdr = pageContext.csvFile.content.split('\n')[0];
      const { cols, roles } = inferColumnRoles(hdr);
      const rolesStr = Object.entries(roles).map(([r, c]) => `${c}→${r}`).join(', ');
      parts.push(`CSV columns (use EXACTLY): ${cols.join(', ')}${rolesStr ? ` | roles: ${rolesStr}` : ''}`);
      const safe = (pageContext.name || '').replace(/[^a-zA-Z0-9]/g, '');
      if (opts.experimentMode) {
        parts.push('CSV is embedded INLINE in the file (DATA_CSV template literal). Keep it inline — do NOT add fetch().');
      } else if (safe) {
        parts.push(`CSV asset path: /data/${safe}.csv — fetch at runtime`);
      }
    } else if (pageContext.type === 'geovisualization') {
      parts.push('Page type: GEO MAP — use react-leaflet. No CSV was provided; use placeholder coordinates.');
    } else if (pageContext.type === 'base') {
      parts.push('Page type: DATA/CHART — use Recharts. No CSV was provided; use sample hardcoded data.');
    }

    if (pageContext.svgFile) {
      const layout = describeSvgLayout(pageContext.svgFile.content);
      const regions = mapSvgRegions(pageContext.svgFile.content);
      if (layout) parts.push(`SVG layout (preserve these proportions):\n${layout.split('\n').map(l => '  ' + l).join('\n')}`);
      if (regions.length) parts.push(`Named region IDs:\n${regions.slice(0, 8).map(r => '  ' + r).join('\n')}`);
    }
    if (parts.length) dataContext = `\n════ PAGE DATA CONTEXT ════\n${parts.join('\n')}\n`;
  }

  // ── Special case: file was never generated (missing import) ──
  // Use a generation prompt rather than a repair prompt.
  if (isMissing) {
    const system = [
      `You are a React/Vite code generator. The file ${filePath} is MISSING and must be created.`,
      '',
      '════ SYNTAX RULES ════',
      "RULE 1 — imports on ONE line: import React from 'react';",
      'RULE 2 — every prop opens AND closes on the SAME line',
      'RULE 3 — attribution={`&copy; <a href=\"...\">text</a>`}  ← template literal always',
      'RULE 4 — center={[lat,lng]} zoom={10}  ← curly braces for arrays/numbers',
      'RULE 5 — every <Tag> closed: </Tag> or <Tag />',
      'RULE 5b — object keys ALWAYS need colon: { key: "value" } NOT { key "value" }',
      'RULE 6 — Tailwind className for all styling',
      ragSection,
      dataContext,
      '════ OUTPUT FORMAT ════',
      `===FILE: ${filePath}===`,
      '// complete file',
      '===END FILE===',
      '',
      'Start with ===FILE: — zero prose before or after.',
    ].join('\n');

    return [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          `The build failed because ${filePath} does not exist.`,
          `Error: ${fileErrors}`,
          '',
          `Generate a complete, valid React component for ${filePath}.`,
          'It must export a default function component that renders valid JSX.',
          '',
          `Output only: ===FILE: ${filePath}===\n// complete file\n===END FILE===`,
        ].join('\n'),
      },
    ];
  }

  const system = [
    `You are a React/Vite build error fixer. Fix ONLY this one file: ${filePath}`,
    isLate
      ? 'Previous surgical fixes failed. You MAY rewrite the entire file from scratch.'
      : 'Make the MINIMAL change needed — only touch lines involved in the errors.',
    '',
    '════ SYNTAX RULES ════',
    "RULE 1 — imports on ONE line: import React from 'react';",
    'RULE 2 — every prop opens AND closes on the SAME line',
    'RULE 3 — attribution={`&copy; <a href="...">text</a>`}  ← template literal always',
    'RULE 4 — center={[lat,lng]} zoom={10}  ← curly braces for arrays/numbers',
    'RULE 5 — every <Tag> closed: </Tag> or <Tag />',
    'RULE 5b — object keys ALWAYS need colon: { key: "value" } NOT { key "value" }',
    'RULE 5c — JSX plain text between tags: <p>text</p> NOT <p>{\'text\'}</p>',
    'RULE 6 — import leaflet/dist/leaflet.css before map components',
    'RULE 7 — Tailwind className for all styling; MapContainer needs style={{ height:"500px" }}',
    'RULE 8 — if L.* is used (L.latLngBounds, L.icon, etc.) add: import L from "leaflet". Preferred fix: replace L.latLngBounds(arr) with plain array — map.fitBounds([[lat,lng],...]) works without importing L.',
    'RULE 9 — absolute-positioned children inside absolute/relative containers: top/left are relative to the parent, NOT the root canvas. Subtract parent offset or remove the misplaced label entirely.',
    '',
    '════ ERROR → FIX QUICK REFERENCE ════',
    '"Expected }" but found \'string\'   →  key \'val\' missing colon → key: \'val\'',
    '"Unterminated string"              →  close the quote on the same line',
    '"Cannot find module \'./X.css\'"    →  remove that import',
    '"Expected >" but found "<"         →  add missing > to close tag on prev line',
    '"Expected identifier" near :       →  attribution needs backtick template literal',
    ragSection,
    dataContext,
    '════ OUTPUT FORMAT ════',
    `===FILE: ${filePath}===`,
    '// complete corrected file',
    '===END FILE===',
    '',
    'Start with ===FILE: — zero prose before or after.',
  ].join('\n');

  // Stateless: repair agent only sees the current errors + current broken file.
  // No history — each retry is a fresh, identical prompt (deterministic at temp=0.1).
  return [
    { role: 'system', content: system },
    {
      role: 'user',
      content: [
        `Fix the build errors in this file:`,
        '',
        `ERRORS:\n${fileErrors}`,
        '',
        `===FILE: ${filePath}===\n${fileContent}\n===END FILE===`,
        '',
        `Output the corrected ${filePath} now:`,
      ].join('\n'),
    },
  ];
}

/**
 * buildRuntimeFixMessages
 * Fix a runtime error detected by the review agent AFTER a successful Vite build.
 * Unlike buildSingleFileFixMessages (which handles Vite/syntax errors),
 * this focuses on logic bugs that compile cleanly but fail in the browser.
 * The runtime review output already contains a structured ISSUE + FIX suggestion —
 * we surface those directly so the model knows EXACTLY what to change.
 */
function buildRuntimeFixMessages(filePath, fileContent, runtimeIssue, pageContext) {
  // Pull ISSUE and FIX out of the structured runtime review block
  const issueMatch = runtimeIssue.match(/ISSUE:\s*([\s\S]+?)(?=\nFIX:|\n---\s*$|$)/);
  const fixMatch   = runtimeIssue.match(/FIX:\s*([\s\S]+?)(?=\n---\s*$|$)/);
  const issueSummary  = issueMatch ? issueMatch[1].trim() : runtimeIssue.trim();
  const fixSuggestion = fixMatch   ? fixMatch[1].trim()   : '';

  // Page data context so fixer uses correct column names and fetch paths
  let dataContext = '';
  if (pageContext) {
    const parts = [];
    if (pageContext.type === 'home') {
      parts.push('Page type: HOME — static. NO fetch, NO CSV, NO charts, NO maps.');
    } else if (pageContext.csvFile) {
      const hdr = pageContext.csvFile.content.split('\n')[0];
      const { cols, roles } = inferColumnRoles(hdr);
      const rolesStr = Object.entries(roles).map(([r, c]) => `${c}→${r}`).join(', ');
      const safe = (pageContext.name || '').replace(/[^a-zA-Z0-9]/g, '');
      parts.push(`CSV columns (use EXACTLY): ${cols.join(', ')}${rolesStr ? ` | roles: ${rolesStr}` : ''}`);
      if (safe) parts.push(`CSV path: /data/${safe}.csv`);
    }
    if (parts.length) dataContext = `\n════ PAGE DATA CONTEXT ════\n${parts.join('\n')}\n`;
  }

  const system = [
    `You are a React runtime bug fixer. Fix ONLY the specific error described below in: ${filePath}`,
    'The code ALREADY COMPILES with zero syntax errors. Do NOT alter any syntax.',
    'Make the MINIMUM change required to eliminate the runtime error.',
    '',
    '════ LEAFLET MapContainer RULES (authoritative — apply whenever this is a map file) ════',
    '• MapContainer height MUST be a fixed pixel value: style={{ height: "500px", width: "100%" }}',
    '• NEVER use height: "100%" or height: "100vh" — Leaflet requires resolved dimensions at mount time.',
    '• Remove all flex / overflow / position from MapContainer itself; put those on the wrapper div.',
    '• L OBJECT: if L.* is called (L.latLngBounds, L.icon, L.divIcon, etc.) and L is not imported, either add import L from "leaflet" OR — preferred — replace L.latLngBounds(arr) with plain array: map.fitBounds([[lat,lng],...]) which needs no L import.',
    '• ABSOLUTE POSITIONING: spans/divs with position:absolute inside a positioned container have top/left relative to THAT container. If a label appears offscreen, either remove it or recalculate: child top = canvas_y - container_top.',
    '• Correct pattern:',
    '    <div style={{ width: "100%", height: "500px" }}>',
    '      <MapContainer style={{ height: "500px", width: "100%" }} center={[lat,lng]} zoom={10}>',
    '        …',
    '      </MapContainer>',
    '    </div>',
    '',
    '════ FETCH / STATE RULES ════',
    '• Array state must initialise as []:  const [data, setData] = useState([])',
    '• Fetch inside useEffect ONLY — never call fetch() during render.',
    '• Fetch path: /data/PageName.csv — no leading /public, no ./ prefix.',
    '• Skip header row: const [, ...rows] = text.trim().split("\\n")',
    '',
    dataContext,
    '════ OUTPUT FORMAT ════',
    `===FILE: ${filePath}===`,
    '// complete corrected file',
    '===END FILE===',
    '',
    'Output ONLY the corrected file. No explanations. Start with ===FILE:',
  ].join('\n');

  const userParts = [
    `Fix this runtime error in ${filePath}:`,
    '',
    '══ ISSUE (what fails at runtime) ══',
    issueSummary,
    '',
  ];
  if (fixSuggestion) {
    userParts.push('══ SUGGESTED FIX (apply this) ══', fixSuggestion, '');
  }
  userParts.push(
    '══ CURRENT FILE ══',
    `===FILE: ${filePath}===`,
    fileContent || '// (missing — generate a complete working component)',
    `===END FILE===`,
    '',
    'Apply the fix above and output the complete corrected file:',
  );

  return [
    { role: 'system', content: system },
    { role: 'user', content: userParts.join('\n') },
  ];
}

async function think(model, prompt, onToken) {
  console.log(`[Think] Starting reasoning with ${model}...`);
  // 8192 tokens for the architecture plan — previous 1500 was cutting off every run
  const result = await generate(model, prompt, onToken, 8192);
  console.log(`[Think] Completed. Output length: ${result.length} chars`);
  return result;
}

/**
 * Extracts the clean plan from a thinking response.
 * Strips <think>…</think> blocks leaving only the final output.
 */
function extractPlan(raw) {
  return raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

/* ═══════════════════════════════════════════════════════
   PROMPT BUILDER
   Constructs the LLM prompt from the pages array.
   Uses ===FILE: …=== delimiters for reliable extraction.
   ═══════════════════════════════════════════════════════ */
function buildPrompt(pages, architecturePlan) {
  let p = '';
  p += 'You are an expert React developer. Generate production-quality code.\n';
  p += 'Tech stack: React 18, React Router v6, functional components, hooks.\n\n';

  /* Include the deep-thinking architecture plan if available */
  if (architecturePlan) {
    p += '═══ ARCHITECTURE PLAN (follow this closely) ═══\n';
    p += architecturePlan + '\n\n';
  }

  // Add reference examples for coding phase — enriched RAG query with CSV + SVG
  const ragQuery = pages.map(pg => {
    const parts = [pg.name, pg.type, pg.requirements || ''];
    if (pg.csvFile) parts.push(`CSV columns: ${pg.csvFile.content.split('\n')[0]}`);
    if (pg.svgFile) {
      const svgTokens = [...pg.svgFile.content.matchAll(/(?:id|class)="([^"]+)"/g)]
        .map(m => (m[1] || '').toLowerCase()).filter(t => t.length > 2).slice(0, 15).join(' ');
      if (svgTokens) parts.push(`SVG layout: ${svgTokens}`);
    }
    return parts.join(' ');
  }).join(' | ');
  const { summary } = getRelevantExamples(ragQuery, 3);
  if (summary) {
    const lines = summary.split('\n');
    const fileRefs = lines.filter(l => l.startsWith('File:')).map(l => l.replace('File:', '').trim());
    console.log(`[RAG] Build-prompt phase: ${fileRefs.length} example(s) — ${fileRefs.join(', ') || '(no file refs)'}`);
    p += '═══ REFERENCE EXAMPLES (use similar patterns) ═══\n';
    p += summary + '\n';
  }

  p += '═══ PAGE REQUIREMENTS ═══\n';
  for (const pg of pages) {
    p += `── PAGE: "${pg.name}" (type: ${pg.type}) ──\n`;
    if (pg.requirements) p += `Requirements:\n${pg.requirements}\n`;
    if (pg.type === 'home') {
      const others = pages
        .filter((x) => x.type !== 'home')
        .map((x) => x.name);
      if (others.length)
        p += `Include navigation links to: ${others.join(', ')}\n`;
    }
    if (pg.type === 'geovisualization') {
      p += 'Use react-leaflet (MapContainer, TileLayer, Marker, Popup) for the interactive map.\n';
      p += "Import 'leaflet/dist/leaflet.css' for map styles.\n";
      p += 'CRITICAL JSX RULES for TileLayer:\n';
      p += '  - attribution MUST use template literal: attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>`}\n';
      p += '  - url MUST be a complete quoted string: url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"\n';
      p += '  - Never leave prop strings unterminated across lines\n';
      if (pg.csvFile) {
        const hdr = pg.csvFile.content.split('\n')[0];
        const { cols, roles } = inferColumnRoles(hdr);
        const rolesStr = Object.entries(roles).map(([r, c]) => `${c}→${r}`).join(', ');
        p += `CSV columns (use EXACTLY): ${cols.join(', ')}${rolesStr ? ` | roles: ${rolesStr}` : ''}\n`;
        const csvSafe = pg.name.replace(/[^a-zA-Z0-9]/g, '');
        p += `CSV is a static asset at /data/${csvSafe}.csv — fetch() it at runtime, NEVER embed inline.\n`;
        p += `Sample (first 3 rows):\n${pg.csvFile.content.split('\n').slice(0, 4).join('\n')}\n`;
      }
    }
    if (pg.svgFile)
      p += `SVG mockup (follow this layout closely):\n${pg.svgFile.content}\n`;
    p += '\n';
  }

  p += '═══ OUTPUT FORMAT (MANDATORY) ═══\n';
  p += 'Output EVERY file using this EXACT delimiter format:\n\n';
  p += '===FILE: src/App.jsx===\n';
  p += '// your code\n';
  p += '===END FILE===\n\n';

  p += 'Required files:\n';
  p += '  • src/App.jsx  — main component with BrowserRouter + Routes\n';
  p += '  • src/App.css  — all styles (import in App.jsx)\n';
  const pageNames = pages.map((pg) =>
    pg.name.replace(/[^a-zA-Z0-9]/g, '')
  );
  p += `  • ${pageNames.map((n) => `src/pages/${n}.jsx`).join(', ')}\n\n`;
  p +=
    'Already installed: react, react-dom, react-router-dom, leaflet, react-leaflet, recharts\n';
  p += 'Do NOT output package.json, index.html, or main.jsx — they exist.\n';
  p += 'The entry point already renders <App /> from "./App".\n';
  p +=
    'Use ONLY the ===FILE: path=== / ===END FILE=== format. No prose outside file blocks.\n';

  return p;
}

/* ═══════════════════════════════════════════════════════
   STEP 1 — GENERATE
   Streams tokens from Ollama; calls onToken for each.
   Returns the full concatenated response text.
   ═══════════════════════════════════════════════════════ */

/**
 * postWithRetry — wraps axios.post with retry on 502/503/504/timeout.
 * Viridian's nginx proxy returns 504 if the model takes >60s to first byte
 * (e.g. on cold-load or heavy queue). We retry up to 4 times with backoff.
 */
async function postWithRetry(url, body, config, maxRetries = 4) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await axios.post(url, body, config);
    } catch (err) {
      const status = err.response?.status;
      const isRetryable = status === 502 || status === 503 || status === 504
        || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED';
      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }
      const wait = Math.min(2000 * Math.pow(2, attempt), 15000);
      console.log(`[postWithRetry] ${status || err.code} on ${url.replace(OLLAMA_HOST,'')} — retry ${attempt+1}/${maxRetries} in ${wait}ms`);
      await new Promise(r => setTimeout(r, wait));
      lastErr = err;
    }
  }
  throw lastErr;
}

async function generate(model, prompt, onToken, maxTokens = 2000, options = {}) {
  console.log(`[Generate] Model: ${model}, Prompt length: ${prompt.length} chars`);
  console.log(`[Generate] ── PROMPT ──\n${prompt}\n[Generate] ── END PROMPT ──`);
  // temperature=0.1 + top_p=0.9 → near-deterministic output; caller options override
  const ollamaOptions = { num_predict: maxTokens, num_ctx: 32768, temperature: 0.1, top_p: 0.9, ...options };

  const maxRetries = 3;
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await postWithRetry(
        `${OLLAMA_HOST}/api/generate`,
        { model, prompt, stream: true, keep_alive: '10m', options: ollamaOptions },
        {
          responseType: 'stream',
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
          timeout: 600000,
        }
      );
      let full = '';
      let buf = '';
      await new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          buf += chunk.toString();
          const lines = buf.split('\n');
          buf = lines.pop();
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              const tok = parsed.response || '';
              if (tok) { full += tok; if (onToken) onToken(tok); }
              if (parsed.done) resolve();
            } catch (_) { /* partial / non-JSON */ }
          }
        });
        response.data.on('end', resolve);
        response.data.on('error', reject);
      });
      console.log(`[Generate] Completed. Output: ${full.length} chars`);
      return full;
    } catch (err) {
      lastErr = err;
      if (attempt === maxRetries) throw err;
      const wait = Math.min(3000 * Math.pow(2, attempt), 20000);
      console.log(`[Generate] Stream error (attempt ${attempt+1}/${maxRetries+1}): ${err.code || err.message?.slice(0,80)} — retrying in ${wait}ms`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

/* ═══════════════════════════════════════════════════════
   STEP 1b — CHAT (multi-turn)
   Like generate() but uses /api/chat with a messages array.
   This lets the fix loop carry full conversation history
   so the model remembers its previous code + errors.
   ═══════════════════════════════════════════════════════ */
async function chat(model, messages, onToken, options = {}) {
  // temperature=0.1 + top_p=0.9 → near-deterministic; caller options override
  const chatOptions = { num_predict: -1, num_ctx: 32768, temperature: 0.1, top_p: 0.9, ...options };
  console.log(`[Chat] Model: ${model}, Messages: ${messages.length}, total chars: ${messages.reduce((s,m)=>s+(m.content||'').length,0)}`);
  console.log(`[Chat] ── MESSAGES ──\n${messages.map(m=>`[${m.role}]\n${m.content}`).join('\n---\n')}\n[Chat] ── END MESSAGES ──`);

  const maxRetries = 3;
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await postWithRetry(
        `${OLLAMA_HOST}/api/chat`,
        { model, messages, stream: true, keep_alive: '10m', options: chatOptions },
        {
          responseType: 'stream',
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
          timeout: 600000,
        }
      );
      let full = '';
      let buf = '';
      await new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          buf += chunk.toString();
          const lines = buf.split('\n');
          buf = lines.pop();
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              const tok = parsed.message?.content || '';
              if (tok) { full += tok; if (onToken) onToken(tok); }
              if (parsed.done) resolve();
            } catch (_) { /* partial / non-JSON */ }
          }
        });
        response.data.on('end', resolve);
        response.data.on('error', reject);
      });
      console.log(`[Chat] Completed. Output: ${full.length} chars`);
      return full;
    } catch (err) {
      lastErr = err;
      if (attempt === maxRetries) throw err;
      const wait = Math.min(3000 * Math.pow(2, attempt), 20000);
      console.log(`[Chat] Stream error (attempt ${attempt+1}/${maxRetries+1}): ${err.code || err.message?.slice(0,80)} — retrying in ${wait}ms`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

/**
 * unloadModel
 * Explicitly evict a model from Ollama VRAM so the next model can load
 * without competing for memory. Uses keep_alive:0 with an empty prompt.
 */
async function unloadModel(model) {
  try {
    await axios.post(
      `${OLLAMA_HOST}/api/generate`,
      { model, prompt: '', keep_alive: 0, stream: false },
      { headers: { Authorization: authHeader, 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    console.log(`[Ollama] Unloaded model: ${model}`);
  } catch (e) {
    console.warn(`[Ollama] Unload ${model} failed (non-fatal):`, e.message);
  }
}

/* ═══════════════════════════════════════════════════════
   Strips <think> blocks, then extracts ===FILE: …===
   delimited files. Falls back to fenced code blocks.
   ═══════════════════════════════════════════════════════ */
function extractFiles(raw) {
  // Strip thinking traces from reasoning models (qwen3 etc.)
  let text = raw.replace(/<think>[\s\S]*?<\/think>/g, '');

  const files = [];
  let m;

  // Primary pattern: ===FILE: path=== … ===END FILE===
  const delim = /===FILE:\s*(.+?)\s*===\s*\n([\s\S]*?)===END FILE===/g;
  while ((m = delim.exec(text)) !== null) {
    let content = m[2].trim();
    // Strip wrapping code fences if LLM nested them inside delimiters
    content = content.replace(/^```[\w]*\n/, '').replace(/\n```$/, '');
    files.push({ path: m[1].trim(), content });
  }
  if (files.length) {
    console.log(`[Extract] Found ${files.length} files using primary pattern: ${files.map(f => f.path).join(', ')}`);
    return files;
  }

  // Fallback A: ```lang\n// src/filename.ext\n … ```
  const commented =
    /```(?:jsx?|tsx?|css)\s*\n(?:\/[/*]+\s*(src\/[\w/.-]+)\s*\*?\/?\s*\n)([\s\S]*?)```/g;
  while ((m = commented.exec(text)) !== null) {
    files.push({ path: m[1].trim(), content: m[2].trim() });
  }
  if (files.length) {
    console.log(`[Extract] Found ${files.length} files using fallback A (commented)`);
    return files;
  }

  // Fallback B: grab the biggest JSX block + any CSS block
  const allJsx = [
    ...text.matchAll(/```(?:jsx?|tsx?)\s*\n([\s\S]*?)```/g),
  ];
  if (allJsx.length) {
    allJsx.sort((a, b) => b[1].length - a[1].length);
    files.push({ path: 'src/App.jsx', content: allJsx[0][1].trim() });
  }
  const cssMatch = /```css\s*\n([\s\S]*?)```/.exec(text);
  if (cssMatch) {
    files.push({ path: 'src/App.css', content: cssMatch[1].trim() });
  }

  if (files.length) {
    console.log(`[Extract] Found ${files.length} files using fallback B (code blocks)`);
  } else {
    console.log('[Extract] No files found in output!');
  }

  return files;
}

/* ═══════════════════════════════════════════════════════
   SCAFFOLD — Deterministic App.jsx + App.css
   Routing and app shell are FIXED and never need the LLM.
   Generated from the pages array every time.
   ═══════════════════════════════════════════════════════ */
function scaffoldApp(pages) {
  const files = [];

  // Build route/import info from pages
  const pageInfos = pages.map((pg) => {
    const safe = pg.name.replace(/[^a-zA-Z0-9]/g, '');
    // React components MUST start with uppercase — capitalize for import alias and JSX
    const pascal = safe.charAt(0).toUpperCase() + safe.slice(1);
    const route =
      pg.type === 'home'
        ? '/'
        : '/' + pg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return { name: pg.name, safe, pascal, route, type: pg.type };
  });

  // ── src/App.jsx ──
  const hasHome = pageInfos.some(pi => pi.type === 'home');
  const firstRoute = pageInfos[0]?.route || '/';

  let app = '';
  app += "import React from 'react';\n";
  // Add Navigate only when we need a root redirect
  app += hasHome
    ? "import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';\n"
    : "import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';\n";
  app += "import './App.css';\n";
  for (const pi of pageInfos) {
    // Use pascal (capitalized) as import alias so JSX <Pascal /> works correctly
    app += `import ${pi.pascal} from './pages/${pi.safe}.jsx';\n`;
  }
  app += '\n';
  app += 'export default function App() {\n';
  app += '  return (\n';
  app += '    <BrowserRouter>\n';
  app += '      <nav className="flex items-center gap-1 px-6 py-3 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">\n';
  app += '        <span className="font-bold text-gray-900 text-base mr-4">NSRD</span>\n';
  for (const pi of pageInfos) {
    app += `        <NavLink to="${pi.route}" className={({isActive}) => 'px-3 py-1.5 rounded text-sm font-semibold transition-colors ' + (isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900')}>${pi.name}</NavLink>\n`;
  }
  app += '      </nav>\n';
  app += '      <main className="min-h-screen bg-gray-50">\n';
  app += '        <Routes>\n';
  for (const pi of pageInfos) {
    app += `          <Route path="${pi.route}" element={<${pi.pascal} />} />\n`;
  }
  // If no home page, redirect / → first page so the app never shows a blank screen
  if (!hasHome) {
    app += `          <Route path="/" element={<Navigate to="${firstRoute}" replace />} />\n`;
  }
  app += '        </Routes>\n';
  app += '      </main>\n';
  app += '    </BrowserRouter>\n';
  app += '  );\n';
  app += '}\n';
  files.push({ path: 'src/App.jsx', content: app });

  // ── src/App.css ──
  // Tailwind (via src/index.css → @tailwind directives) handles all base styling.
  // App.css is kept for any custom overrides that Tailwind can't express.
  let css = '';
  css += '/* App.css — custom overrides (Tailwind base is in src/index.css) */\n';
  css += '\n';
  css += '/* Leaflet map container fix — ensure tiles render correctly */\n';
  css += '.leaflet-container { z-index: 1; }\n';
  files.push({ path: 'src/App.css', content: css });

  // ── public/data/<Page>.csv — static CSV assets fetched at runtime ──
  for (const pg of pages) {
    if (pg.csvFile && pg.csvFile.content) {
      const safe = pg.name.replace(/[^a-zA-Z0-9]/g, '');
      files.push({ path: `public/data/${safe}.csv`, content: pg.csvFile.content });
    }
  }

  return files;
}

/* ═══════════════════════════════════════════════════════
   STEP 3 — DEPLOY
   Copies the Vite+React template into the project dir,
   writes generated files, symlinks node_modules, and
   runs `vite build`. Returns { success, stdout, stderr }.
   ═══════════════════════════════════════════════════════ */
async function deploy(projectId, files) {
  const projDir = path.join(PROJECTS_DIR, projectId);

  // Clean previous attempt
  try {
    await fs.rm(projDir, { recursive: true, force: true });
  } catch {}
  await fs.mkdir(path.join(projDir, 'src', 'pages'), { recursive: true });
  await fs.mkdir(path.join(projDir, 'public', 'data'), { recursive: true });

  // Copy template skeleton (not node_modules)
  for (const f of ['package.json', 'vite.config.js', 'index.html']) {
    await fs.copyFile(path.join(TEMPLATE_DIR, f), path.join(projDir, f));
  }
  // Copy Tailwind/PostCSS config if present (graceful — non-fatal if missing)
  for (const f of ['postcss.config.js', 'tailwind.config.js']) {
    try {
      await fs.copyFile(path.join(TEMPLATE_DIR, f), path.join(projDir, f));
    } catch {}
  }
  await fs.copyFile(
    path.join(TEMPLATE_DIR, 'src', 'main.jsx'),
    path.join(projDir, 'src', 'main.jsx')
  );
  // Copy index.css (Tailwind entry point) if present
  try {
    await fs.copyFile(
      path.join(TEMPLATE_DIR, 'src', 'index.css'),
      path.join(projDir, 'src', 'index.css')
    );
  } catch {}

  // Symlink the shared node_modules (pre-installed in Docker image)
  const nmSrc = path.join(TEMPLATE_DIR, 'node_modules');
  try {
    await fs.access(nmSrc);
  } catch {
    throw new Error(
      'Template node_modules not found. Run: cd /app/templates/react-app && npm install'
    );
  }
  await fs.symlink(nmSrc, path.join(projDir, 'node_modules'));

  // Auto-fix common LLM code mistakes before writing
  const knownPaths = new Set(files.map((f) => f.path));
  for (const f of files) {
    if (f.path.endsWith('.jsx') || f.path.endsWith('.tsx') || f.path.endsWith('.js') || f.path.endsWith('.ts')) {
      // Fix bare CSS imports: import App.css; → import './App.css';
      f.content = f.content.replace(
        /^(\s*import\s+)([\w.-]+\.css)\s*;/gm,
        (_, pre, file) => `${pre}'./${file}';`
      );
      // Fix CSS imports missing ./: import 'App.css' → import './App.css'
      f.content = f.content.replace(
        /^(\s*import\s+['"])(?!\.\/)(?!\.\.)(?!\/)(?!react)(?!leaflet)(?!recharts)([\w.-]+\.css['"])/gm,
        '$1./$2'
      );
      // Remove imports of files that don't exist in the output
      f.content = f.content.replace(
        /^\s*import\s+.*from\s+['"]\.\.?\/(?:assets|components|utils)\/[^'"]+['"]\s*;?\s*$/gm,
        (line) => {
          // Extract the path from the import
          const pathMatch = line.match(/['"](\.\.\/|\.\/)([^'"]+)['"]/);
          if (!pathMatch) return line;
          const importedPath = 'src/' + pathMatch[2].replace(/^\.\.?\//, '');
          // Check common extensions
          const extensions = ['', '.jsx', '.js', '.tsx', '.ts', '.css'];
          const exists = extensions.some((ext) => knownPaths.has(importedPath + ext));
          if (!exists) {
            console.log(`[Sanitizer] Removed dead import: ${line.trim()}`);
            return '// [auto-removed: file not in project] ' + line.trim();
          }
          return line;
        }
      );
    }
  }

  // Write all generated files
  console.log(`[Deploy] Writing ${files.length} files: ${files.map(f => f.path).join(', ')}`);
  for (const f of files) {
    const fp = path.join(projDir, f.path);
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(fp, f.content, 'utf-8');
  }

  // Build with Vite
  try {
    console.log(`[Deploy] Running vite build in ${projDir}`);
    const { stdout, stderr } = await execAsync(
      './node_modules/.bin/vite build',
      { cwd: projDir, timeout: 120000 }
    );
    console.log(`[Deploy] Vite build SUCCESS for ${projectId}`);
    return { success: true, stdout: stdout || '', stderr: stderr || '' };
  } catch (err) {
    const error = new Error('Vite build failed');
    error.stdout = err.stdout || '';
    error.stderr = err.stderr || err.message || '';
    console.error(`[Deploy] Vite build FAILED for ${projectId}:`, error.stderr.slice(0, 200));
    throw error;
  }
}

/* ═══════════════════════════════════════════════════════
   STEP 4 — FIX PROMPT BUILDER
   Constructs a repair prompt from build errors + code.
   ═══════════════════════════════════════════════════════ */
function buildFixPrompt(files, errors, fixPlan) {
  let p = 'BUILD FAILED - FIX REQUIRED\n\n';

  if (fixPlan) {
    p += 'FIX STRATEGY:\n' + fixPlan + '\n\n';
  }

  p += `ERRORS:\n${errors}\n\n`;
  
  p += 'BROKEN FILES:\n';
  for (const f of files) {
    p += `===FILE: ${f.path}===\n${f.content}\n===END FILE===\n\n`;
  }
  
  p += 'INSTRUCTIONS:\n';
  p += '1. Fix ALL syntax errors shown above\n';
  p += '2. Return ALL files using ===FILE: path===\\ncode\\n===END FILE===\n';
  p += '3. NO explanations. ONLY code blocks.\n';
  p += '4. Start response with ===FILE:, not with text\n';
  p += '5. Check: matching brackets {}, proper style object syntax\n';
  p += '6. NO orphaned colons (e.g., "  : {" without property name)\n\n';
  p += 'Generate corrected files NOW:';
  
  return p;
}

/* ═══════════════════════════════════════════════════════
   CHAT MESSAGE BUILDERS
   Construct the messages array for the /api/chat endpoint.
   This gives the coder model multi-turn conversation memory
   so fix attempts carry full context of what was tried before.
   ═══════════════════════════════════════════════════════ */

/**
 * Build the initial messages for code generation.
 * Returns [system, user] messages that start the conversation.
 */
function buildChatMessages(pages, architecturePlan, ragSummary, opts = {}) {
  // experimentMode: strip golden-template + raw SVG injection so the prompt is
  // dominated by the per-page Requirements (used by the experiments harness).
  const tpl = opts.experimentMode ? () => null : loadGoldenExample;
  // ── System prompt ──
  const systemLines = [
    'You are a React 18 + Vite developer. Generate complete, valid JSX. No TypeScript.',
    '',
    '══════════════════════════════════════════════════════════════',
    '⚠️  CRITICAL: You can ONLY use these pre-installed libraries:',
    '══════════════════════════════════════════════════════════════',
    '  ✓ react, react-dom           — UI framework',
    '  ✓ react-router-dom           — routing (<BrowserRouter>, <Routes>, <Route>, <Link>)',
    '  ✓ leaflet, react-leaflet     — maps (<MapContainer>, <TileLayer>, <Marker>, <Popup>)',
    '  ✓ recharts                   — charts (<LineChart>, <BarChart>, <PieChart>, <Area>, etc.)',
    '  ✓ papaparse                  — CSV parsing (import Papa from "papaparse"; Papa.parse())',
    '',
    '  ✗ DO NOT import: csv-parser, d3, chart.js, axios, lodash, or ANY other library',
    '  ✗ Use native fetch() for data loading — no axios or other HTTP clients',
    '══════════════════════════════════════════════════════════════',
    '',
    'STYLING RULES:',
    '- Use Tailwind CSS utility classes for all layout and styling — it is pre-installed (tailwindcss v3, @tailwind base/components/utilities already in index.css).',
    '- EXCEPTION: MapContainer MUST always have style={{ height: "500px", width: "100%" }} as a direct prop — Tailwind h-* classes do not work on Leaflet maps.',
    '- Do NOT import any additional CSS files.',
    '',
    'SYNTAX RULES (every violation causes a build failure):',
    '1. Arrow callbacks require => : rows.map((row, i) => { ... })',
    '2. No commas between JSX props: <Tag a="x" b={y}>',
    '3. Object keys require colon: { id: 1, name: "x" }  NOT { id 1 name "x" }',
    '4. Every JSX tag must close: <div>...</div> or <Tag />',
    '5. MapContainer must use style={{ height:"500px", width:"100%" }}',
    '6. TileLayer attribution must use: attribution={`&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>`}',
    '7. Never import CSS files that are not returned in your output.',
    '8. Never output src/App.jsx — it is auto-generated.',
    '9. LEAFLET L OBJECT: if you use L.* directly (L.latLngBounds, L.icon, L.divIcon, etc.) you MUST add import L from "leaflet" at the top of the file. PREFERRED: avoid L.* entirely — use plain arrays with map.fitBounds([[lat,lng],...]) instead.',
    '10. ABSOLUTE POSITIONING IN NESTED CONTAINERS: when a child element has position:absolute inside a parent that also has position:absolute/relative, the child top/left values are relative to the PARENT — not the root canvas. Subtract the parent\'s top/left offset. Example: if parent is at canvas top=184px and child should appear at canvas y=248px, set child top: 64px (= 248-184). Never copy root-canvas coordinates directly into a nested container.',
    '11. LEAFLET INVISIBLE MARKERS FIX — always add this at module level (outside the component) when importing react-leaflet, or ALL markers will be invisible:',
    '    import L from "leaflet";',
    '    delete L.Icon.Default.prototype._getIconUrl;',
    '    L.Icon.Default.mergeOptions({ iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png", iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png", shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png", iconSize: [25,41], iconAnchor: [12,41] });',
    '',
    'CSV DATA PATTERN — use inline CSV constant + parseCSV helper (same pattern as all golden examples):',
    '  const MY_CSV = `col1,col2,col3\nval,val,val`;',
    '  function parseCSV(csv) {',
    '    const [header, ...rows] = csv.trim().split("\\n");',
    '    const keys = header.split(",").map(k => k.trim());',
    '    return rows.map(row => {',
    '      const vals = row.split(",");',
    '      return keys.reduce((obj, k, i) => { const v = vals[i]?.trim(); obj[k] = isNaN(v) ? v : Number(v); return obj; }, {});',
    '    });',
    '  }',
    '  // Then in component: const [data, setData] = useState(() => parseCSV(MY_CSV));',
    '  // For real uploaded data: fetch + set in useEffect, but prefer inline when data is small.',
    '',
    'CRITICAL:',
    '- Do NOT add explanations or comments.',
    '- Do NOT wrap output in markdown.',
    '',
    'OUTPUT FORMAT (STRICT):',
    '===FILE: src/pages/Name.jsx===',
    '// full file content',
    '===END FILE===',
    '',
    'Start output with ===FILE:',
  ];

  // RAG: skip injection when golden templates will be inlined in the user
  // message — the template IS the best example and adding 4 more full files
  // (30 k+ chars) only confuses the model and bloats the prompt.
  // RAG is still useful for the *think* phase (architecture planner) and
  // for the *fix* phase (error patterns).  Only skip for code generation.
  const hasTemplatesInline = pages.some(pg =>
    (pg.csvFile) || pg.type === 'home'
  );
  if (ragSummary && ragSummary.trim() && !hasTemplatesInline) {
    systemLines.splice(1, 0, '', 'REFERENCE EXAMPLES (follow these patterns):', ragSummary, '');
    console.log('[RAG] Generation: injected ragSummary into system prompt');
  } else if (ragSummary && hasTemplatesInline) {
    console.log('[RAG] Generation: SKIPPED ragSummary (golden template already inlined for each page)');
  }

  if (architecturePlan) {
    systemLines.push('', 'ARCHITECTURE PLAN:', architecturePlan);
  }

  const system = systemLines.join('\n');

  // ── User message: one compact block per page ──
  const pageBlocks = pages.map((pg) => {
    const safe = pg.name.replace(/[^a-zA-Z0-9]/g, '');
    // React component names must start with uppercase (PascalCase)
    const pascal = safe.charAt(0).toUpperCase() + safe.slice(1);
    const lines = [`PAGE: src/pages/${safe}.jsx  (type: ${pg.type})`];

    if (pg.requirements) lines.push(`Requirements: ${pg.requirements}`);

    if (pg.type === 'geovisualization') {
      const leafletTemplate  = tpl('LeafletMap.jsx');

      if (pg.csvFile) {
        const analysis = analyzeCSV(pg.csvFile.content);
        const { cols, roles, colMeta, mapCenter, mapZoom, parsedRows } = analysis;
        const csvLines = pg.csvFile.content.trim().split('\n');
        const inlineData = csvLines.slice(0, 31).join('\n');
        const colSummary = colMeta.map(m => {
          const roleTag = Object.entries(roles).find(([, v]) => v === m.norm)?.[0];
          return `  ${m.col}${roleTag ? ` [→${roleTag}]` : ''} (${m.isAllNumeric ? `numeric ${m.min}–${m.max}` : 'string'})  e.g. ${m.samples[0]}`;
        }).join('\n');

        // --- Smart template selection ---
        // Has a date/time column → use map + time series template (click site → see trend)
        // No date column         → use default map + scatter/summary template
        const hasDateCol = !!roles.date;
        const numericMeasurementCols = colMeta.filter(
          m => m.isAllNumeric && m.norm !== roles.lat && m.norm !== roles.lng
        );
        // Unique locations: if repeated lat/lng rows exist, data is time-series per site
        const geoTemplateName = hasDateCol
          ? 'nsrd/GeoTimeSeriesMap.jsx'
          : 'nsrd/MonitoringTowerMap.jsx';
        const geoTemplate = tpl(geoTemplateName);
        console.log(`[TEMPLATE] geovis: using ${geoTemplateName} (hasDate=${hasDateCol})`);

        lines.push(...[
          '',
          `── CSV DATA (${parsedRows} rows, ${cols.length} columns) ─────────────────────────`,
          `Lat column  : ${roles.lat || 'NOT DETECTED'}`,
          `Lng column  : ${roles.lng || 'NOT DETECTED'}`,
          roles.date ? `Date column : ${roles.date}` : null,
          `Map center  : [${mapCenter[0]}, ${mapCenter[1]}]  zoom: ${mapZoom}`,
          `All columns :\n${colSummary}`,
          '',
          'Inline CSV (embed this as your DATA constant — do NOT use fetch or Papa.parse):',
          '```csv',
          inlineData,
          '```',
        ].filter(Boolean));

        if (geoTemplate) {
          if (hasDateCol) {
            // GeoTimeSeriesMap instructions
            lines.push(
              '',
              '⚠ WORKING TEMPLATE — this file already compiles and renders correctly. ADAPT IT — do NOT rewrite from scratch.',
              'This template shows clickable site markers on a map + a time series line chart for the selected site.',
              'Make only these changes:',
              `  1. Replace the DATA_CSV string with the Inline CSV data above.`,
              `  2. Update the deduplication key in useMemo (tower_id → actual site/id column: "${roles.label || cols[0]}").`,
              `  3. Update lat/lng references (latitude → ${roles.lat}, longitude → ${roles.lng}).`,
              `  4. Update datetime reference (datetime → ${roles.date}).`,
              `  5. Update METRICS array to use actual numeric column names: ${numericMeasurementCols.slice(0, 4).map(m => m.col).join(', ')}.`,
              `  6. Change mapCenter to [${mapCenter[0]}, ${mapCenter[1]}] and zoom to ${mapZoom}.`,
              `  7. Rename the component export to \`${pascal}\` (must start with uppercase).`,
              '  8. Update titles and labels to match Requirements.',
              '  9. NEVER change center={[lat,lng]} to position= on CircleMarker — center= is correct.',
              '',
              '```jsx',
              geoTemplate,
              '```',
            );
          } else {
            // MonitoringTowerMap instructions (original)
            lines.push(
              '',
              '⚠ WORKING TEMPLATE — this file already compiles and renders correctly. ADAPT IT — do NOT rewrite from scratch.',
              'Make only these changes:',
              '  1. Replace the TOWER_CSV string with the Inline CSV data above.',
              '  2. In parseCSV output object: rename field keys (tower→actual col, lat→actual col, etc.) to match actual column names.',
              `  3. Change center to [${mapCenter[0]}, ${mapCenter[1]}] and zoom to ${mapZoom}.`,
              `  4. Rename the component export to \`${pascal}\` (must start with uppercase).`,
              '  5. Update titles and labels to match Requirements.',
              '  6. Keep ALL imports, CircleMarker, parseCSV function, and Tailwind classes unchanged.',
              '  7. Every CSV row MUST appear as a CircleMarker on the map.',
              '  8. NEVER change center={[lat,lng]} to position= on CircleMarker — center= is correct.',
              '',
              '```jsx',
              geoTemplate,
              '```',
            );
          }
        }
      } else {
        if (leafletTemplate) {
          lines.push(
            '',
            '⚠ WORKING TEMPLATE (no CSV). Adapt component name and requirements only — do NOT rewrite:',
            '```jsx',
            leafletTemplate,
            '```',
          );
        }
      }
    }

    if (pg.type === 'base') {
      const rechartsTemplate = tpl('RechartsBoard.jsx');

      if (pg.csvFile) {
        const analysis = analyzeCSV(pg.csvFile.content);
        const { cols, roles, colMeta, parsedRows } = analysis;
        const csvLines = pg.csvFile.content.trim().split('\n');
        const inlineData = csvLines.slice(0, 31).join('\n');
        const colSummary = colMeta.map(m =>
          `  ${m.col} (${m.isAllNumeric ? `numeric ${m.min}–${m.max}` : 'string'})  e.g. ${m.samples[0]}`
        ).join('\n');

        // --- Smart template selection for dashboards ---
        // Has date column → time series dashboard (line chart over time)
        // Many numeric cols, no date → KPI table dashboard (sortable table + bar chart)
        // Default → MonitoringDashboard (KPI cards + bar chart + alerts)
        const hasDateCol  = !!roles.date;
        const numericCols = colMeta.filter(m => m.isAllNumeric && m.norm !== roles.lat && m.norm !== roles.lng);
        const textCols    = colMeta.filter(m => !m.isAllNumeric);
        const dashTemplateName = hasDateCol
          ? 'nsrd/TimeSeriesDashboard.jsx'
          : (numericCols.length >= 3 && textCols.length >= 1 && !roles.lat)
            ? 'nsrd/KpiTableDashboard.jsx'
            : 'nsrd/MonitoringDashboard.jsx';
        const dashTemplate = tpl(dashTemplateName) || rechartsTemplate;
        console.log(`[TEMPLATE] base: using ${dashTemplateName} (hasDate=${hasDateCol}, numericCols=${numericCols.length})`);

        lines.push(
          '',
          `── CSV DATA (${parsedRows} rows, ${cols.length} columns) ─────────────────────────────`,
          `Columns:\n${colSummary}`,
          '',
          'Inline CSV (embed as DATA constant — do NOT use fetch or Papa.parse):',
          '```csv',
          inlineData,
          '```',
        );

        if (dashTemplate) {
          if (dashTemplateName === 'nsrd/TimeSeriesDashboard.jsx') {
            lines.push(
              '',
              '⚠ WORKING TEMPLATE — adapt this file. Do NOT rewrite from scratch.',
              'This template shows KPI cards + multi-metric line/area chart over time + sortable data table.',
              'Make only these changes:',
              `  1. Replace DATA_CSV with the Inline CSV data above.`,
              `  2. Update METRICS array to use actual numeric column names: ${numericCols.slice(0, 5).map(m => m.col).join(', ')}.`,
              `  3. Update the date field reference (date → ${roles.date}).`,
              `  4. Rename component export to \`${pascal}\` (must start with uppercase).`,
              '  5. Update titles and labels to match Requirements.',
              '  6. Keep ALL Recharts structure, Tailwind classes, and date logic unchanged.',
              '',
              '```jsx',
              dashTemplate,
              '```',
            );
          } else if (dashTemplateName === 'nsrd/KpiTableDashboard.jsx') {
            lines.push(
              '',
              '⚠ WORKING TEMPLATE — adapt this file. Do NOT rewrite from scratch.',
              'This template shows KPI summary cards + bar chart by category + sortable/filterable data table.',
              'Make only these changes:',
              `  1. Replace DATA_CSV with the Inline CSV data above.`,
              `  2. Update NUM_COLS array to use actual numeric column names: ${numericCols.slice(0, 5).map(m => m.col).join(', ')}.`,
              `  3. Update the category filter field (ecosystem_type → ${roles.cat || textCols[0]?.col || cols[0]}).`,
              `  4. Rename component export to \`${pascal}\` (must start with uppercase).`,
              '  5. Update titles and labels to match Requirements.',
              '  6. Keep ALL Recharts structure, Tailwind classes, sort/filter logic unchanged.',
              '',
              '```jsx',
              dashTemplate,
              '```',
            );
          } else {
            lines.push(
              '',
              '⚠ WORKING TEMPLATE — adapt this file. Do NOT rewrite from scratch:',
              `  1. Replace inline CSV/data constants with the CSV data above.`,
              `  2. Update field references (tower, temp, etc.) to match actual column names.`,
              `  3. Rename component export to \`${pascal}\` (must start with uppercase).`,
              '  4. Update titles/labels to match Requirements.',
              '  5. Keep ALL Recharts structure, Tailwind classes, and data patterns unchanged.',
              '',
              '```jsx',
              dashTemplate,
              '```',
            );
          }
        }
      } else {
        const dashTemplate = tpl('nsrd/MonitoringDashboard.jsx') || rechartsTemplate;
        if (dashTemplate) {
          lines.push(
            '',
            '⚠ WORKING TEMPLATE (no CSV — uses static data). Adapt component name and requirements only.',
            '```jsx',
            dashTemplate,
            '```',
          );
        } else {
          lines.push(
            '',
            'CHARTS: use Recharts — always wrap in <ResponsiveContainer width="100%" height={400}>',
            "  import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';",
          );
        }
      }
    }

    if (pg.type === 'home') {
      const homeTemplate = tpl('nsrd/ResearchProjectHome.jsx') || tpl('Home.jsx');
      const others = pages.filter(x => x.type !== 'home').map(x => x.name.replace(/[^a-zA-Z0-9]/g, ''));

      lines.push(
        '',
        'Static landing page — NO fetch, NO useEffect, NO charts, NO maps.',
      );

      if (homeTemplate) {
        lines.push(
          '',
          '⚠ WORKING TEMPLATE — adapt this file. Do NOT rewrite from scratch:',
          `  1. Rename component export to \`${pascal}\` (must start with uppercase).`,
          `  2. Update FEATURE_CARDS to link to these pages: ${others.length ? others.map(n => `/${n.toLowerCase()}`).join(', ') : '(only page)'}`,
          '  3. Update the project title and description to match Requirements.',
          '  4. Keep all Tailwind classes, Link usage, and card patterns unchanged.',
          '',
          '```jsx',
          homeTemplate,
          '```',
        );
      } else {
        lines.push(
          "Use: import { Link } from 'react-router-dom'; for navigation cards.",
          others.length ? `Link to these pages: ${others.map(n => `<Link to="/${n.toLowerCase()}">`).join(', ')}` : '',
        );
      }
    }

    if (pg.svgFile) {
      const layout = describeSvgLayout(pg.svgFile.content);
      const regions = mapSvgRegions(pg.svgFile.content);
      lines.push(
        '',
        'SVG LAYOUT MOCKUP — implement this layout exactly using CSS Grid or Flex.',
        'Each region in the mockup MUST become a corresponding container in the JSX,',
        'sized in the same proportions (use Tailwind: grid-cols-*, w-*/h-*, flex, etc).',
      );
      if (layout) {
        lines.push('', layout);
      }
      if (regions.length) {
        lines.push('Named region IDs: ' + regions.map(r => `  ${r}`).join(', '));
      }
      if (!opts.experimentMode) {
        lines.push(
          '',
          'Full SVG (raw markup for reference — proportions above are authoritative):',
          pg.svgFile.content,
        );
      }
    }

    return lines.filter(l => l !== '').join('\n');
  });

  const filePaths = pages.map((pg) => `src/pages/${pg.name.replace(/[^a-zA-Z0-9]/g, '')}.jsx`).join(', ');

  const userMsg = [
    `Generate: ${filePaths}`,
    '',
    pageBlocks.join('\n\n---\n\n'),
    '',
    'Output each file now:',
  ].join('\n');

  // Prefill: seed the first ===FILE: line so the model is locked into the correct format
  // and cannot output prose, markdown fences, or thinking preamble before the code.
  const firstPage = pages[0].name.replace(/[^a-zA-Z0-9]/g, '');

  return [
    { role: 'system', content: system },
    { role: 'user', content: userMsg },
    { role: 'assistant', content: `===FILE: src/pages/${firstPage}.jsx===` },
  ];
}

/**
 * buildFixChatMessages
 * Creates a targeted fix conversation from exact build errors + broken code.
 * Pattern: compiler errors + failing code → model → corrected code.
 * (Same pattern used by Copilot fix, Claude code review, etc.)
 */
function buildFixChatMessages(pages, currentFiles, errors, fixPlan, opts = {}) {
  // Build per-page CSV/SVG context block so fixer preserves correct data columns
  let dataContextBlock = '';
  if (pages && pages.length > 0) {
    const parts = pages.map(pg => {
      const safe = pg.name.replace(/[^a-zA-Z0-9]/g, '');
      const lines = [`  ${safe} (${pg.type})`];

      if (pg.type === 'home') {
        lines.push('    HOME page: NO CSV, NO fetch, NO charts — static content only (hardcoded + Tailwind + Link)');
      } else if (pg.csvFile) {
        const hdr = pg.csvFile.content.split('\n')[0];
        const { cols, roles } = inferColumnRoles(hdr);
        const rolesStr = Object.entries(roles).map(([r, c]) => `${c}→${r}`).join(', ');
        lines.push(`    CSV columns: ${cols.join(', ')}${rolesStr ? ` | ${rolesStr}` : ''}`);
        if (opts.experimentMode) {
          lines.push('    CSV is embedded INLINE in the file (DATA_CSV template literal) — keep it inline, do NOT add fetch().');
        } else {
          lines.push(`    CSV asset: /data/${safe}.csv — fetch at runtime`);
        }
      } else {
        lines.push(`    No CSV provided — ${pg.type === 'geovisualization' ? 'use placeholder map coords' : 'use sample data'}`);
      }

      if (pg.svgFile) {
        const regions = mapSvgRegions(pg.svgFile.content);
        const layout = describeSvgLayout(pg.svgFile.content);
        if (regions.length) {
          lines.push(`    SVG regions: ${regions.slice(0, 5).map(r => r.split('→')[0].trim()).join(', ')}`);
        }
        if (layout) {
          // Keep it terse — only the region count + one-line summary per region
          const layoutLines = layout.split('\n').filter(l => /^\s*\d+\./.test(l)).slice(0, 6);
          if (layoutLines.length) {
            lines.push('    SVG layout (proportions to preserve):');
            layoutLines.forEach(l => lines.push('     ' + l.trim()));
          }
        }
      }
      return lines.join('\n');
    }).join('\n');
    dataContextBlock = `\n════ PAGE DATA (preserve these column names & structure) ════\n${parts}\n`;
  }

  const systemPrompt = [
    'You are a strict React JSX syntax repair agent.',
    '',
    'YOUR TASK:',
    'Fix ONLY syntax errors in the provided files.',
    'Do NOT refactor. Do NOT improve code quality. Do NOT change logic.',
    'Do NOT rename variables. Do NOT reorganize structure.',
    'Do NOT modify working code.',
    'Only make the MINIMUM changes required to eliminate syntax errors.',
    '',
    'COMMON SYNTAX ERRORS TO FIX:',
    '1. HTML inside JSX prop strings',
    '   ❌ attribution="&copy; <a href=\'...\'>OpenStreetMap</a>"',
    '   ✅ attribution={`&copy; <a href="...">OpenStreetMap</a>`}',
    '2. Unterminated strings — every opening quote must close on the SAME line.',
    '3. Missing = in JSX props  ❌ position[35.9, -84.3]  ✅ position={[35.9, -84.3]}',
    '4. Malformed style objects  ❌ style={{padding20px}}  ✅ style={{ padding: "20px" }}',
    '5. Unclosed JSX tags — every <Tag> must have </Tag> or be self-closing <Tag />',
    '6. Orphaned colons — remove lines that begin with a colon (:)',
    '7. Object key missing colon  ❌ { description "text" }  ✅ { description: "text" }',
    '8. Prose inside JSX expression braces  ❌ <p>{\'text\'}</p>  ✅ <p>text</p>',
    '',
    'CRITICAL RULES:',
    '- Do NOT convert inline styles to Tailwind.',
    '- Do NOT change formatting unless required to fix syntax.',
    '- If code is already syntactically valid, return it unchanged.',
    '- If unsure, do NOT guess — leave the code unchanged.',
    dataContextBlock,
    'OUTPUT FORMAT (STRICT):',
    '===FILE: src/pages/Name.jsx===',
    '[corrected full file content]',
    '===END FILE===',
    '',
    'Do not add explanations. Do not add comments. Return only corrected files.',
    'Start with ===FILE: — no prose before it.',
  ].join('\n');

  let fixUserMsg = '';

  if (fixPlan) {
    fixUserMsg += `FIX STRATEGY:\n${fixPlan}\n\n`;
  }

  fixUserMsg += `VITE BUILD ERRORS:\n${errors}\n\n`;
  fixUserMsg += 'BROKEN FILES:\n';
  currentFiles.forEach(f => {
    if (f.path.startsWith('src/pages/')) {
      // Do NOT add line numbers — the model copies them back into the output
      fixUserMsg += `\n===FILE: ${f.path}===\n${f.content}\n===END FILE===\n`;
    }
  });

  fixUserMsg += '\nFix the errors above. Return ALL page files. Start with ===FILE:';

  // Prefill: the first broken page file path is always known — seed it so the model
  // cannot output prose or markdown before the code block.
  const firstPageFile = currentFiles.find(f => f.path.startsWith('src/pages/'));
  const prefill = firstPageFile ? `===FILE: ${firstPageFile.path}===` : '===FILE: src/pages/';

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: fixUserMsg },
    { role: 'assistant', content: prefill },
  ];
}

/* ═══════════════════════════════════════════════════════
   REVIEW AGENT — Lightweight syntax review pass.
   Sends generated page files to the coder model for a
   focused JSX/syntax check before the Vite build.
   ═══════════════════════════════════════════════════════ */
function buildReviewMessages(files) {
  const pageFiles = files.filter((f) => f.path.startsWith('src/pages/'));
  if (!pageFiles.length) return null;

  const systemPrompt = `You are a React JSX syntax expert. Your ONLY job is to find and fix syntax errors.

COMMON ERRORS TO FIX:
1. HTML inside JSX prop strings — use template literals: attribution={\`&copy; <a href="...">OpenStreetMap</a>\`}
2. Unterminated strings — every opening quote must have a closing quote on the SAME line
3. Missing = in JSX props — position[35.9, -84.3] → position={[35.9, -84.3]}
4. Malformed style objects — {{padding20px}} → {{padding: "20px"}}
5. Unclosed JSX tags — every <Tag> must have </Tag> or be self-closing <Tag />
6. Orphaned colons — lines starting with : should be removed
7. Object key missing colon — { description "text" } → { description: "text" } (ALWAYS add : between key and value)
8. Prose text in JSX {} expression — <p>{'text'}</p> → <p>text</p> (plain text between tags, not in {})
9. Inline style where Tailwind class should be used — replace style={{ color: 'red' }} with className="text-red-600"

Return ALL files unchanged EXCEPT fixing syntax errors.
Use EXACT format:
===FILE: src/pages/Name.jsx===
[corrected code]
===END FILE===`;

  const userMsg = pageFiles
    .map((f) => `===FILE: ${f.path}===\n${f.content}\n===END FILE===`)
    .join('\n\n');

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Review and fix ONLY syntax errors in these files:\n\n${userMsg}` },
  ];
}

/* ═══════════════════════════════════════════════════════
   RUNTIME REVIEW AGENT
   Runs AFTER a successful Vite build. Asks the model to find
   bugs that compile cleanly but explode at runtime:
   wrong fetch paths, bad CSV index access, missing null
   guards, NaN coordinates, missing key props, etc.
   Returns RUNTIME_OK or a structured issue list.
   ═══════════════════════════════════════════════════════ */
function buildRuntimeReviewMessages(files, pages, opts = {}) {
  const pageFiles = files.filter(f => f.path.startsWith('src/pages/'));
  if (!pageFiles.length) return null;

  // Build per-page asset/column context so the model knows what to verify
  const assetContext = pages.map(pg => {
    const safe = pg.name.replace(/[^a-zA-Z0-9]/g, '');

    if (pg.type === 'home') {
      return `Page: ${safe}  type: HOME\n  Static landing page — NO CSV, NO fetch, NO charts, NO maps.\n  ⚠ If this page has fetch() or useEffect loading data → that is a BUG.`;
    }

    const lines = opts.experimentMode
      ? [`Page: ${safe}  type: ${pg.type}  CSV: embedded INLINE (no fetch, no /data/ path)`]
      : [`Page: ${safe}  type: ${pg.type}  fetchPath: /data/${safe}.csv`];
    if (pg.csvFile) {
      const { cols, roles, colMeta, mapCenter, mapZoom, papaSnippet } = analyzeCSV(pg.csvFile.content);
      lines.push(`  Confirmed lat column : "${roles.lat || 'NONE'}"  (must use row['${roles.lat}'])`);
      lines.push(`  Confirmed lng column : "${roles.lng || 'NONE'}"  (must use row['${roles.lng}'])`);
      if (roles.label) lines.push(`  label column: "${roles.label}"`);
      if (roles.date)  lines.push(`  date  column: "${roles.date}"`);
      lines.push(`  All columns: ${cols.join(', ')}`);
      if (pg.type === 'geovisualization') {
        lines.push(`  Correct map center: [${mapCenter[0]}, ${mapCenter[1]}]  zoom: ${mapZoom}`);
      }
      lines.push(`  CORRECT parse snippet:`);
      lines.push(papaSnippet.split('\n').map(l => '    ' + l).join('\n'));
    } else {
      lines.push(`  No CSV provided for this page.`);
    }
    return lines.join('\n');
  }).join('\n\n');

  const systemPrompt = [
    'You are a React runtime bug detector. The code already PASSED Vite build — no syntax errors exist.',
    'Your ONLY job: find bugs that cause RUNTIME errors visible in the browser console.',
    '',
    '════ KNOWN STATIC ASSETS (verify fetch paths match EXACTLY) ════',
    assetContext,
    '',
    '════ RUNTIME BUGS TO DETECT ════',
    opts.experimentMode
      ? '1. ANY fetch() call — this experiment uses ONLY inline CSV; flag any fetch() as a bug.'
      : '1. Wrong fetch path — fetch("/data/X.csv") where X does not match the expected filename above',
    '2. Wrong CSV column index — c[3] when that column is at a different index',
    '3. NaN coordinates — parseFloat on a string column, or swapped lat/lng indices',
    '4. Missing null/empty guard — .map() or .filter() on state initialised as null/undefined (use [])',
    '5. Leaflet "Map container not found" — MapContainer missing style={{ height }} or rendered conditionally before data loads',
    '6. Missing React key prop — .map() returning JSX elements without a unique key={...}',
    '7. fetch() inside render (not inside useEffect) — causes infinite re-fetch loop',
    '8. CSV parse off-by-one — iterating header row as data row',
    '9. HOME page doing data work — a home-type page should NOT have fetch(), useEffect for data, or CSV parsing (it is static)',
    '10. WHITE SCREEN — component returns null, undefined, or empty fragment <></> unconditionally',
    '11. WHITE SCREEN — data.map() called but data state was initialised as null/undefined instead of []',
    '12. INVISIBLE MARKERS — Leaflet Marker used but no icon fix: missing delete L.Icon.Default.prototype._getIconUrl + L.Icon.Default.mergeOptions({iconUrl,shadowUrl})',
    '13. NO MARKERS — MapContainer present but no data.map() rendering any map component',
    '14. NaN POSITION — position or center prop contains NaN because lat/lng were never parsed with parseFloat()',
    '15. WRONG PROP NAME — <Marker> uses position={[lat,lng]}, but <CircleMarker> uses center={[lat,lng]}. NEVER swap these. center={} on CircleMarker is CORRECT. position={} on CircleMarker is WRONG and will crash with "undefined is not an object (evaluating o.lat)"',
    '',
    '════ OUTPUT FORMAT ════',
    'If NO runtime bugs found, output EXACTLY one line: RUNTIME_OK',
    '',
    'If bugs found, output:',
    '===RUNTIME_ISSUES===',
    'FILE: src/pages/X.jsx',
    'ISSUE: what will fail and why',
    'FIX: minimal code change to apply',
    '---',
    '===END_RUNTIME_ISSUES===',
    '',
    'Do NOT report syntax issues (already fixed). Do NOT output file contents.',
  ].join('\n');

  const userMsg = pageFiles
    .map(f => `===FILE: ${f.path}===\n${f.content}\n===END FILE===`)
    .join('\n\n');

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Detect runtime bugs in these files:\n\n${userMsg}\n\nOutput RUNTIME_OK or ===RUNTIME_ISSUES===` },
  ];
}

/**
 * detectWhiteScreen — fast static analysis for definitive white-screen patterns.
 * Runs synchronously (zero model calls) right after generation.
 * Returns Array<{ file, issues: string[] }> — empty array means clean.
 */
function detectWhiteScreen(files, pages) {
  const pageFiles = files.filter(f => f.path.startsWith('src/pages/'));
  const findings = [];

  for (const f of pageFiles) {
    const code = f.content;
    const issues = [];
    const pageSafe = f.path.replace('src/pages/', '').replace('.jsx', '');
    const page = pages.find(pg => pg.name.replace(/[^a-zA-Z0-9]/g, '') === pageSafe);

    // 1. Missing export default → component never mounts
    if (!/export\s+default\s+/.test(code)) {
      issues.push('Missing export default — component will not mount (white screen)');
    }

    // 2. useState(null) + .map() → "null is not a function" crash
    if (/useState\(\s*(null|undefined)\s*\)/.test(code) && /\.map\(/.test(code)) {
      issues.push('useState(null) with .map() — crashes at runtime. Must be useState([])');
    }

    // 3. Leaflet Marker without icon fix → ALL markers invisible
    const hasMap     = /MapContainer/.test(code);
    const hasMarker  = /\bMarker\b/.test(code);
    const hasIconFix = /delete\s+L\.Icon\.Default\.prototype\._getIconUrl/.test(code);
    if (hasMap && hasMarker && !hasIconFix) {
      issues.push('Leaflet Marker used without icon fix — ALL markers will be invisible. Needs: delete L.Icon.Default.prototype._getIconUrl + L.Icon.Default.mergeOptions({iconUrl, shadowUrl})');
    }

    // 4. MapContainer without leaflet.css → broken tiles / invisible map
    if (hasMap && !/import ['"]leaflet\/dist\/leaflet\.css/.test(code)) {
      issues.push('Missing import "leaflet/dist/leaflet.css" — map tiles will not render');
    }

    // 5. Has MapContainer + Marker import but no data.map() → no markers plotted
    if (hasMap && hasMarker && !/data\.map\s*\(/.test(code)) {
      issues.push('Map has Marker component but no data.map() — CSV data is never plotted as markers');
    }

    // 6. fetch() with no useEffect → infinite re-render loop → crash
    if (/\bfetch\s*\(/.test(code) && !/useEffect/.test(code)) {
      issues.push('fetch() called outside useEffect — causes infinite re-render loop and crash');
    }

    // 7. Geovis: lat/lng column never referenced → position=[undefined,undefined]
    if (page?.type === 'geovisualization' && page?.csvFile) {
      const { roles } = analyzeCSV(page.csvFile.content);
      if (roles.lat && !new RegExp(`['"\`]${roles.lat}['"\`]|[^a-z]lat[^a-z]`).test(code)) {
        issues.push(`Lat column "${roles.lat}" never referenced — position will be [undefined, undefined]. Must use row['${roles.lat}']`);
      }
      if (roles.lng && !new RegExp(`['"\`]${roles.lng}['"\`]|[^a-z]lng[^a-z]`).test(code)) {
        issues.push(`Lng column "${roles.lng}" never referenced — position will be [undefined, undefined]. Must use row['${roles.lng}']`);
      }
    }

    // 8. Unconditional empty return
    if (/return\s*\(\s*<>\s*<\/?>\s*\)|return\s+null\s*;/.test(code)) {
      issues.push('Component returns null or empty fragment — white screen');
    }

    // 9. Lowercase component name — React treats <lowercase /> as a DOM element, not a component
    const exportMatch = code.match(/export\s+default\s+function\s+([a-z][a-zA-Z0-9]*)\s*\(/);
    if (exportMatch) {
      const lcName = exportMatch[1];
      issues.push(`Component "${lcName}" starts with lowercase — React renders it as an HTML element, not a component. Must be PascalCase: "${lcName.charAt(0).toUpperCase() + lcName.slice(1)}"`);
    }

    if (issues.length) findings.push({ file: f.path, issues });
  }

  return findings;
}

/**
 * autoFixWhiteScreen — applies deterministic no-model-needed fixes:
 *   • useState(null) → useState([])
 *   • Injects the Leaflet invisible-marker icon patch after the last import line
 *   • Adds missing import "leaflet/dist/leaflet.css"
 * Returns { files: File[], fixed: {file, description}[] }
 */
function autoFixWhiteScreen(files) {
  const fixed = [];
  const ICON_FIX = [
    ``,
    `// ⚠ REQUIRED: Leaflet default icon paths break in Vite/webpack — patch manually`,
    `import L from 'leaflet';`,
    `delete L.Icon.Default.prototype._getIconUrl;`,
    `L.Icon.Default.mergeOptions({`,
    `  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',`,
    `  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',`,
    `  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',`,
    `  iconSize: [25, 41], iconAnchor: [12, 41],`,
    `});`,
  ].join('\n');

  const out = files.map(f => {
    if (!f.path.startsWith('src/pages/')) return f;
    let code = f.content;
    let changed = false;

    // Fix: useState(null/undefined) → useState([])
    if (/useState\(\s*(null|undefined)\s*\)/.test(code) && /\.map\(/.test(code)) {
      code = code.replace(/useState\(\s*null\s*\)/g, 'useState([])').replace(/useState\(\s*undefined\s*\)/g, 'useState([])');
      changed = true;
      fixed.push({ file: f.path, description: 'Fixed useState(null) → useState([])' });
    }

    // Fix: inject Leaflet icon patch if Marker is used but fix is absent
    const hasMap     = /MapContainer/.test(code);
    const hasMarker  = /\bMarker\b/.test(code);
    const hasIconFix = /delete\s+L\.Icon\.Default\.prototype\._getIconUrl/.test(code);
    if (hasMap && hasMarker && !hasIconFix) {
      // Find the position right after the last import line
      const importMatches = [...code.matchAll(/^import .+/gm)];
      const lastImport = importMatches.at(-1);
      if (lastImport) {
        // Also remove any existing bare `import L from 'leaflet'` to avoid duplicate
        code = code.replace(/^import L from ['"](leaflet)['"];?\n?/gm, '');
        const insertAt = (lastImport.index + lastImport[0].length);
        code = code.slice(0, insertAt) + ICON_FIX + code.slice(insertAt);
        changed = true;
        fixed.push({ file: f.path, description: 'Auto-injected Leaflet invisible-marker icon fix' });
      }
    }

    // Fix: missing leaflet.css import
    if (hasMap && !/import ['"]leaflet\/dist\/leaflet\.css/.test(code)) {
      // Insert after react-leaflet import
      code = code.replace(
        /(import [^;]+ from ['"](react-leaflet|leaflet)['"];?\n)/,
        `$1import 'leaflet/dist/leaflet.css';\n`,
      );
      changed = true;
      fixed.push({ file: f.path, description: 'Added missing import leaflet/dist/leaflet.css' });
    }

    // Fix: lowercase component name — React ignores lowercase JSX tags as HTML elements
    const lcMatch = code.match(/export\s+default\s+function\s+([a-z][a-zA-Z0-9]*)\s*\(/);
    if (lcMatch) {
      const oldName = lcMatch[1];
      const newName = oldName.charAt(0).toUpperCase() + oldName.slice(1);
      code = code.replace(
        new RegExp(`(export\\s+default\\s+function\\s+)${oldName}(\\s*\\()`, 'g'),
        `$1${newName}$2`,
      );
      changed = true;
      fixed.push({ file: f.path, description: `Capitalised component name: ${oldName} → ${newName}` });
    }

    // Fix: CircleMarker position= → center=
    // The LLM runtime checker sometimes wrongly flags correct center= and tells the
    // fix model to use position=. CircleMarker MUST use center={[lat,lng]}, not position=.
    // This check runs AFTER the model fix so it can undo any model-introduced regressions.
    if (/CircleMarker/.test(code)) {
      const before = code;
      code = code.replace(/<CircleMarker(\s[^>]*?\s)position=/g, '<CircleMarker$1center=');
      // also handle no-space edge case: <CircleMarker position=
      code = code.replace(/<CircleMarker\s+position=/g, '<CircleMarker center=');
      if (code !== before) {
        changed = true;
        fixed.push({ file: f.path, description: 'Fixed CircleMarker position= → center= (CircleMarker requires center prop, not position)' });
      }
    }

    return changed ? { ...f, content: code } : f;
  });

  return { files: out, fixed };
}

/**
 * parseRuntimeIssues
 * Extracts the structured issue text from a RUNTIME_ISSUES block.
 * Returns null if the model reported RUNTIME_OK.
 */
function parseRuntimeIssues(reviewOutput) {
  if (!reviewOutput || reviewOutput.includes('RUNTIME_OK')) return null;
  const match = reviewOutput.match(/===RUNTIME_ISSUES===([\/\s\S]*?)===END_RUNTIME_ISSUES===/);
  const body = match ? match[1].trim() : reviewOutput.trim();
  // Must contain at least one FILE: line to be treated as real issues
  if (!body.includes('FILE:') && !body.includes('ISSUE:')) return null;
  return body;
}

module.exports = {
  buildPrompt,
  buildThinkPrompt,
  buildThinkFixPrompt,
  buildSingleFileFixMessages,
  buildRuntimeFixMessages,
  parseErrorsByFile,
  think,
  extractPlan,
  generate,
  chat,
  unloadModel,
  extractFiles,
  scaffoldApp,
  deploy,
  buildFixPrompt,
  buildChatMessages,
  buildFixChatMessages,
  buildReviewMessages,
  buildRuntimeReviewMessages,
  parseRuntimeIssues,
  detectWhiteScreen,
  autoFixWhiteScreen,
  analyzeCSV,
  inferColumnRoles,
  sanitizeFiles,
  validateFiles,
  describeSvgLayout,
  mapSvgRegions,
  PROJECTS_DIR,
  THINKER_MODEL,
};
