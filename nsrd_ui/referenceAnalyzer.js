const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Check if running in Docker
const REFERENCE_DIR = fs.existsSync('/reference-codebases') 
  ? '/reference-codebases'
  : '/home/jose/nsrd_ornl/reference-codebases';
const USE_PYTHON = true; // Set to true to use Python analyzer (faster, more accurate)

/**
 * Recursively find files matching extensions
 */
function findFiles(dir, extensions, maxDepth = 5, currentDepth = 0) {
  if (currentDepth > maxDepth) return [];
  
  const files = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      // Skip common folders
      if (entry.isDirectory()) {
        if (['node_modules', '.git', 'dist', 'build', 'coverage', '.next'].includes(entry.name)) {
          continue;
        }
        files.push(...findFiles(fullPath, extensions, maxDepth, currentDepth + 1));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (err) {
    // Skip inaccessible directories
  }
  
  return files;
}

/**
 * Extract component name from file path
 */
function getComponentName(filePath) {
  const basename = path.basename(filePath, path.extname(filePath));
  return basename;
}

/**
 * Read and analyze a component file
 */
function analyzeComponent(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').length;
    
    // Extract imports
    const imports = [];
    const importRegex = /import\s+(?:{[^}]+}|\w+|\*\s+as\s+\w+)\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    // Check for common patterns
    const patterns = {
      hasRouter: /react-router|useNavigate|useParams|Route|BrowserRouter/i.test(content),
      hasState: /useState|useReducer|Redux/i.test(content),
      hasEffects: /useEffect|useLayoutEffect/i.test(content),
      hasContext: /useContext|createContext|Context\.Provider/i.test(content),
      hasAPI: /fetch|axios|api\.|endpoint/i.test(content),
      hasForm: /form|input|onSubmit|onChange/i.test(content),
      hasMap: /Map|Leaflet|Mapbox|ArcGIS|GoogleMap/i.test(content),
      hasChart: /Chart|recharts|d3|plotly|canvas/i.test(content),
      hasCSS: /\.css|styled|emotion|className/i.test(content),
    };
    
    return {
      path: filePath,
      name: getComponentName(filePath),
      lines,
      imports: imports.slice(0, 10), // Limit to first 10
      patterns,
      snippet: content.slice(0, 500), // First 500 chars
    };
  } catch (err) {
    return null;
  }
}

/**
 * Get reference examples based on user requirements
 */
function getRelevantExamples(userPrompt, maxExamples = 3) {
  console.log('[ReferenceAnalyzer] Scanning reference codebases...');
  
  if (!fs.existsSync(REFERENCE_DIR)) {
    console.log('[ReferenceAnalyzer] Reference directory not found');
    return { examples: [], summary: '' };
  }
  
  // Use Python analyzer if enabled (faster and more accurate)
  if (USE_PYTHON) {
    try {
      const pythonScript = path.join(__dirname, 'reference_analyzer.py');
      const cmd = `python3 ${pythonScript} "${userPrompt.replace(/"/g, '\\"')}"`;
      const result = execSync(cmd, { 
        encoding: 'utf8',
        timeout: 10000,
        maxBuffer: 10 * 1024 * 1024 // 10MB
      });
      
      // Extract JSON from output (after the analysis results header)
      const match = result.match(/ANALYSIS RESULTS[\s\S]*?Total scored: \d+[\s\S]*?(REFERENCE EXAMPLES:[\s\S]*)/);
      if (match) {
        const summary = match[1].trim();
        console.log('[ReferenceAnalyzer] Python analyzer completed');
        return { examples: [], summary };
      }
    } catch (err) {
      console.log('[ReferenceAnalyzer] Python analyzer failed, falling back to JS:', err.message);
    }
  }
  
  // Fallback to JavaScript implementation
  // Find all React/TS files
  const extensions = ['.tsx', '.jsx', '.ts', '.js'];
  const allFiles = findFiles(REFERENCE_DIR, extensions);
  
  console.log(`[ReferenceAnalyzer] Found ${allFiles.length} files`);
  
  // Analyze a subset (to avoid slowdown)
  const sampleSize = Math.min(100, allFiles.length);
  const sampled = [];
  for (let i = 0; i < sampleSize; i++) {
    const idx = Math.floor(Math.random() * allFiles.length);
    sampled.push(allFiles[idx]);
  }
  
  const analyzed = sampled
    .map(analyzeComponent)
    .filter(Boolean)
    .filter(comp => comp.lines > 20 && comp.lines < 500); // Reasonable size
  
  // Score components by relevance
  const prompt = userPrompt.toLowerCase();
  const scored = analyzed.map(comp => {
    let score = 0;
    
    // Pattern matching
    if (prompt.includes('map') || prompt.includes('geo') || prompt.includes('location')) {
      if (comp.patterns.hasMap) score += 10;
    }
    if (prompt.includes('chart') || prompt.includes('graph') || prompt.includes('visual')) {
      if (comp.patterns.hasChart) score += 10;
    }
    if (prompt.includes('form') || prompt.includes('input') || prompt.includes('submit')) {
      if (comp.patterns.hasForm) score += 10;
    }
    if (prompt.includes('api') || prompt.includes('data') || prompt.includes('fetch')) {
      if (comp.patterns.hasAPI) score += 8;
    }
    if (prompt.includes('route') || prompt.includes('page') || prompt.includes('navigation')) {
      if (comp.patterns.hasRouter) score += 8;
    }
    
    // General patterns (always useful)
    if (comp.patterns.hasState) score += 3;
    if (comp.patterns.hasEffects) score += 2;
    if (comp.patterns.hasContext) score += 2;
    
    // File name relevance
    const nameMatch = prompt.split(' ').some(word => 
      comp.name.toLowerCase().includes(word) || word.includes(comp.name.toLowerCase())
    );
    if (nameMatch) score += 5;
    
    return { ...comp, score };
  });
  
  // Sort and take top examples
  const topExamples = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxExamples);
  
  console.log(`[ReferenceAnalyzer] Selected ${topExamples.length} relevant examples`);
  
  // Build summary text
  let summary = '';
  if (topExamples.length > 0) {
    summary = 'REFERENCE EXAMPLES:\n\n';
    topExamples.forEach((ex, idx) => {
      summary += `Example ${idx + 1}: ${ex.name}\n`;
      summary += `Patterns: ${Object.entries(ex.patterns).filter(([k, v]) => v).map(([k]) => k).join(', ')}\n`;
      summary += `Code:\n${ex.snippet}\n...\n\n`;
    });
  }
  
  return {
    examples: topExamples,
    summary,
  };
}

module.exports = {
  getRelevantExamples,
};
