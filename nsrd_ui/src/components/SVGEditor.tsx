import React, { useRef, useState, useCallback } from 'react';
import './SVGEditor.css';

interface Props {
  onSave: (file: { content: string; name: string }) => void;
}

type Tool = 'select' | 'rect' | 'circle' | 'text' | 'pen';

interface Shape {
  id: string;
  type: 'rect' | 'circle' | 'text' | 'path';
  x: number;
  y: number;
  w?: number;
  h?: number;
  r?: number;
  text?: string;
  d?: string;
  fill: string;
  stroke: string;
  sw: number;
}

const uid = () => Math.random().toString(36).slice(2, 8);

const SVGEditor: React.FC<Props> = ({ onSave }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [tool, setTool] = useState<Tool>('rect');
  const [drawing, setDrawing] = useState(false);
  const [temp, setTemp] = useState<Shape | null>(null);
  const [start, setStart] = useState({ x: 0, y: 0 });
  const [fill, setFill] = useState('#e3f2fd');
  const [stroke, setStroke] = useState('#1976d2');
  const [penPath, setPenPath] = useState('');

  const pos = useCallback(
    (e: React.MouseEvent) => {
      const r = canvasRef.current?.getBoundingClientRect();
      return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : { x: 0, y: 0 };
    },
    [],
  );

  /* ── mouse handlers ─────────────────────────────── */
  const onDown = (e: React.MouseEvent) => {
    if (tool === 'select') return;
    const p = pos(e);
    setStart(p);
    setDrawing(true);

    if (tool === 'text') {
      const txt = prompt('Text:');
      if (txt) setShapes((s) => [...s, { id: uid(), type: 'text', x: p.x, y: p.y, text: txt, fill: stroke, stroke: 'none', sw: 0 }]);
      setDrawing(false);
    } else if (tool === 'pen') {
      setPenPath(`M ${p.x} ${p.y}`);
    }
  };

  const onMove = (e: React.MouseEvent) => {
    if (!drawing || tool === 'select' || tool === 'text') return;
    const p = pos(e);

    if (tool === 'pen') {
      setPenPath((d) => `${d} L ${p.x} ${p.y}`);
    } else if (tool === 'rect') {
      setTemp({ id: '_', type: 'rect', x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y), fill, stroke, sw: 2 });
    } else if (tool === 'circle') {
      const r = Math.hypot(p.x - start.x, p.y - start.y);
      setTemp({ id: '_', type: 'circle', x: start.x, y: start.y, r, fill, stroke, sw: 2 });
    }
  };

  const onUp = () => {
    if (!drawing) return;
    if (tool === 'pen' && penPath) {
      setShapes((s) => [...s, { id: uid(), type: 'path', x: 0, y: 0, d: penPath, fill: 'none', stroke, sw: 3 }]);
      setPenPath('');
    } else if (temp) {
      setShapes((s) => [...s, { ...temp, id: uid() }]);
      setTemp(null);
    }
    setDrawing(false);
  };

  /* ── export SVG ─────────────────────────────────── */
  const exportSVG = () => {
    const els = shapes
      .map((s) => {
        if (s.type === 'rect') return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="${s.sw}"/>`;
        if (s.type === 'circle') return `<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="${s.sw}"/>`;
        if (s.type === 'text') return `<text x="${s.x}" y="${s.y}" fill="${s.fill}" font-size="16" font-family="Arial">${s.text}</text>`;
        if (s.type === 'path') return `<path d="${s.d}" fill="none" stroke="${s.stroke}" stroke-width="${s.sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
        return '';
      })
      .join('\n  ');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">\n  <rect width="100%" height="100%" fill="#fff"/>\n  ${els}\n</svg>`;
    onSave({ content: svg, name: `mockup_${Date.now()}.svg` });
  };

  /* ── render shape as HTML overlay ───────────────── */
  const renderShape = (s: Shape) => {
    const base: React.CSSProperties = { position: 'absolute', pointerEvents: 'none' };
    if (s.type === 'rect')
      return <div key={s.id} style={{ ...base, left: s.x, top: s.y, width: s.w, height: s.h, background: s.fill, border: `${s.sw}px solid ${s.stroke}` }} />;
    if (s.type === 'circle')
      return <div key={s.id} style={{ ...base, left: s.x - (s.r || 0), top: s.y - (s.r || 0), width: (s.r || 0) * 2, height: (s.r || 0) * 2, background: s.fill, border: `${s.sw}px solid ${s.stroke}`, borderRadius: '50%' }} />;
    if (s.type === 'text')
      return <div key={s.id} style={{ ...base, left: s.x, top: s.y, color: s.fill, fontSize: 16, fontFamily: 'Arial' }}>{s.text}</div>;
    if (s.type === 'path')
      return <svg key={s.id} style={{ ...base, left: 0, top: 0, width: '100%', height: '100%' }}><path d={s.d} fill="none" stroke={s.stroke} strokeWidth={s.sw} strokeLinecap="round" strokeLinejoin="round" /></svg>;
    return null;
  };

  return (
    <div className="sve">
      {/* toolbar */}
      <div className="sve-bar">
        {([['select', '↖'], ['rect', '▭'], ['circle', '○'], ['text', 'T'], ['pen', '✏']] as [Tool, string][]).map(
          ([t, icon]) => (
            <button key={t} className={`sve-tool${tool === t ? ' on' : ''}`} onClick={() => setTool(t)} title={t}>
              {icon}
            </button>
          ),
        )}
        <span className="sve-sep" />
        <label className="sve-color" title="Fill">
          <input type="color" value={fill} onChange={(e) => setFill(e.target.value)} />
        </label>
        <label className="sve-color" title="Stroke">
          <input type="color" value={stroke} onChange={(e) => setStroke(e.target.value)} />
        </label>
        <span className="sve-sep" />
        <button className="sve-act" onClick={() => setShapes((s) => s.slice(0, -1))} disabled={!shapes.length}>↩ Undo</button>
        <button className="sve-act" onClick={() => { if (window.confirm('Clear all?')) setShapes([]); }}>🗑 Clear</button>
        <button className="sve-act sve-save" onClick={exportSVG} disabled={!shapes.length}>💾 Use Mockup</button>
      </div>

      {/* canvas */}
      <div
        ref={canvasRef}
        className="sve-canvas"
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
      >
        {shapes.map(renderShape)}
        {temp && renderShape(temp)}
        {drawing && tool === 'pen' && penPath && (
          <svg style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <path d={penPath} fill="none" stroke={stroke} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {!shapes.length && !drawing && (
          <span className="sve-hint">Select a tool and start drawing</span>
        )}
      </div>
    </div>
  );
};

export default SVGEditor;
