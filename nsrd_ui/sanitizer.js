/**
 * NSRD Code Sanitizer
 *
 * Pre-build AST validation + programmatic auto-repair for LLM-generated JSX/JS.
 * Uses @babel/parser to parse each file and applies targeted fixes for the most
 * common syntax mistakes LLMs make.
 *
 * This runs BEFORE Vite build, saving expensive LLM fix-loop iterations.
 *
 * Common LLM mistakes this catches:
 *   • Stray semicolons inside JSX expressions:  });  →  })
 *   • Missing commas in style/object literals
 *   • Unmatched brackets / parentheses
 *   • Duplicate export defaults
 *   • Unterminated JSX expressions
 *   • Trailing commas before closing brackets in wrong spots
 */

const parser = require('@babel/parser');

/* ── Babel parse options for JSX files ─────────────── */
const PARSE_OPTS = {
  sourceType: 'module',
  plugins: [
    'jsx',
    'optionalChaining',
    'nullishCoalescingOperator',
    'classProperties',
    'objectRestSpread',
  ],
};

/* ── Helpers ────────────────────────────────────────── */

/** Split code into lines (1-indexed access helper). */
function lines(code) {
  return code.split('\n');
}

/** Reassemble lines into code string. */
function join(linesArr) {
  return linesArr.join('\n');
}

/**
 * Try to parse code with Babel.
 * Returns null if valid, or { message, line, column } on error.
 */
function validate(code) {
  try {
    parser.parse(code, PARSE_OPTS);
    return null;
  } catch (err) {
    return {
      message: err.message || String(err),
      line: err.loc?.line ?? null,
      column: err.loc?.column ?? null,
    };
  }
}

/**
 * Remove a specific character at (line, col).
 * Line is 1-based, column is 0-based (Babel convention).
 */
function removeCharAt(code, line, col) {
  const ls = lines(code);
  if (line < 1 || line > ls.length) return code;
  const row = ls[line - 1];
  if (col < 0 || col >= row.length) return code;
  ls[line - 1] = row.slice(0, col) + row.slice(col + 1);
  return join(ls);
}

/**
 * Insert a character before position (line, col).
 */
function insertCharAt(code, line, col, ch) {
  const ls = lines(code);
  if (line < 1 || line > ls.length) return code;
  const row = ls[line - 1];
  ls[line - 1] = row.slice(0, col) + ch + row.slice(col);
  return join(ls);
}

/**
 * Get the character at (line, col).
 */
function charAt(code, line, col) {
  const ls = lines(code);
  if (line < 1 || line > ls.length) return '';
  return ls[line - 1][col] ?? '';
}

/* ── Fix strategies ────────────────────────────────── */

/**
 * Each fixer receives (code, error) and returns { code, description } or null.
 * They are tried in order; the first one that makes the error go away wins.
 */
