import React, { useState, useEffect, useRef } from 'react';
import './ModelSelector.css';

interface Props {
  provider: 'ollama' | 'anthropic';
  coderModel: string;
  thinkerModel: string;
  onProviderChange: (p: 'ollama' | 'anthropic') => void;
  onCoderModelSelect: (m: string) => void;
  onThinkerModelSelect: (m: string) => void;
}

interface OllamaModel {
  id: string;
  name: string;
  size: string;
}

/* Keywords that indicate a code-specialized model */
const CODER_KEYWORDS = [
  '-coder', 'coder:', // Catch any model with -coder or coder:
  'qwen2.5-coder', 'qwen3-coder', 'qwen3-coder-next', 
  'deepseek-coder', 'deepseek-code',
  'codellama', 'code-llama',
  'starcoder', 'star-coder',
  'codestral', 'codegemma', 'code-gemma',
  'devstral', 'devstral-small',
  'wizardcoder', 'phind-codellama',
];

/* Keywords that indicate a reasoning / thinking model */
const THINKER_KEYWORDS = [
  'qwen3:', 'qwen3-next', 'qwen3.', // Use : and . to avoid matching qwen3-coder
  'deepseek-r1', 'think', 'reason', 'o1', 'o3', 'o4',
  'gemma3', 'phi4', 'command-r', 'llama3', 'llama-3',
];

/* Exclude vision / VL models — they waste time on code tasks */
const EXCLUDED_KEYWORDS = [
  '-vl', 'vision', 'llava', 'bakllava', 'moondream',
  'minicpm-v', 'cogvlm',
];

function isExcluded(name: string): boolean {
  const lower = name.toLowerCase();
  return EXCLUDED_KEYWORDS.some((kw) => lower.includes(kw));
}

function isCoderModel(name: string): boolean {
  if (isExcluded(name)) return false;
  const lower = name.toLowerCase();
  return CODER_KEYWORDS.some((kw) => lower.includes(kw));
}

function isThinkerModel(name: string): boolean {
  if (isExcluded(name)) return false;
  // Exclude coder models from thinker list
  if (isCoderModel(name)) return false;
  const lower = name.toLowerCase();
  return THINKER_KEYWORDS.some((kw) => lower.includes(kw));
}

const ModelSelector: React.FC<Props> = ({
  provider,
  coderModel,
  thinkerModel,
  onProviderChange,
  onCoderModelSelect,
  onThinkerModelSelect,
}) => {
  const [coderModels, setCoderModels] = useState<OllamaModel[]>([]);
  const [thinkerModels, setThinkerModels] = useState<OllamaModel[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'err'>('loading');
  const fetched = useRef(false);
  const onCoderRef = useRef(onCoderModelSelect);
  const onThinkerRef = useRef(onThinkerModelSelect);
  onCoderRef.current = onCoderModelSelect;
  onThinkerRef.current = onThinkerModelSelect;

  /* fetch ollama models ONCE on mount */
  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    (async () => {
      try {
        setStatus('loading');
        const res = await fetch(`/api/ollama/tags`, {
          signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        const raw: OllamaModel[] = (data.models ?? []).map((m: any) => ({
          id: m.name,
          name: m.name.split(':')[0],
          size: `${(m.size / 1e9).toFixed(1)} GB`,
        }));
        /* Filter out vision/VL models globally */
        const models = raw.filter((m) => !isExcluded(m.id));

        /* Coder list — code-specialized models */
        const coders = models.filter((m) => isCoderModel(m.id));
        setCoderModels(coders);
        if (coders.length > 0) {
          const defaultCoder =
            coders.find((m) => m.id === 'qwen3-coder-next:latest') ||
            coders.find((m) => m.id.includes('qwen3-coder-next')) ||
            coders[0];
          onCoderRef.current(defaultCoder.id);
        }

        /* Thinker list — reasoning models ONLY (no fallbacks) */
        const nonCoderModels = models.filter((m) => !isCoderModel(m.id));
        const thinkers = nonCoderModels.filter((m) => isThinkerModel(m.id));
        setThinkerModels(thinkers);
        
        if (thinkers.length > 0) {
          const defaultThinker =
            thinkers.find((m) => m.id === 'qwen3-next:latest') ||
            thinkers.find((m) => m.id.includes('qwen3-next')) ||
            thinkers.find((m) => m.id.startsWith('qwen3:32')) ||
            thinkers[0];
          onThinkerRef.current(defaultThinker.id);
        }

        setStatus('ok');
      } catch {
        setStatus('err');
        setCoderModels([]);
        setThinkerModels([]);
      }
    })();
  }, []);

  return (
    <div className="ms">
      {/* Provider toggle */}
      <div className="ms-providers">
        <button
          className={`ms-prov${provider === 'ollama' ? ' on' : ''}`}
          onClick={() => onProviderChange('ollama')}
        >
          🦙 Ollama
          <span className={`ms-dot ${status === 'ok' ? 'green' : status === 'err' ? 'red' : 'gray'}`} />
        </button>
      </div>

      {/* Dual model selectors */}
      <div className="ms-pair">
        <div className="ms-role">
          <span className="ms-role-label">🧠 Thinker</span>
          <select
            className="ms-select"
            value={thinkerModel}
            onChange={(e) => onThinkerModelSelect(e.target.value)}
          >
            {thinkerModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.size && `(${m.size})`}
              </option>
            ))}
          </select>
        </div>

        <span className="ms-pair-arrow">→</span>

        <div className="ms-role">
          <span className="ms-role-label">💻 Coder</span>
          <select
            className="ms-select"
            value={coderModel}
            onChange={(e) => onCoderModelSelect(e.target.value)}
          >
            {coderModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.size && `(${m.size})`}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default ModelSelector;
