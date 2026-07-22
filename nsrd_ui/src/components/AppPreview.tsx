import React, { useState, useEffect, useRef } from 'react';
import './AppPreview.css';

interface Props {
  code: string;
  isLoading: boolean;
}

/**
 * Renders AI-generated React code inside a sandboxed iframe.
 * Wraps the code in a minimal HTML page with React + Babel standalone
 * so it can execute directly in the browser.
 */
const AppPreview: React.FC<Props> = ({ code, isLoading }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [tab, setTab] = useState<'preview' | 'code'>('preview');

  /* Extract only the code blocks from markdown-wrapped responses */
  const extractCode = (raw: string): string => {
    // Try to find ```jsx or ```tsx or ```javascript blocks
    const fenced = raw.match(/```(?:jsx?|tsx?|javascript|react)?\s*\n([\s\S]*?)```/g);
    if (fenced) {
      return fenced
        .map((block) => block.replace(/```(?:jsx?|tsx?|javascript|react)?\s*\n/, '').replace(/```$/, ''))
        .join('\n\n');
    }
    return raw; // return as-is if no fences
  };

  /* Build a self-contained HTML page that runs the React code */
  const buildHtml = (src: string): string => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
  </style>
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    try {
      ${src}
      
      // Try to find and render the default export or App component
      const _root = ReactDOM.createRoot(document.getElementById('root'));
      if (typeof App !== 'undefined') {
        _root.render(React.createElement(App));
      } else {
        _root.render(React.createElement('div', {style:{padding:'2rem',color:'#86868b'}}, 'No App component found in generated code.'));
      }
    } catch(e) {
      document.getElementById('root').innerHTML =
        '<pre style="color:#ff3b30;padding:1rem;white-space:pre-wrap">' +
        'Runtime error:\\n' + e.message + '</pre>';
    }
  <\/script>
</body>
</html>`;

  /* Update iframe when code changes */
  useEffect(() => {
    if (!code || !iframeRef.current) return;
    const cleaned = extractCode(code);
    const html = buildHtml(cleaned);
    const blob = new Blob([html], { type: 'text/html' });
    iframeRef.current.src = URL.createObjectURL(blob);
  }, [code]);

  if (isLoading) {
    return (
      <div className="ap-loading">
        <div className="ap-spinner" />
        <p>Generating your React app…</p>
      </div>
    );
  }

  if (!code) return null;

  return (
    <div className="ap">
      {/* tabs */}
      <div className="ap-tabs">
        <button className={tab === 'preview' ? 'on' : ''} onClick={() => setTab('preview')}>
          ▶ Preview
        </button>
        <button className={tab === 'code' ? 'on' : ''} onClick={() => setTab('code')}>
          {'</>'} Generation
        </button>
      </div>

      {tab === 'preview' ? (
        <iframe
          ref={iframeRef}
          className="ap-frame"
          title="Generated App"
          sandbox="allow-scripts allow-same-origin"
        />
      ) : (
        <pre className="ap-code">{code}</pre>
      )}
    </div>
  );
};

export default AppPreview;