const FIXERS = [
  // ── -1. Expected ">" but found "<" — tag missing closing '>' on previous line ──
  // e.g.  <h2>Title</h2    ← next line starts a new tag, Babel errors at that column
  {
    match: (err) => /Expected ">" but found "<"/.test(err.message),
    fix: (code, err) => {
      const ls = lines(code);
      // The error fires AT the next tag's line; the broken tag is on the line BEFORE
      const targetLine = (err.line ?? 1) - 1; // 1-based line of the unclosed tag
      if (targetLine < 1 || targetLine > ls.length) return null;
      const row = ls[targetLine - 1].trimEnd();
      // If the previous line ends with a partial tag (no '>'), close it
      if (/<\/[a-zA-Z][a-zA-Z0-9.]*$/.test(row) || /<[a-zA-Z][a-zA-Z0-9.]*(\s[^>]*)?$/.test(row)) {
        ls[targetLine - 1] = row + '>';
        return {
          code: join(ls),
          description: `Added missing '>' to unclosed tag at line ${targetLine}`,
        };
      }
      return null;
    },
  },

  // ── 0. Expected identifier but found ":" — orphaned colon OR const:/let: pattern ──
  {
    match: (err) => /Expected identifier but found ":"/.test(err.message),
    fix: (code, err) => {
      const ls = lines(code);
      if (err.line < 1 || err.line > ls.length) return null;

      const line = ls[err.line - 1];
      const trimmed = line.trim();

      // Pattern: const: [...] or let: {...} — model-specific quirk, remove the colon
      const kw = line.match(/\b(const|let|var):( )/);
      if (kw) {
        ls[err.line - 1] = line.replace(/\b(const|let|var):( )/, '$1$2');
        return {
          code: join(ls),
          description: `Fixed ${kw[1]}: destructuring at line ${err.line}`,
        };
      }

      // Pattern: "  : {" or "  : value" — missing key before colon, remove the line
      if (trimmed.startsWith(':')) {
        ls.splice(err.line - 1, 1);
        return {
          code: join(ls),
          description: `Removed orphaned colon line at ${err.line}`,
        };
      }

      // Pattern: colon appears mid-line at the error column
      if (err.column != null && line[err.column] === ':') {
        ls.splice(err.line - 1, 1);
        return {
          code: join(ls),
          description: `Removed line with orphaned colon at ${err.line}`,
        };
      }

      return null;
    },
  },

  // ── 1. Expected "X" but found ";" — remove stray semicolon ──
  {
    match: (err) => /Expected .+ but found ";"/.test(err.message),
    fix: (code, err) => {
      const ch = charAt(code, err.line, err.column);
      if (ch === ';') {
        return {
          code: removeCharAt(code, err.line, err.column),
          description: `Removed stray semicolon at line ${err.line}`,
        };
      }
      // Sometimes the semicolon is on the previous line's end
      const ls = lines(code);
      if (err.line > 1) {
        const prevLine = ls[err.line - 2];
        const trimmed = prevLine.trimEnd();
        if (trimmed.endsWith(';')) {
          ls[err.line - 2] = trimmed.slice(0, -1);
          return {
            code: join(ls),
            description: `Removed stray semicolon at end of line ${err.line - 1}`,
          };
        }
      }
      return null;
    },
  },

  // ── 2. Expected "}" but found ";" — same idea ──
  {
    match: (err) => /Expected "}" but found ";"/.test(err.message),
    fix: (code, err) => {
      if (charAt(code, err.line, err.column) === ';') {
        return {
          code: removeCharAt(code, err.line, err.column),
          description: `Removed stray semicolon (expected "}") at line ${err.line}`,
        };
      }
      return null;
    },
  },

  // ── 3. Unexpected token ";" — generic stray semicolon ──
  {
    match: (err) =>
      /Unexpected token/.test(err.message) && err.column != null,
    fix: (code, err) => {
      const ch = charAt(code, err.line, err.column);
      if (ch === ';') {
        return {
          code: removeCharAt(code, err.line, err.column),
          description: `Removed unexpected semicolon at line ${err.line}`,
        };
      }
      return null;
    },
  },

  // ── 4. Expected "," — missing comma in object literal / props ──
  {
    match: (err) => /expected ","/.test(err.message.toLowerCase()),
    fix: (code, err) => {
      // Insert comma at the end of the previous line
      const ls = lines(code);
      if (err.line > 1) {
        const prevLine = ls[err.line - 2].trimEnd();
        // Only insert if prev line ends with a value-like token (string, number, }, ], identifier)
        if (/[}\]'"`\w\d]$/.test(prevLine)) {
          ls[err.line - 2] = ls[err.line - 2].trimEnd() + ',';
          return {
            code: join(ls),
            description: `Inserted missing comma at end of line ${err.line - 1}`,
          };
        }
      }
      return null;
    },
  },

  // ── 5. Unterminated string / template literal ──
  {
    match: (err) => /Unterminated string/.test(err.message),
    fix: (code, err) => {
      const ls = lines(code);
      if (!err.line) return null;
      const row = ls[err.line - 1];
      // Find the opening quote
      const quoteMatch = row.match(/(['"`])(?:[^'"`\\]|\\.)*$/);
      if (quoteMatch) {
        ls[err.line - 1] = row + quoteMatch[1];
        return {
          code: join(ls),
          description: `Closed unterminated string at line ${err.line}`,
        };
      }
      return null;
    },
  },

  // ── 6. Unexpected "}" — extra closing brace, try removing it ──
  {
    match: (err) =>
      /Unexpected token.*}/.test(err.message) ||
      /expected.*but found "}"/.test(err.message.toLowerCase()),
    fix: (code, err) => {
      if (charAt(code, err.line, err.column) === '}') {
        return {
          code: removeCharAt(code, err.line, err.column),
          description: `Removed extra closing brace at line ${err.line}`,
        };
      }
      return null;
    },
  },

  // ── 7. Unexpected ")" — extra closing paren ──
  {
    match: (err) =>
      /Unexpected token.*\)/.test(err.message) ||
      /expected.*but found "\)"/.test(err.message.toLowerCase()),
    fix: (code, err) => {
      if (charAt(code, err.line, err.column) === ')') {
        return {
          code: removeCharAt(code, err.line, err.column),
          description: `Removed extra closing paren at line ${err.line}`,
        };
      }
      return null;
    },
  },

  // ── 8. JSX expression ended prematurely — often a missing } ──
  {
    match: (err) => /Unexpected token.*expected.*\}/.test(err.message),
    fix: (code, err) => {
      return {
        code: insertCharAt(code, err.line, err.column, '}'),
        description: `Inserted missing closing brace at line ${err.line}`,
      };
    },
  },

  // ── 9. Missing opening brace in array/object — id: instead of { id: ──
  // Also handles 'Unexpected token, expected ","' when a colon follows an array element
  // e.g. array missing { before an object: [...}, year: '2000s', ...]
  {
    match: (err) =>
      /Expected "]" but found ":"/.test(err.message) ||
      /Expected "}" but found ":"/.test(err.message) ||
      (/Unexpected token.*expected ","/.test(err.message) && err.column != null),
    fix: (code, err) => {
      const ls = lines(code);
      if (!err.line || err.line < 1) return null;
      const row = ls[err.line - 1];
      // For 'Unexpected token, expected ","' — only proceed if the error column is at ':'
      if (/Unexpected token.*expected ","/.test(err.message)) {
        const ch = charAt(code, err.line, err.column);
        if (ch !== ':') return null; // let fixer #4 handle other comma-expected cases
      }
      // Check if this line looks like it's missing an opening brace
      // Pattern: whitespace + identifier + colon (no opening brace)
      if (/^\s+\w+\s*:/.test(row)) {
        const trimmed = row.trimStart();
        const indent = row.length - trimmed.length;
        ls[err.line - 1] = ' '.repeat(indent) + '{ ' + trimmed;
        return {
          code: join(ls),
          description: `Inserted missing opening brace at line ${err.line}`,
        };
      }
      return null;
    },
  },

  // ── 10. Missing '=' in JSX prop — position[35.93] instead of position={[35.93]} ──
  {
    match: (err) => /Expected .+ but found "\["/.test(err.message) || /Unexpected token/.test(err.message),
    fix: (code, err) => {
      const ls = lines(code);
      if (!err.line || err.line < 1) return null;
      const row = ls[err.line - 1];
      // Pattern: propName[value] or propName{value} without =
      const match = row.match(/(\w+)([\[{])/);
      if (match && err.column != null) {
        const propEnd = row.indexOf(match[1]) + match[1].length;
        const bracketStart = row.indexOf(match[2], propEnd);
        if (bracketStart === propEnd) {
          // Missing = between prop and bracket
          ls[err.line - 1] = row.slice(0, bracketStart) + '=' + row.slice(bracketStart);
          return {
            code: join(ls),
            description: `Inserted missing '=' in JSX prop at line ${err.line}`,
          };
        }
      }
      return null;
    },
  },

  // ── 10b. Expected "}" but found "string" — object key missing colon before string value ──
  // Pattern: { description 'The field of GIS...' }
  // Parser parsed 'description' as shorthand property, then expected ',' or '}' but found string
  {
    match: (err) => /Expected "}" but found "['"]/.test(err.message) || /Expected "}" but found "'/.test(err.message),
    fix: (code, err) => {
      const ls = lines(code);
      if (!err.line || err.line < 1) return null;
      const row = ls[err.line - 1];
      const col = err.column ?? 0;
      // There should be an identifier ending just before this position (key with no colon)
      const before = row.slice(0, col);
      const identMatch = before.match(/(\w+)\s+$/);
      if (identMatch && !before.trimEnd().endsWith(':') && !before.trimEnd().endsWith(',')) {
        // Insert ': ' right before the quote character
        ls[err.line - 1] = before.trimEnd() + ': ' + row.slice(col);
        return {
          code: join(ls),
          description: `Inserted missing colon after object key '${identMatch[1]}' at line ${err.line}`,
        };
      }
      return null;
    },
  },

  // ── 11. Malformed style object — {{padding20px"}} ──
  {
    match: (err) => /Unexpected token/.test(err.message) || /Expected .+ but found/.test(err.message),
    fix: (code, err) => {
      const ls = lines(code);
      if (!err.line || err.line < 1) return null;
      const row = ls[err.line - 1];
      // Pattern: style={{paddingXXpx"}} or style={{colorXX"}}
      const styleMatch = row.match(/style=\{\{(\w+)(\d+)(px|em|rem|%)?["'}]/);
      if (styleMatch) {
        const [full, prop, value, unit] = styleMatch;
        const fixed = row.replace(full, `style={{${prop}: "${value}${unit || 'px'}"}}`);
        ls[err.line - 1] = fixed;
        return {
          code: join(ls),
          description: `Fixed malformed style object at line ${err.line}`,
        };
      }
      // Pattern: {{prop: value"}} missing comma and quote
      const objMatch = row.match(/\{\{(\w+):\s*["']?([^,}"']+)["']?\}/);
      if (objMatch) {
        const [full, prop, value] = objMatch;
        const fixed = row.replace(full, `{{${prop}: "${value}"}}`);
        ls[err.line - 1] = fixed;
        return {
          code: join(ls),
          description: `Fixed malformed object syntax at line ${err.line}`,
        };
      }
      return null;
    },
  },
];

/* ── Global (non-parse-error) pre-fixes ────────────── */

/**
 * Apply heuristic fixes that don't require parse errors.
 * These are patterns we KNOW are wrong in JSX.
 */
function applyPreFixes(code) {
  // SANITIZER DISABLED — return code untouched
  return { code, fixes: [] };

  const fixes = [];
  let fixed = code;

  // ── Fix #0 (CRITICAL): model writes 'const:' instead of 'const' for destructuring ──
  // qwen3-coder-next consistently outputs: const: [x, setX] = useState([]);
  // This is a systematic model quirk — fix deterministically with a safe regex.
  if (/\bconst:\s*[\[{(]/.test(fixed)) {
    fixed = fixed.replace(/\bconst:\s*([\[{(])/g, 'const $1');
    fixes.push('Fixed const: destructuring → const (model-specific quirk)');
  }
  // Also handle: let: and var: (same pattern)
  if (/\b(?:let|var):\s*[\[{(]/.test(fixed)) {
    fixed = fixed.replace(/\b(let|var):\s*([\[{(])/g, '$1 $2');
    fixes.push('Fixed let:/var: destructuring → let/var');
  }

  // Fix: export default ComponentName() { → export default function ComponentName() {
  // Model sometimes omits the 'function' keyword before the component name
  fixed = fixed.replace(/\bexport\s+default\s+([A-Z][a-zA-Z0-9]*)\s*\(/g, (match, name) => {
    fixes.push(`Fixed missing 'function' keyword: export default function ${name}(`);
    return `export default function ${name}(`;
  });

  // Fix: const parsed rows = ... → const parsedRows = ...
  // Model sometimes writes two identifiers instead of one for a variable name
  {
    const NOT_VAR_PART = new Set(['in','of','instanceof','typeof','as','from','extends','implements']);
    fixed = fixed.replace(/\b(const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g,
      (match, kw, word1, word2) => {
        if (NOT_VAR_PART.has(word2.toLowerCase())) return match;
        const varName = word1 + word2.charAt(0).toUpperCase() + word2.slice(1);
        fixes.push(`Fixed two-word variable name: ${kw} ${word1} ${word2} → ${kw} ${varName}`);
        return `${kw} ${varName} =`;
      }
    );
  }

  // buildFixChatMessages sends:  "  1: import React from 'react';"
  // model copies it back as-is:  "1: import React from 'react';"
  // Detect by checking if first non-empty line starts with digits + ": "
  {
    const firstMeaningfulLine = fixed.split('\n').find(l => l.trim().length > 0) || '';
    if (/^\s*\d{1,4}:\s/.test(firstMeaningfulLine)) {
      fixed = fixed.replace(/^\s*\d{1,4}: ?/gm, '');
      fixes.push('Stripped line-number prefixes echoed from fix prompt');
    }
  }

  // Strip BOM
  if (fixed.charCodeAt(0) === 0xfeff) {
    fixed = fixed.slice(1);
    fixes.push('Stripped BOM');
  }

  // Normalize line endings
  if (fixed.includes('\r\n')) {
    fixed = fixed.replace(/\r\n/g, '\n');
    fixes.push('Normalized line endings');
  }

  // Remove duplicate export defaults (keep last)
  const defaultExportCount = (fixed.match(/export\s+default\s/g) || []).length;
  if (defaultExportCount > 1) {
    let count = 0;
    fixed = fixed.replace(/export\s+default\s/g, (match) => {
      count++;
      if (count < defaultExportCount) {
        fixes.push(`Removed duplicate export default (#${count})`);
        return '/* [sanitizer: removed duplicate export default] */ ';
      }
      return match;
    });
  }

  // Fix: JSX prop without = before bracket/brace — position[...] → position={[...]}
  const propMissingEquals = /(\s)(\w+)([\[{])(?!.*=)/g;
  if (propMissingEquals.test(fixed)) {
    fixed = fixed.replace(/(\s)(\w+)([\[{])/g, (match, space, prop, bracket) => {
      // Check if this looks like a JSX context (inside <Tag ...>)
      const context = fixed.slice(Math.max(0, fixed.indexOf(match) - 100), fixed.indexOf(match));
      if (/<\w+[^>]*$/.test(context)) {
        fixes.push(`Added '=' to JSX prop ${prop}`);
        return `${space}${prop}=${bracket}`;
      }
      return match;
    });
  }

  // Fix: Object literal key missing colon — "MT1 [35.93, -84.38]" → "MT1: [35.93, -84.38]"
  // LLM writes object properties without the colon before the value
  // IMPORTANT: skip JS keywords (const/let/var/return/import/etc.) so we don't re-add
  // a colon that the const: pre-fix just removed (e.g. 'const [x]' → 'const: [x]' is wrong).
  {
    const JS_KEYWORDS = new Set([
      'const','let','var','return','export','default','import','if','else','for','while',
      'do','switch','case','break','continue','function','class','try','catch','finally',
      'throw','new','delete','typeof','instanceof','void','yield','await','async',
      'static','of','in','from','with','debugger','extends','super','this',
    ]);
    fixed = fixed.replace(/^(\s+)([A-Za-z_$][A-Za-z0-9_$]*)\s+([\[{(])/gm, (match, indent, key, bracket) => {
      if (JS_KEYWORDS.has(key)) return match; // never add colon to JS keywords
      fixes.push(`Fixed missing colon in object key: ${key}`);
      return `${indent}${key}: ${bracket}`;
    });

    // Fix: Object literal key missing colon before string value
    // "  description 'The field of GIS...'  →  "  description: 'The field of GIS...'"
    // Same pattern but the value starts with a quote, not a bracket
    fixed = fixed.replace(/^(\s+)([A-Za-z_$][A-Za-z0-9_$]*)\s+(['"])/gm, (match, indent, key, quote) => {
      if (JS_KEYWORDS.has(key)) return match; // skip keywords
      fixes.push(`Fixed missing colon in object key before string: ${key}`);
      return `${indent}${key}: ${quote}`;
    });

    // Fix: Object literal key missing colon before negative number
    // Model writes coordinate objects without colon: { lat: 35.92, lng -84.30470 }
    // Case A — indented property on its own line: "  lng -84.30470,"
    fixed = fixed.replace(/^(\s+)([A-Za-z_$][A-Za-z0-9_$]*)\s+(-\d[\d.]*)\s*([,}])/gm, (match, indent, key, val, post) => {
      if (JS_KEYWORDS.has(key)) return match;
      fixes.push(`Fixed missing colon before negative number: ${key} ${val} → ${key}: ${val}`);
      return `${indent}${key}: ${val}${post}`;
    });
    // Case B — inline inside object: "{ ..., lng -84.30470, ... }"
    fixed = fixed.replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s+(-\d[\d.]*)(\s*[,}])/g, (match, pre, key, val, post) => {
      if (JS_KEYWORDS.has(key)) return match;
      fixes.push(`Fixed inline missing colon before negative number: ${key} ${val} → ${key}: ${val}`);
      return `${pre}${key}: ${val}${post}`;
    });
  }

  // Fix: Malformed style objects — style={{padding20px"}} → style={{padding: "20px"}}
  fixed = fixed.replace(/style=\{\{(\w+)(\d+)(px|em|rem|%)?["']/g, (match, prop, value, unit) => {
    fixes.push(`Fixed malformed style: ${prop}${value}${unit || 'px'}`);
    return `style={{${prop}: "${value}${unit || 'px'}"}}`;
  });

  // Fix: Array position without brackets — position[35.93, -84.38] with missing opening [
  fixed = fixed.replace(/position=\{(\d+\.?\d*,\s*-?\d+\.?\d*)\]/g, (match, coords) => {
    fixes.push(`Fixed position array brackets`);
    return `position={[${coords}]}`;
  });

  // Fix: Leaflet/HTML inside JSX prop string — attribution='... <a href="https://"> ...'
  // JSX parses <a href=...> as a tag, causing "Expected identifier after 'https:'"
  // Convert to template literal expression: attribution={`...`}
  const attrPatterns = [
    /attribution='([^']*<[a-zA-Z][^>]*>[^']*)'/g,
    /attribution="([^"]*<[a-zA-Z][^>]*>[^"]*)"/g,
  ];
  for (const pat of attrPatterns) {
    fixed = fixed.replace(pat, (match, content) => {
      const escaped = content.replace(/`/g, '\\`');
      fixes.push('Fixed Leaflet attribution: HTML in JSX prop → template literal');
      return `attribution={\`${escaped}\`}`;
    });
  }

  // Fix: URL string with {z}/{x}/{y} tokens missing closing quote (unterminated)
  // Pattern: url="https://...{z}/{x}/{y}.png  (no closing quote before newline)
  fixed = fixed.replace(/(url=["'])(https?:\/\/[^"'\n]+?)(?=[\n\s])/g, (match, prefix, url) => {
    const q = prefix.slice(-1);
    fixes.push('Fixed unterminated TileLayer URL string');
    return `${prefix}${url}${q}`;
  });

  // Fix: Unclosed JSX tags missing the final '>'
  // Matches lines that end with a partial tag (no '>'):
  //   </h2      →  </h2>
  //   </div     →  </div>
  //   <section  →  <section>
  const unclosedTagLines = fixed.split('\n');
  let closedTagFixes = 0;
  for (let i = 0; i < unclosedTagLines.length; i++) {
    const row = unclosedTagLines[i];
    const trimmed = row.trimEnd();
    // Closing tag missing '>': </TagName  at end of line
    if (/^(\s*)<\/[a-zA-Z][a-zA-Z0-9.]*$/.test(trimmed)) {
      unclosedTagLines[i] = trimmed + '>';
      closedTagFixes++;
    }
    // Opening tag missing '>': <TagName or <TagName attr="val"  at end of line
    // (must not already end with > or /> or be a comment/string)
    else if (/^(\s*)<[a-zA-Z][a-zA-Z0-9.]*(\s[^>]*[^/])?$/.test(trimmed) && !trimmed.endsWith('>')) {
      unclosedTagLines[i] = trimmed + '>';
      closedTagFixes++;
    }
  }
  if (closedTagFixes > 0) {
    fixed = unclosedTagLines.join('\n');
    fixes.push(`Closed ${closedTagFixes} unclosed JSX tag(s) missing '>'.`);
  }

  // Fix: <MapContainer={{ ... }}> — model drops 'style=' prop name
  //   <MapContainer={{ height: '500px' }}>  →  <MapContainer style={{ height: '500px' }}>
  //   Same for <div={{ and any other tag
  fixed = fixed.replace(/<([A-Za-z][A-Za-z0-9.]*)=\{\{/g, (match, tag) => {
    fixes.push(`Fixed missing 'style=' on <${tag}={{`);
    return `<${tag} style={{`;
  });

  // Fix: <pathcap="round" / <pathlinecap → <path strokeLinecap="round"
  // Model fuses the SVG <path> tag name with the attribute name that follows.
  // MUST run before the <tag="class"> fix so <pathcap="round"> isn't treated as a tag.
  fixed = fixed.replace(/<path(?:stroke)?(?:line)?cap\s*=/gi, () => {
    fixes.push('Fixed fused <pathcap> → <path strokeLinecap=');
    return '<path strokeLinecap=';
  });
  // Also handle other fused <path+attr patterns: <pathLinejoin=, <pathd=, <pathfill=, <pathstroke=
  fixed = fixed.replace(/<path(linejoin|width|fill|stroke|d)(\s*=)/gi, (_, attr, eq) => {
    const attrMap = { linejoin: 'strokeLinejoin', width: 'strokeWidth', fill: 'fill', stroke: 'stroke', d: 'd' };
    const propName = attrMap[attr.toLowerCase()] || attr;
    fixes.push(`Fixed fused <path${attr}= → <path ${propName}=`);
    return `<path ${propName}${eq}`;
  });

  // Fix: <section="py-16 bg-gray-50"> → <section className="py-16 bg-gray-50">
  // Model writes Tailwind classes directly on the JSX tag name without 'className='
  // Pattern: <TagName="..." — tag name immediately followed by ="
  fixed = fixed.replace(/<([a-zA-Z][a-zA-Z0-9]*)=(?=")/g, (match, tag) => {
    fixes.push(`Fixed bare class on <${tag}>: inserted 'className='`);
    return `<${tag} className=`;
  });

  // Fix: <h1 className="...">Text</h> → <h1 className="...">Text</h1>
  // Model truncates heading closing tags to just </h>
  fixed = fixed.replace(/<(h[1-6])(\s[^>]*)?>([^<]*)<\/h>/g, (match, tag, attrs, content) => {
    fixes.push(`Fixed truncated closing tag </h> → </${tag}>`);
    return `<${tag}${attrs || ''}>${content}</${tag}>`;
  });
  // Fix: </1> → </h1>, </2> → </h2> — numeric-only closing tags for headings
  fixed = fixed.replace(/<\/([1-6])>/g, (match, num) => {
    fixes.push(`Fixed numeric closing tag </${num}> → </h${num}>`);
    return `</h${num}>`;
  });

  // Fix: <div className="..."></> → <div className="..."></div> (same-line fragment close)
  // Model uses </> as a close for a real element instead of </tagname>
  fixed = fixed.replace(/<([a-zA-Z][a-zA-Z0-9]*)([^>]*)><\/>/g, (match, tag, attrs) => {
    fixes.push(`Fixed <${tag}${attrs}></> → <${tag}${attrs}></${tag}>`);
    return `<${tag}${attrs}></${tag}>`;
  });

  // Fix: <TileLayer> (or <MapContainer>) with closing '>' on the opening line
  // then props written INSIDE the tag body (after >).
  // Pattern:  <TileLayer>\n    url=  →  <TileLayer\n    url=
  // We detect this by finding a JSX component tag that ends with '>' and is
  // immediately followed (next non-empty line) by a line that starts with a
  // lowercase prop name (url=, attribution=, zoom=, center= etc.)
  {
    const tileLines = fixed.split('\n');
    for (let i = 0; i < tileLines.length - 1; i++) {
      const trimmed = tileLines[i].trimEnd();
      // Line ends with bare > (not />) and is a component-open tag with no props
      if (/^\s*<(TileLayer|MapContainer|Circle|Polyline|Polygon|GeoJSON|LayerGroup)>$/.test(trimmed)) {
        // Check if next non-empty line is a prop assignment
        let j = i + 1;
        while (j < tileLines.length && tileLines[j].trim() === '') j++;
        if (j < tileLines.length && /^\s+[a-z][a-zA-Z]*=/.test(tileLines[j])) {
          // Remove the closing '>' from the opening tag so props become part of it
          tileLines[i] = trimmed.slice(0, -1);
          fixes.push(`Removed premature '>' from <${trimmed.trim().slice(1, -1)} — props follow on next line`);
        }
      }
    }
    fixed = tileLines.join('\n');
  }

  // Fix: import statement missing space before 'from' or missing quote
  //   import React fromreact'  →  import React from 'react'
  //   import React from react  →  import React from 'react'
  fixed = fixed.replace(
    /^(\s*import\s+[\w{}\s*,]+\s+)from\s*'?(\w[^'"\n;]*)'?\s*;?\s*$/gm,
    (match, prefix, mod) => {
      // Only fix if there's no proper quote wrapping
      if (!match.includes(`'${mod}'`) && !match.includes(`"${mod}"`)) {
        fixes.push(`Fixed unquoted import module: ${mod}`);
        return `${prefix}from '${mod.trim()}';`;
      }
      return match;
    }
  );
  // Specific: "fromX" fused together (no space)
  fixed = fixed.replace(/\bfrom([a-zA-Z@])/g, (match, ch) => {
    fixes.push(`Fixed fused 'from${ch}' import keyword`);
    return `from '${ch}`;
  });
  // Close any import that now has an unclosed quote
  fixed = fixed.replace(/^(\s*import\s+[^'";\n]*from\s+'[^';\n]+)$/gm, (match) => {
    fixes.push(`Closed unterminated import quote`);
    return match + "';";
  });

  // Fix: Unexpected "===" at start of file/line — ===FILE: delimiter leaked into content
  // Strip any lines that start with === (they are extractor delimiters, not code)
  if (fixed.includes('===FILE:') || fixed.includes('===END FILE===')) {
    fixed = fixed.replace(/^===.*===\s*$/gm, '');
    fixes.push('Removed leaked ===FILE:=== delimiter lines from code');
  }

  // Note: multiline <tag>\n  content\n</> cases are left to the LLM fixer
  // (same-line case is handled above in the <tag></> fix)

  // ── Attribute string / SVG quirks ──────────────────────────────────────────

  // Fix: SVG viewBox= attribute name dropped — stroke="currentColor"="0 0 24 24"
  // The model writes the value ="..." without the attribute name in front.
  // Detect: a closing quote immediately followed by ="N N N N" (viewBox-shaped value)
  fixed = fixed.replace(/"="((?:\d+\.?\d*\s+){3}\d+\.?\d*)"/, (match, val) => {
    fixes.push(`Fixed dropped viewBox= attribute: inserted viewBox="${val}"`);
    return `" viewBox="${val}"`;
  });

  // Fix: strokeWidth="2 d=" — model forgets to close the strokeWidth quote before d=
  // strokeWidth="2 d="M13..."  →  strokeWidth="2" d="M13..."
  fixed = fixed.replace(/strokeWidth="(\d+(?:\.\d+)?)\s+d="/g, (match, w) => {
    fixes.push(`Fixed unclosed strokeWidth="${w} — added closing quote before d=`);
    return `strokeWidth="${w}" d="`;
  });

  // Fix: unclosed JSX prop quote swallows the next prop
  // to="/map className= → to="/map" className=
  // href="/path style= → href="/path" style=
  {
    const NEXT_PROP = '(?:className|style|onClick|id|key|aria-\\w+|data-\\w+|target|rel)';
    fixed = fixed.replace(
      new RegExp(`\\b(to|href)="(\\/[^"\\s>]*?)\\s+(${NEXT_PROP}=)`, 'g'),
      (match, attr, val, nextProp) => {
        fixes.push(`Fixed unclosed ${attr}="${val} — added closing quote before ${nextProp}`);
        return `${attr}="${val}" ${nextProp}`;
      }
    );
  }

  // ── Tailwind class fusions ─────────────────────────────────────────────────

  // Fix: h-6-green-600 or w-8-blue-500 → h-6 text-green-600
  // Model drops the space between a sizing utility and a text-color utility
  {
    const TC = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
    fixed = fixed.replace(
      new RegExp(`\\b((?:w|h)-\\d+)-((?:${TC})-\\d+)\\b`, 'g'),
      (match, size, color) => {
        fixes.push(`Fixed Tailwind fusion: ${match} → ${size} text-${color}`);
        return `${size} text-${color}`;
      }
    );
  }

  // Fix: text-lg-semibold / text-xl-bold → text-lg font-semibold
  // Model merges font-size and font-weight utilities by dropping the space
  fixed = fixed.replace(
    /\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)-(semibold|bold|medium|light|thin|normal|extrabold|black)\b/g,
    (match, size, weight) => {
      fixes.push(`Fixed Tailwind fusion: ${match} → text-${size} font-${weight}`);
      return `text-${size} font-${weight}`;
    }
  );

  // Fix: gap6 / pt4 / mb8 — Tailwind spacing utilities missing their dash
  fixed = fixed.replace(
    /\b(gap|px|py|pt|pb|pl|pr|mx|my|mt|mb|ml|mr|space-x|space-y)(\d+)\b(?!-)/g,
    (match, util, val) => {
      fixes.push(`Fixed Tailwind missing dash: ${match} → ${util}-${val}`);
      return `${util}-${val}`;
    }
  );

  // Fix: rounded-xl-md / rounded-lg-sm — two rounding utilities merged (keep larger)
  {
    const roundSizes = ['none', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full'];
    fixed = fixed.replace(
      /\brounded-(none|sm|md|lg|xl|2xl|3xl|full)-(none|sm|md|lg|xl|2xl|3xl|full)\b/g,
      (match, r1, r2) => {
        const keep = roundSizes.indexOf(r1) >= roundSizes.indexOf(r2) ? r1 : r2;
        fixes.push(`Fixed merged Tailwind rounded: ${match} → rounded-${keep}`);
        return `rounded-${keep}`;
      }
    );
  }

  // ── Heading tag errors ─────────────────────────────────────────────────────

  // Fix: Missing </ before closing heading — "Platformh2>" → "Platform</h2>"
  // Model drops the </ prefix of a closing tag, fusing it with the text content.
  fixed = fixed.replace(/([a-zA-Z0-9,.: !?;'])([hH])([1-6])>/g, (match, prev, h, num) => {
    fixes.push(`Fixed missing </ before ${h}${num}> — inserted </`);
    return `${prev}</${h}${num}>`;
  });

  // Fix: <h className="...">...</h3> — opening heading missing the level number
  // Model writes <h> (no number) but closes with </h3>. Extract level from close tag.
  fixed = fixed.replace(/<h(\s[^>]*)>([\s\S]*?)<\/(h[1-6])>/g, (match, attrs, content, closeTag) => {
    const num = closeTag.charAt(1);
    fixes.push(`Fixed <h> → <${closeTag}> (missing heading level number)`);
    return `<${closeTag}${attrs}>${content}</${closeTag}>`;
  });

  // Fix: missing => in arrow callback — .map((row, i) { → .map((row, i) => {
  // Model drops the => when writing .map/.filter/.then/.catch callbacks
  fixed = fixed.replace(
    /(\.(map|filter|forEach|reduce|find|findIndex|some|every|then|catch)\s*\(\s*)(\([^)]*\))\s*(?!=>)\s*\{/g,
    (match, prefix, method, params) => {
      fixes.push(`Fixed missing => in .${method}() arrow callback: ${params} { → ${params} => {`);
      return `${prefix}${params} => {`;
    }
  );

  // Fix: trailing comma on JSX prop value — zoom={10}, → zoom={10}
  // Model treats JSX props like a JS object and adds commas between them
  fixed = fixed.replace(
    /(=["'][^"'\n]*["']|\}),(?=\s*\n\s*(?:[a-zA-Z_$\/]|\/>|>))/g,
    (match, prop) => {
      fixes.push('Fixed trailing comma after JSX prop value');
      return prop;
    }
  );

  // Fix: </tag>>Text — model drops the "<d" from "<div>" leaving a stray ">" after a closing tag
  // e.g. {item.value}</div>>Temp: → {item.value}</div>\n<div>Temp:
  fixed = fixed.replace(/(<\/[a-zA-Z][a-zA-Z0-9]*>)>([A-Za-z{"'])/g, (match, closeTag, next) => {
    fixes.push(`Fixed stray > after ${closeTag} — inserted missing <div> opener`);
    return `${closeTag}\n<div>${next}`;
  });

  // Fix: className={`...${>  — spurious ">" after "${" in a template literal closes the JSX tag early
  // e.g. className={`flex gap-4 ${>\n  item.x ? 'a' : 'b'\n`}  →  className={`flex gap-4 ${\n  item.x ? 'a' : 'b'\n`}
  fixed = fixed.replace(/(\$\{)>([ \t]*\n)/g, (match, open, trail) => {
    fixes.push('Fixed spurious > after ${ in template literal — removed > that closed JSX tag early');
    return `${open}${trail}`;
  });

  return { code: fixed, fixes };
}

/* ── Bracket balancing ─────────────────────────────── */

/**
 * Check if brackets/parens/braces are balanced.
 * Returns { balanced: boolean, excess: { '{': n, '(': n, '[': n } }
 */
function checkBalance(code) {
  const stack = [];
  const pairs = { '{': '}', '(': ')', '[': ']' };
  const closers = new Set(['}', ')', ']']);
  let inString = false;
  let stringChar = '';
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const next = code[i + 1];
    const prev = code[i - 1];

    // Track comments
    if (!inString && !inTemplate) {
      if (inLineComment) {
        if (ch === '\n') inLineComment = false;
        continue;
      }
      if (inBlockComment) {
        if (ch === '*' && next === '/') {
          inBlockComment = false;
          i++;
        }
        continue;
      }
      if (ch === '/' && next === '/') { inLineComment = true; continue; }
      if (ch === '/' && next === '*') { inBlockComment = true; continue; }
    }

    // Track strings
    if (!inLineComment && !inBlockComment) {
      if (inString) {
        if (ch === stringChar && prev !== '\\') inString = false;
        continue;
      }
      if (inTemplate) {
        if (ch === '`' && prev !== '\\') inTemplate = false;
        // Note: we don't track ${} inside templates for simplicity
        continue;
      }
      if (ch === '\'' || ch === '"') {
        inString = true;
        stringChar = ch;
        continue;
      }
      if (ch === '`') {
        inTemplate = true;
        continue;
      }
    }

    // Track brackets
    if (pairs[ch]) {
      stack.push(ch);
    } else if (closers.has(ch)) {
      const expected = Object.entries(pairs).find(([, v]) => v === ch);
      if (expected && stack.length > 0 && stack[stack.length - 1] === expected[0]) {
        stack.pop();
      }
      // Mismatched closer — don't pop, it's an error
    }
  }

  const excess = { '{': 0, '(': 0, '[': 0 };
  for (const ch of stack) excess[ch]++;

  return {
    balanced: stack.length === 0,
    excess,
    unclosed: stack.length,
  };
}

/**
 * Try to fix bracket imbalance by appending missing closers.
 * Only does this if there are unclosed openers (not extra closers).
 */
function fixBracketBalance(code, fixes) {
  const { balanced, excess } = checkBalance(code);
  if (balanced) return code;

  let fixed = code;
  // Append missing closers in reverse-nesting order
  const closerMap = { '{': '}', '(': ')', '[': ']' };
  for (const [opener, count] of Object.entries(excess)) {
    for (let i = 0; i < count; i++) {
      fixed += '\n' + closerMap[opener];
      fixes.push(`Appended missing '${closerMap[opener]}' (unclosed '${opener}')`);
    }
  }

  return fixed;
}

/* ═══════════════════════════════════════════════════════
   MAIN ENTRY POINT
   sanitizeFiles(files) → { files, report }
   ═══════════════════════════════════════════════════════ */

/**
 * Validate and auto-fix an array of { path, content } file objects.
 *
 * @param {Array<{path: string, content: string}>} files
 * @returns {{ files: Array<{path, content}>, report: { totalFixes: number, details: Array } }}
 */
function sanitizeFiles(files) {
  // SANITIZER DISABLED — return files untouched
  return { files, report: { totalFixes: 0, details: [] } };

  const report = { totalFixes: 0, details: [] };

  const sanitized = files.map((f) => {
    // Only process JS/JSX/TS/TSX files
    if (!/\.(jsx?|tsx?)$/.test(f.path)) {
      return f;
    }

    const fileReport = { file: f.path, fixes: [], remainingErrors: [] };
    let code = f.content;

    // Phase 1: Pre-fixes (always applied)
    const pre = applyPreFixes(code);
    code = pre.code;
    fileReport.fixes.push(...pre.fixes);

    // Phase 2: Validate → fix loop (up to 30 iterations)
    for (let pass = 0; pass < 30; pass++) {
      const err = validate(code);
      if (!err) break; // Clean parse!

      // Log the error for debugging
      if (pass === 0) {
        console.log(`[Sanitizer] ${f.path}: ${err.message} at line ${err.line}`);
      }

      // Try each fixer
      let fixed = false;
      for (const fixer of FIXERS) {
        if (!fixer.match(err)) continue;
        const result = fixer.fix(code, err);
        if (result && result.code !== code) {
          code = result.code;
          fileReport.fixes.push(result.description);
          fixed = true;
          break;
        }
      }

      if (!fixed) {
        // No fixer matched — try bracket balancing as last resort
        const balanceFixes = [];
        const balanced = fixBracketBalance(code, balanceFixes);
        if (balanced !== code) {
          code = balanced;
          fileReport.fixes.push(...balanceFixes);
        } else {
          // Can't auto-fix — record remaining error
          fileReport.remainingErrors.push(err);
          break;
        }
      }
    }

    // Final validation
    const finalErr = validate(code);
    if (finalErr && !fileReport.remainingErrors.length) {
      fileReport.remainingErrors.push(finalErr);
      // Log code snippet around the error
      const ls = lines(code);
      if (finalErr.line && finalErr.line >= 1 && finalErr.line <= ls.length) {
        const start = Math.max(1, finalErr.line - 2);
        const end = Math.min(ls.length, finalErr.line + 2);
        console.log(`[Sanitizer] Code around error (lines ${start}-${end}):`);
        for (let i = start; i <= end; i++) {
          const marker = i === finalErr.line ? ' >>> ' : '     ';
          console.log(`${marker}${i}: ${ls[i - 1]}`);
        }
      }
    }

    report.totalFixes += fileReport.fixes.length;
    if (fileReport.fixes.length || fileReport.remainingErrors.length) {
      report.details.push(fileReport);
    }

    return { path: f.path, content: code };
  });

  return { files: sanitized, report };
}

/**
 * Quick validation of all files. Returns files with errors.
 */
function validateFiles(files) {
  const errors = [];
  for (const f of files) {
    if (!/\.(jsx?|tsx?)$/.test(f.path)) continue;
    const err = validate(f.content);
    if (err) errors.push({ file: f.path, ...err });
  }
  return errors;
}

module.exports = {
  sanitizeFiles,
  validateFiles,
  validate,
};
