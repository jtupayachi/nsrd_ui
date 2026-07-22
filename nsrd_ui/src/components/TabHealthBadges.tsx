import React, { useEffect, useMemo, useRef, useState } from 'react';

/* ──────────────────────────────────────────────────────────────────
   TabHealthBadges
   ──────────────────────────────────────────────────────────────────
   After a successful deploy, mount one hidden iframe per generated
   route and verify that the page actually renders something inside
   #root. Surfaces a green ✓ / red ✗ / amber ⏳ badge per tab so the
   user can spot blank-screen pages without clicking through.
   ────────────────────────────────────────────────────────────────── */

export interface TabHealthPage {
  id: number;
  name: string;
  type: 'home' | 'base' | 'geovisualization';
}

type Status = 'pending' | 'ok' | 'empty' | 'error' | 'timeout';

interface PageState {
  status: Status;
  detail?: string;
}

interface Props {
  previewUrl: string;          // e.g. "/preview/<projectId>/"
  pages: TabHealthPage[];
  /** force a re-check (e.g. after a rebuild). Increment to retrigger. */
  refreshKey?: number;
}

/** Mirror of the route logic in pipeline.js → scaffoldApp(). */
function routeForPage(p: TabHealthPage): string {
  if (p.type === 'home') return '';
  return p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

const BADGE: Record<Status, { icon: string; color: string; bg: string; label: string }> = {
  pending: { icon: '⏳', color: '#92400e', bg: '#fef3c7', label: 'checking…' },
  ok:      { icon: '✅', color: '#166534', bg: '#dcfce7', label: 'rendered' },
  empty:   { icon: '⚪', color: '#92400e', bg: '#fef3c7', label: 'blank' },
  error:   { icon: '❌', color: '#991b1b', bg: '#fee2e2', label: 'errored' },
  timeout: { icon: '⌛', color: '#92400e', bg: '#fef3c7', label: 'timed out' },
};

const CHECK_DELAY_MS = 800;     // wait for React to mount/render
const CHECK_TIMEOUT_MS = 8000;  // hard cap per page

export default function TabHealthBadges({ previewUrl, pages, refreshKey = 0 }: Props) {
  const [results, setResults] = useState<Record<number, PageState>>({});
  const iframeRefs = useRef<Record<number, HTMLIFrameElement | null>>({});

  // Build target URLs once per (previewUrl, pages) change.
  const targets = useMemo(
    () => pages.map(p => ({
      page: p,
      url: previewUrl + routeForPage(p),
    })),
    [previewUrl, pages]
  );

  useEffect(() => {
    if (!previewUrl) return;
    // Reset state when inputs change
    const initial: Record<number, PageState> = {};
    pages.forEach(p => { initial[p.id] = { status: 'pending' }; });
    setResults(initial);

    const timeouts: Record<number, ReturnType<typeof setTimeout>> = {};

    const finish = (pageId: number, state: PageState) => {
      setResults(prev =>
        // Only the first definitive result wins
        prev[pageId]?.status !== 'pending' ? prev : { ...prev, [pageId]: state }
      );
      if (timeouts[pageId]) {
        clearTimeout(timeouts[pageId]);
        delete timeouts[pageId];
      }
    };

    // Hard timeout per page in case onload never fires
    pages.forEach(p => {
      timeouts[p.id] = setTimeout(() => {
        finish(p.id, { status: 'timeout', detail: `No response within ${CHECK_TIMEOUT_MS}ms` });
      }, CHECK_TIMEOUT_MS);
    });

    return () => {
      Object.values(timeouts).forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl, refreshKey, pages.length]);

  const handleLoad = (page: TabHealthPage) => {
    const iframe = iframeRefs.current[page.id];
    if (!iframe) return;

    // Allow React to mount before measuring
    setTimeout(() => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) {
          setResults(prev => ({ ...prev, [page.id]: { status: 'error', detail: 'No document (cross-origin?)' } }));
          return;
        }
        const root = doc.getElementById('root');
        if (!root) {
          setResults(prev => ({ ...prev, [page.id]: { status: 'error', detail: '#root missing' } }));
          return;
        }
        const childCount = root.children.length;
        const text = (root.textContent || '').trim();
        if (childCount === 0 || text.length === 0) {
          setResults(prev => ({ ...prev, [page.id]: { status: 'empty', detail: 'No content under #root' } }));
          return;
        }
        // Look for a <pre> with the Vite/React error overlay text — heuristic
        const errorOverlay = doc.querySelector('vite-error-overlay, .error-overlay, [data-error]');
        if (errorOverlay) {
          setResults(prev => ({ ...prev, [page.id]: { status: 'error', detail: 'Error overlay detected' } }));
          return;
        }
        setResults(prev => ({ ...prev, [page.id]: { status: 'ok', detail: `${childCount} child(ren), ${text.length} chars` } }));
      } catch (e: any) {
        setResults(prev => ({ ...prev, [page.id]: { status: 'error', detail: String(e?.message || e) } }));
      }
    }, CHECK_DELAY_MS);
  };

  if (!previewUrl || pages.length === 0) return null;

  const summary = pages.reduce(
    (acc, p) => {
      const s = results[p.id]?.status || 'pending';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    },
    {} as Record<Status, number>
  );

  return (
    <div className="tab-health">
      <div className="tab-health-header">
        <strong>🩺 Per-page health</strong>
        <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7280' }}>
          {summary.ok || 0}/{pages.length} rendering
          {(summary.error || summary.empty || summary.timeout) ?
            ` · ${(summary.error || 0) + (summary.empty || 0) + (summary.timeout || 0)} issue(s)` : ''}
        </span>
      </div>
      <div className="tab-health-grid">
        {targets.map(({ page, url }) => {
          const state = results[page.id] || { status: 'pending' as Status };
          const b = BADGE[state.status];
          return (
            <a
              key={page.id}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="tab-health-pill"
              title={state.detail || b.label}
              style={{ background: b.bg, color: b.color }}
            >
              <span className="tab-health-icon">{b.icon}</span>
              <span className="tab-health-name">{page.name}</span>
              <span className="tab-health-status">{b.label}</span>
            </a>
          );
        })}
      </div>
      {/* Hidden iframes do the actual checks. We keep them mounted so dev
          tools can inspect them; visually they're 1×1 and offscreen. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          opacity: 0,
          pointerEvents: 'none',
        }}
      >
        {targets.map(({ page, url }) => (
          <iframe
            key={`${page.id}-${refreshKey}`}
            ref={el => { iframeRefs.current[page.id] = el; }}
            src={url}
            title={`health-check-${page.name}`}
            onLoad={() => handleLoad(page)}
            onError={() =>
              setResults(prev => ({ ...prev, [page.id]: { status: 'error', detail: 'iframe onError' } }))
            }
          />
        ))}
      </div>
    </div>
  );
}
