/**
 * Reference Code Analyzer — Bridge to Python RAG system
 * Tries RAG with semantic embeddings first, falls back to keyword matching
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const USE_RAG = true;
const REFERENCE_DIR = fs.existsSync('/reference-codebases')
  ? '/reference-codebases'
  : path.join(__dirname, '..', 'reference-codebases');

/**
 * Get relevant code examples using RAG or fallback methods
 */
function getRelevantExamples(userPrompt, maxExamples = 3) {
  // Try RAG with semantic embeddings first
  if (USE_RAG) {
    try {
      console.log('[ReferenceAnalyzer] Using RAG with semantic embeddings');
      // Sanitize query: collapse newlines/tabs to spaces and strip shell-special chars
      // so the argument doesn't break when error text is multiline.
      const safeQuery = userPrompt
        .replace(/[\r\n\t]+/g, ' ')          // newlines → space
        .replace(/["'`$\\<>|&;]/g, ' ')     // shell metacharacters → space (includes redirect/pipe chars)
        .replace(/\s{2,}/g, ' ')             // collapse multiple spaces
        .trim()
        .slice(0, 300);                      // cap length — FAISS only needs key phrases

      // Call the persistent RAG server (model is already warm — no Python startup cost)
      const encodedQuery = encodeURIComponent(safeQuery);
      const ragServerUrl = `http://127.0.0.1:5001/search?q=${encodedQuery}&n=${maxExamples}`;
      const result = execSync(
        `wget -q -O - "${ragServerUrl}"`,
        { encoding: 'utf8', timeout: 15000 }
      );
      const data = JSON.parse(result);

      if (data.summary && data.summary.trim()) {
        console.log('[ReferenceAnalyzer] RAG semantic search completed');
        return { summary: data.summary, method: 'semantic-rag' };
      }

      console.log('[ReferenceAnalyzer] RAG returned no results, trying legacy analyzer');
      return useLegacyAnalyzer(userPrompt, maxExamples);
      
    } catch (err) {
      console.error('[ReferenceAnalyzer] RAG error:', err.message);
      console.log('[ReferenceAnalyzer] Falling back to legacy analyzer');
      return useLegacyAnalyzer(userPrompt, maxExamples);
    }
  }
  
  return useLegacyAnalyzer(userPrompt, maxExamples);
}

/**
 * Use legacy Python analyzer (keyword-based)
 */
function useLegacyAnalyzer(userPrompt, maxExamples) {
  try {
    const analyzerScript = path.join(__dirname, 'reference_analyzer.py');
    
    if (!fs.existsSync(analyzerScript)) {
      return { summary: '', method: 'none' };
    }
    
    const safeLegacyQuery = userPrompt
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/["'`$\\<>|&;]/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 300);

    const result = execSync(
      `python3 "${analyzerScript}" "${safeLegacyQuery}"`,
      {
        encoding: 'utf8',
        timeout: 20000,
        maxBuffer: 5 * 1024 * 1024,
      }
    );
    
    const lines = result.split('\n');
    let summary = '';
    let capture = false;
    
    for (const line of lines) {
      if (line.includes('REFERENCE EXAMPLES')) {
        capture = true;
      }
      if (capture) {
        summary += line + '\n';
      }
    }
    
    if (summary.trim()) {
      return { summary, method: 'keyword-legacy' };
    }
    
    return { summary: '', method: 'none' };
    
  } catch (err) {
    console.error('[ReferenceAnalyzer] Legacy analyzer error:', err.message);
    return { summary: '', method: 'none' };
  }
}

module.exports = { getRelevantExamples };
