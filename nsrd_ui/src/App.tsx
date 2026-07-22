import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import FileUpload from './components/FileUpload';
import SVGEditor from './components/SVGEditor';
import ModelSelector from './components/ModelSelector';
import TabHealthBadges from './components/TabHealthBadges';

/* ── Types ──────────────────────────────────────────── */
interface Page {
  id: number;
  name: string;
  type: 'home' | 'base' | 'geovisualization';
  requirements: string;
  svgFile: { content: string; name: string } | null;
  csvFile: { content: string; name: string } | null;
}

/* ── Config ─────────────────────────────────────────── */
const TYPE_META: Record<Page['type'], { icon: string; label: string }> = {
  home: { icon: '🏠', label: 'Home' },
  base: { icon: '📋', label: 'Base' },
  geovisualization: { icon: '🗺️', label: 'Geo / Map' },
};

/* ── Helpers ────────────────────────────────────────── */
let nextId = 2;

/* ── Component ──────────────────────────────────────── */
export default function App() {
  /* state */
  const [pages, setPages] = useState<Page[]>([
    { id: 1, name: 'Home', type: 'home', requirements: '', svgFile: null, csvFile: null },
  ]);
  const [activeId, setActiveId] = useState(1);
  const [coderModel, setCoderModel] = useState('');
  const [thinkerModel, setThinkerModel] = useState('');
  const [provider, setProvider] = useState<'ollama' | 'anthropic'>('ollama');
  const [generating, setGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [pipelineSteps, setPipelineSteps] = useState<any[]>([]);
  const [buildLogs, setBuildLogs] = useState<{status: string; message: string; stdout: string; stderr: string; intermediate?: boolean}[]>([]);
  const [pipelineSucceeded, setPipelineSucceeded] = useState(false);
  const [reviewLogs, setReviewLogs] = useState<{status: 'clean' | 'issues' | 'fixed'; issues: string; fixedCode: string}[]>([]);
  const [previewUrl, setPreviewUrl] = useState('');
  const [svgMode, setSvgMode] = useState<'upload' | 'draw'>('upload');
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [projectId, setProjectId] = useState('');
  const [generatedFiles, setGeneratedFiles] = useState<{path: string; content: string}[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [clarificationAnswer, setClarificationAnswer] = useState('');
  const [pendingClarification, setPendingClarification] = useState<any>(null);

  /* active page */
  const active = pages.find((p) => p.id === activeId) ?? pages[0];

  /* reset svg mode on page switch */
  useEffect(() => { setSvgMode('upload'); }, [activeId]);

  /* CRUD */
  const addPage = () => {
    const id = nextId++;
    setPages((ps) => [
      ...ps,
      { id, name: `Page ${id}`, type: 'base', requirements: '', svgFile: null, csvFile: null },
    ]);
    setActiveId(id);
  };

  const removePage = (id: number) => {
    if (pages.length <= 1) return;
    setPages((ps) => {
      const next = ps.filter((p) => p.id !== id);
      if (activeId === id) setActiveId(next[0].id);
      return next;
    });
  };

  const patch = useCallback(
    (id: number, data: Partial<Page>) =>
      setPages((ps) => ps.map((p) => (p.id === id ? { ...p, ...data } : p))),
    [],
  );

  /* ── pipeline: generate → extract → deploy → fix ── */
  const handlePipeline = async (targetPageId?: number) => {
    if (!coderModel) return;
    setGenerating(true);
    setGeneratedCode('');
    setPipelineSteps([]);
    setBuildLogs([]);
    setReviewLogs([]);
    setPreviewUrl('');
    setPipelineSucceeded(false);

    const controller = new AbortController();
    setAbortController(controller);

    const pagesToGenerate = targetPageId
      ? pages.filter(p => p.id === targetPageId)
      : pages;

    // Helper: apply one SSE event to React state.
    let code = '';
    const applyEvent = (evt: any) => {
      if (evt.token) { code += evt.token; setGeneratedCode(code); return; }
      if (evt.previewUrl) setPreviewUrl(evt.previewUrl);
      if (evt.projectId) setProjectId(evt.projectId);
      if (evt.files) {
        setGeneratedFiles(evt.files);
        const first = evt.files.find((f: any) => f.path.startsWith('src/pages/'));
        if (first) { setSelectedFile(first.path); setEditedContent(first.content); }
      }
      if (evt.step === 'build-output') {
        setBuildLogs(prev => [...prev, {
          status: evt.status, message: evt.message || '',
          stdout: evt.stdout || '', stderr: evt.stderr || '',
          intermediate: !!evt.intermediate,
        }]);
        return;
      }
      if (evt.step === 'complete') {
        setPipelineSucceeded(true);
      }
      if (evt.step === 'reviewing') {
        // Collect the streamed fix code tokens separately from the issues message
        if (evt.token) {
          setReviewLogs(prev => {
            if (!prev.length) return prev;
            const last = { ...prev[prev.length - 1], fixedCode: (prev[prev.length - 1].fixedCode || '') + evt.token };
            return [...prev.slice(0, -1), last];
          });
          return;
        }
        if (evt.status === 'running' && evt.message?.includes('⚠️')) {
          // Issues found — start a new review log entry with the issues text
          const issues = evt.message.replace(/^.*Runtime issues found.*\n?/, '').trim();
          setReviewLogs(prev => [...prev, { status: 'issues', issues, fixedCode: '' }]);
        } else if (evt.status === 'done' && evt.message?.includes('No runtime issues')) {
          setReviewLogs(prev => [...prev, { status: 'clean', issues: '', fixedCode: '' }]);
        } else if (evt.status === 'done' && evt.message?.includes('fixes applied')) {
          setReviewLogs(prev => {
            if (!prev.length) return [{ status: 'fixed', issues: '', fixedCode: '' }];
            return [...prev.slice(0, -1), { ...prev[prev.length - 1], status: 'fixed' }];
          });
        }
        // Also push to pipelineSteps for the step indicator row
        if (evt.status) {
          setPipelineSteps(prev => {
            const idx = prev.findIndex(s => s.step === 'reviewing');
            if (idx >= 0) { const copy = [...prev]; copy[idx] = evt; return copy; }
            return [...prev, evt];
          });
        }
        return;
      }
      if (evt.step === 'clarification') {
        if (evt.status === 'waiting') setPendingClarification(evt);
        else setPendingClarification(null);
      }
      if (evt.step && evt.status) {
        setPipelineSteps(prev => {
          const idx = prev.findIndex(s => s.step === evt.step);
          if (idx >= 0) { const copy = [...prev]; copy[idx] = evt; return copy; }
          return [...prev, evt];
        });
      }
    };

    try {
      // ── Step 1: POST to start the pipeline — returns { projectId } immediately ──
      const startRes = await fetch('/api/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pages: pagesToGenerate,
          model: coderModel,
          thinkerModel,
          existingProjectId: (targetPageId && projectId) ? projectId : undefined,
        }),
        signal: controller.signal,
      });
      if (!startRes.ok) throw new Error(`Server error ${startRes.status}`);
      const { projectId: newProjectId } = await startRes.json();
      setProjectId(newProjectId);

      // ── Step 2: Stream events from the dedicated SSE endpoint ──
      // The pipeline runs entirely in the background; events are buffered server-side
      // so reconnects always replay everything missed. No complex dual-path logic needed.
      let done = false;
      while (!done) {
        try {
          const streamRes = await fetch(`/api/pipeline/stream/${newProjectId}`, {
            signal: controller.signal,
          });
          if (!streamRes.ok) {
            if (streamRes.status === 404) {
              // Job gone — pipeline already completed before we connected.
              setPreviewUrl(`/preview/${newProjectId}/`);
              break;
            }
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          if (!streamRes.body) break;

          const reader = streamRes.body.getReader();
          const decoder = new TextDecoder();
          let sseBuffer = '';
          while (true) {
            const { done: chunkDone, value } = await reader.read();
            if (chunkDone) break;
            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop() ?? '';
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              try {
                const evt = JSON.parse(line.slice(6));
                applyEvent(evt);
                if (evt.step === 'complete' || evt.step === 'error') done = true;
              } catch { /* partial SSE line */ }
            }
            if (done) break;
          }
          if (done) break;

          // Stream closed without a terminal event — pipeline still running; reconnect.
          console.warn('[SSE] Stream ended without terminal event — reconnecting to', newProjectId);
          await new Promise(r => setTimeout(r, 1000));
        } catch (streamErr: any) {
          if (streamErr.name === 'AbortError') throw streamErr;
          console.warn('[SSE] Stream error — reconnecting:', streamErr.message);
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[Pipeline] Error:', err.message);
        setPipelineSteps(prev => [...prev, { step: 'error', status: 'error', message: err.message }]);
      }
    } finally {
      setGenerating(false);
      setAbortController(null);
    }
  };

  /* ── Cancel generation ── */
  const cancelGeneration = () => {
    if (abortController) {
      abortController.abort();
      setGenerating(false);
      setAbortController(null);
    }
  };

  /* ── Regenerate single page ── */
  const regeneratePage = (pageId: number) => {
    // eslint-disable-next-line no-restricted-globals
    if (window.confirm('Regenerate this page? The current version will be replaced.')) {
      handlePipeline(pageId);
    }
  };

  /* ── Select file for editing ── */
  const selectFileForEdit = (filePath: string) => {
    const file = generatedFiles.find(f => f.path === filePath);
    if (file) {
      setSelectedFile(filePath);
      setEditedContent(file.content);
    }
  };

  /* ── Save edited file + rebuild + auto-reload preview ── */
  const saveEditedFile = async () => {
    if (!selectedFile || !projectId || saving) return;
    setSaving(true);
    try {
      // 1. Write the updated source file to disk
      const res = await fetch('/api/project/update-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, filePath: selectedFile, content: editedContent }),
      });
      if (!res.ok) throw new Error('Failed to save file');

      // 2. Update local file list
      setGeneratedFiles(prev =>
        prev.map(f => f.path === selectedFile ? { ...f, content: editedContent } : f)
      );

      // 3. Re-run Vite build with updated files
      const rebuildRes = await fetch('/api/project/rebuild', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      if (!rebuildRes.ok) {
        const data = await rebuildRes.json();
        throw new Error(data.message || 'Rebuild failed');
      }

      // 4. Bust the iframe cache so the new build is loaded immediately
      const iframe = document.querySelector('.preview-frame') as HTMLIFrameElement;
      if (iframe) {
        const base = iframe.src.split('?')[0];
        iframe.src = `${base}?t=${Date.now()}`;
      }
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  /* ── Render ─────────────────────────────────────── */
  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-logo">
          <div className="header-logo-icon">🌐</div>
          <h1>NSRD GIS Builder</h1>
        </div>
        <div className="header-divider" />
        <span className="subtitle">Multi-page React App Generator · Oak Ridge National Laboratory</span>
      </header>

      <div className={`content-area${(generating || pipelineSteps.length > 0) ? ' has-pipeline' : ''}`}>
        <div className="left-panel">
      <div className="workspace">
        {/* ── Sidebar ─────────────────────────────── */}
        <aside className="sidebar">
          <h2>Pages</h2>
          <ul className="page-list">
            {pages.map((p) => (
              <li
                key={p.id}
                className={`page-item${p.id === activeId ? ' active' : ''}`}
                onClick={() => setActiveId(p.id)}
              >
                <span className="page-icon">{TYPE_META[p.type].icon}</span>
                <span className="page-label">{p.name}</span>
                <span className="page-badges">
                  {p.requirements && <span className="dot green" title="Has requirements" />}
                  {p.svgFile && <span className="dot blue" title="Has SVG" />}
                  {p.csvFile && <span className="dot orange" title="Has CSV" />}
                </span>
                {pages.length > 1 && (
                  <button
                    className="rm"
                    onClick={(e) => { e.stopPropagation(); removePage(p.id); }}
                    title="Remove page"
                  >✕</button>
                )}
                {!generating && previewUrl && (
                  <button
                    className="regen-btn"
                    onClick={(e) => { e.stopPropagation(); regeneratePage(p.id); }}
                    title="Regenerate this page only"
                  >🔄</button>
                )}
              </li>
            ))}
          </ul>
          <button className="add-btn" onClick={addPage}>+ Add Page</button>
        </aside>

        {/* ── Editor ──────────────────────────────── */}
        <main className="editor">
          {active && (
            <>
              {/* Name */}
              <div className="field">
                <label>Page Name</label>
                <input
                  value={active.name}
                  onChange={(e) => patch(active.id, { name: e.target.value })}
                />
              </div>

              {/* Type */}
              <div className="field">
                <label>Type</label>
                <div className="type-row">
                  {(Object.keys(TYPE_META) as Page['type'][]).map((t) => (
                    <button
                      key={t}
                      className={`type-btn${active.type === t ? ' on' : ''}`}
                      onClick={() => patch(active.id, { type: t })}
                    >
                      {TYPE_META[t].icon} {TYPE_META[t].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Requirements */}
              <div className="field">
                <label>Requirements</label>
                <textarea
                  rows={5}
                  placeholder="Describe what this page should do…"
                  value={active.requirements}
                  onChange={(e) => patch(active.id, { requirements: e.target.value })}
                />
              </div>

              {/* SVG (optional) — upload or draw */}
              <div className="field">
                <div className="field-header">
                  <label>SVG Mockup <span className="opt">optional</span></label>
                  {!active.svgFile && (
                    <div className="mode-toggle">
                      <button className={`mt${svgMode === 'upload' ? ' on' : ''}`} onClick={() => setSvgMode('upload')}>📁 Upload</button>
                      <button className={`mt${svgMode === 'draw' ? ' on' : ''}`} onClick={() => setSvgMode('draw')}>✏️ Draw</button>
                    </div>
                  )}
                </div>
                {active.svgFile ? (
                  <div className="chip">
                    🎨 {active.svgFile.name}
                    <button onClick={() => patch(active.id, { svgFile: null })}>✕</button>
                  </div>
                ) : svgMode === 'upload' ? (
                  <FileUpload accept=".svg" onFile={(f) => patch(active.id, { svgFile: f })} />
                ) : (
                  <SVGEditor onSave={(f) => patch(active.id, { svgFile: f })} />
                )}
              </div>

              {/* CSV (geo only, optional) */}
              {active.type === 'geovisualization' && (
                <div className="field">
                  <label>CSV Data <span className="opt">optional</span></label>
                  {active.csvFile ? (
                    <div className="chip">
                      📊 {active.csvFile.name}
                      <button onClick={() => patch(active.id, { csvFile: null })}>✕</button>
                    </div>
                  ) : (
                    <FileUpload accept=".csv" onFile={(f) => patch(active.id, { csvFile: f })} />
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ── Bottom bar: model + deploy ─────────────── */}
      <section className="bottom-bar">
        <ModelSelector
          provider={provider}
          coderModel={coderModel}
          thinkerModel={thinkerModel}
          onProviderChange={setProvider}
          onCoderModelSelect={setCoderModel}
          onThinkerModelSelect={setThinkerModel}
        />

        <div className="gen-row">
          <button
            className="gen-btn"
            disabled={generating || !coderModel}
            onClick={() => handlePipeline()}
          >
            {generating ? '⏳ Running Pipeline…' : '🚀 Generate & Deploy'}
          </button>
          {generating && (
            <button
              className="cancel-btn"
              onClick={cancelGeneration}
              title="Cancel generation"
            >
              ⛔ Cancel
            </button>
          )}
        </div>
      </section>
        </div>{/* /left-panel */}

      {/* ── Pipeline Progress ──────────────────────── */}
      {(generating || pipelineSteps.length > 0) && (
        <section className="pipeline-section">
          <h2>⚙ Pipeline Progress</h2>
          <div className="pipeline-steps">
            {/* ── Sticky clarification banner ── */}
            {pendingClarification && (
              <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fefce8', border: '2px solid #f59e0b', borderRadius: '10px', padding: '16px', marginBottom: '8px', boxShadow: '0 4px 16px rgba(245,158,11,0.2)' }}>
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#92400e', marginBottom: '10px' }}>❓ Clarification needed — pipeline is paused</div>
                <pre style={{ background: '#fff', border: '1px solid #fcd34d', borderRadius: '6px', padding: '10px', fontSize: '13px', whiteSpace: 'pre-wrap', margin: '0 0 12px 0', lineHeight: 1.5 }}>{pendingClarification.question}</pre>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={clarificationAnswer}
                    onChange={e => setClarificationAnswer(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && clarificationAnswer.trim()) {
                        fetch(`/api/pipeline/clarify/${projectId}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ answer: clarificationAnswer }),
                        });
                        setClarificationAnswer('');
                      }
                    }}
                    placeholder="Type your answer and press Enter…"
                    style={{ flex: 1, padding: '8px 12px', border: '2px solid #f59e0b', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                    autoFocus
                  />
                  <button
                    disabled={!clarificationAnswer.trim()}
                    onClick={() => {
                      if (!clarificationAnswer.trim()) return;
                      fetch(`/api/pipeline/clarify/${projectId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ answer: clarificationAnswer }),
                      });
                      setClarificationAnswer('');
                    }}
                    style={{ padding: '8px 20px', background: clarificationAnswer.trim() ? '#d97706' : '#d1d5db', color: 'white', border: 'none', borderRadius: '6px', cursor: clarificationAnswer.trim() ? 'pointer' : 'not-allowed', fontSize: '14px', fontWeight: 700 }}
                  >Send Reply</button>
                </div>
              </div>
            )}
            {pipelineSteps.map((s, i) => (
              <div key={i} className={`p-step ${s.status || ''} ${s.step?.startsWith('thinking') ? 'thinking' : ''}`}>
                <span className="p-icon">
                  {s.status === 'waiting' ? '❓'
                    : s.status === 'running' ? (s.step?.startsWith('thinking') ? '🧠' : '🔄')
                    : s.status === 'done' ? '✅' : '❌'}
                </span>
                <div className="p-body">
                  <span className="p-msg">{s.message}</span>
                  {s.files && (
                    <div className="p-files">
                      {s.files.map((f: string) => (
                        <span key={f} className="file-chip">{f}</span>
                      ))}
                    </div>
                  )}
                  {s.errors && <pre className="p-errors">{String(s.errors).slice(0, 500)}</pre>}
                </div>
              </div>
            ))}
          </div>

          {/* Streaming code output */}
          {generatedCode && (
            <details className="code-details" open={!previewUrl}>
              <summary>📝 LLM Output ({generatedCode.length} chars)</summary>
              <pre className="code-stream">{generatedCode}</pre>
            </details>
          )}

          {/* Build / Compilation output */}
          {buildLogs.length > 0 && (
            <details className="code-details" open>
              <summary>
                🔨 Build Output ({buildLogs.length} build{buildLogs.length !== 1 ? 's' : ''})
                {pipelineSucceeded && (
                  <span style={{ marginLeft: 8, color: '#16a34a', fontWeight: 600 }}>
                    — final: ✅ success
                  </span>
                )}
              </summary>
              {buildLogs.map((log, i) => {
                const cls =
                  log.status === 'done'
                    ? 'done'
                    : log.status === 'warning' || log.intermediate
                    ? 'warning'
                    : 'error';
                const icon =
                  log.status === 'done'
                    ? '✅'
                    : log.status === 'warning' || log.intermediate
                    ? '⚠️'
                    : '❌';
                return (
                  <div key={i} className={`build-log ${cls}`}>
                    <div className="build-log-header">
                      <span>{icon} {log.message}</span>
                    </div>
                    {log.stdout && (
                      <pre className="build-stdout">{log.stdout}</pre>
                    )}
                    {log.stderr && (
                      <pre className={`build-stderr ${cls === 'done' ? '' : cls}`}>{log.stderr}</pre>
                    )}
                  </div>
                );
              })}
            </details>
          )}

          {/* Runtime Review Output */}
          {reviewLogs.length > 0 && (
            <details className="code-details" open>
              <summary>🔍 Runtime Review ({reviewLogs.filter(r => r.status !== 'clean').length > 0 ? `${reviewLogs.filter(r => r.status !== 'clean').length} issue(s) found & fixed` : 'clean ✅'})</summary>
              {reviewLogs.map((log, i) => (
                <div key={i} className={`build-log ${log.status === 'clean' ? 'done' : 'error'}`}>
                  {log.status === 'clean' && (
                    <div className="build-log-header"><span>✅ No runtime issues detected — code looks correct</span></div>
                  )}
                  {log.status !== 'clean' && (
                    <>
                      <div className="build-log-header">
                        <span>{log.status === 'fixed' ? '🔧 Issues found and fixed' : '⚠️ Issues found (fixing…)'}</span>
                      </div>
                      {log.issues && (
                        <pre className="build-stderr error" style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>{log.issues}</pre>
                      )}
                      {log.fixedCode && (
                        <details style={{ marginTop: '6px' }}>
                          <summary style={{ fontSize: '12px', cursor: 'pointer', color: '#6b7280' }}>View fixed code</summary>
                          <pre className="build-stdout" style={{ fontSize: '11px', maxHeight: '300px', overflow: 'auto' }}>{log.fixedCode}</pre>
                        </details>
                      )}
                    </>
                  )}
                </div>
              ))}
            </details>
          )}

          {/* Deployed preview */}
          {previewUrl && (
            <div className="deployed-preview">
              <div className="preview-bar">
                <h3>🎉 Live Preview</h3>
                <a href={previewUrl} target="_blank" rel="noreferrer">Open in new tab ↗</a>
                {projectId && (
                  <a
                    href={`/api/project/download/${projectId}`}
                    download={`${projectId}.tar.gz`}
                    className="download-btn"
                    title="Download project source as tar.gz (untar → npm install → npm run dev)"
                  >
                    ⬇️ Download project
                  </a>
                )}
              </div>
              <TabHealthBadges
                previewUrl={previewUrl}
                pages={pages.map(p => ({ id: p.id, name: p.name, type: p.type }))}
                refreshKey={buildLogs.length}
              />
              <iframe src={previewUrl} title="Deployed App" className="preview-frame" />
            </div>
          )}

          {/* Code Editor for generated files */}
          {generatedFiles.length > 0 && (
            <div className="code-editor-section">
              <h3>📂 Generated Files</h3>
              <div className="editor-layout">
                <div className="file-tree">
                  {generatedFiles.map(file => (
                    <div
                      key={file.path}
                      className={`file-item ${selectedFile === file.path ? 'active' : ''}`}
                      onClick={() => selectFileForEdit(file.path)}
                    >
                      <span className="file-icon">📄</span>
                      {file.path}
                    </div>
                  ))}
                </div>
                <div className="editor-pane">
                  {selectedFile && (
                    <>
                      <div className="editor-header">
                        <span className="editor-title">{selectedFile}</span>
                        <button className="save-btn" onClick={saveEditedFile} disabled={saving}>
                          {saving ? '⏳ Rebuilding…' : '💾 Save & Rebuild'}
                        </button>
                      </div>
                      <textarea
                        className="code-editor"
                        value={editedContent || generatedFiles.find(f => f.path === selectedFile)?.content || ''}
                        onChange={(e) => setEditedContent(e.target.value)}
                        spellCheck={false}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      </div>{/* /content-area */}
      <footer className="footer">
        NSRD · Oak Ridge National Laboratory &nbsp;|&nbsp; {pages.length} Page{pages.length !== 1 ? 's' : ''} Configured
      </footer>
    </div>
  );
}
