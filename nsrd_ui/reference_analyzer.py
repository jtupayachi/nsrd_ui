"""
Reference Codebase Analyzer for React/TS/JS Projects
Uses Python for AST parsing, semantic search, and pattern matching
Can be called from FastAPI backend or Node.js via subprocess
"""

import os
import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from collections import defaultdict

# Check if running in Docker
if os.path.exists('/reference-codebases'):
    REFERENCE_DIR = Path('/reference-codebases')
else:
    REFERENCE_DIR = Path('/home/jose/nsrd_ornl/reference-codebases')

# Pattern definitions for different React features
PATTERN_MATCHERS = {
    'hasRouter': re.compile(r'react-router|useNavigate|useParams|Route|BrowserRouter|Link', re.I),
    'hasState': re.compile(r'useState|useReducer|Redux|createSlice|configureStore', re.I),
    'hasEffects': re.compile(r'useEffect|useLayoutEffect|useCallback|useMemo', re.I),
    'hasContext': re.compile(r'useContext|createContext|Context\.Provider', re.I),
    'hasAPI': re.compile(r'fetch|axios|api\.|endpoint|useQuery|useMutation', re.I),
    'hasForm': re.compile(r'form|input|onSubmit|onChange|Formik|useForm', re.I),
    'hasMap': re.compile(r'Map|Leaflet|Mapbox|ArcGIS|GoogleMap|react-leaflet', re.I),
    'hasChart': re.compile(r'Chart|recharts|d3|plotly|canvas|visualization', re.I),
    'hasCSS': re.compile(r'\.css|styled|emotion|className|tailwind', re.I),
    'hasAuth': re.compile(r'auth|login|logout|jwt|token|session', re.I),
    'hasTable': re.compile(r'Table|DataGrid|ag-grid|react-table', re.I),
    'hasModal': re.compile(r'Modal|Dialog|Popup|overlay', re.I),
}

def find_react_files(max_files: int = 200) -> List[Path]:
    """Find all React/TS/JS files in reference codebases"""
    extensions = {'.tsx', '.jsx', '.ts', '.js'}
    exclude_dirs = {'node_modules', '.git', 'dist', 'build', 'coverage', '.next', 'out', '.cache'}
    
    files = []
    for root, dirs, filenames in os.walk(REFERENCE_DIR):
        # Skip excluded directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        
        for filename in filenames:
            if Path(filename).suffix in extensions:
                file_path = Path(root) / filename
                files.append(file_path)
                if len(files) >= max_files:
                    return files
    
    return files

def analyze_file(file_path: Path) -> Optional[Dict[str, Any]]:
    """Analyze a single React component file"""
    try:
        content = file_path.read_text(encoding='utf-8', errors='ignore')
        lines = content.count('\n') + 1
        
        # Skip very small or very large files
        if lines < 10 or lines > 1000:
            return None
        
        # Extract imports
        imports = []
        for match in re.finditer(r'import\s+(?:{[^}]+}|\w+|\*\s+as\s+\w+)\s+from\s+[\'"]([^\'"]+)[\'"]', content):
            imports.append(match.group(1))
        
        # Detect patterns
        patterns = {}
        for pattern_name, regex in PATTERN_MATCHERS.items():
            patterns[pattern_name] = bool(regex.search(content))
        
        # Extract component name
        component_name = file_path.stem
        
        # Get snippet (first 600 chars)
        snippet = content[:600]
        
        # Get relative path from reference dir
        try:
            rel_path = str(file_path.relative_to(REFERENCE_DIR))
        except ValueError:
            rel_path = str(file_path)
        
        return {
            'path': rel_path,
            'name': component_name,
            'lines': lines,
            'imports': imports[:15],  # Limit imports
            'patterns': patterns,
            'snippet': snippet,
            'project': file_path.parts[-5] if len(file_path.parts) > 5 else 'unknown'
        }
    
    except Exception as e:
        return None

def score_relevance(component: Dict[str, Any], user_requirements: str) -> int:
    """Score a component's relevance to user requirements"""
    score = 0
    prompt = user_requirements.lower()
    patterns = component['patterns']
    
    # Keyword-based scoring
    keyword_map = {
        ('map', 'geo', 'location', 'coordinates'): ('hasMap', 15),
        ('chart', 'graph', 'visual', 'plot', 'analytics'): ('hasChart', 12),
        ('form', 'input', 'submit', 'validation'): ('hasForm', 12),
        ('api', 'data', 'fetch', 'backend', 'server'): ('hasAPI', 10),
        ('route', 'page', 'navigation', 'link'): ('hasRouter', 10),
        ('auth', 'login', 'user', 'account'): ('hasAuth', 12),
        ('table', 'grid', 'list', 'data display'): ('hasTable', 10),
        ('modal', 'popup', 'dialog', 'overlay'): ('hasModal', 8),
    }
    
    for keywords, (pattern_name, points) in keyword_map.items():
        if any(kw in prompt for kw in keywords):
            if patterns.get(pattern_name):
                score += points
    
    # General patterns (always useful)
    if patterns.get('hasState'): score += 4
    if patterns.get('hasEffects'): score += 3
    if patterns.get('hasContext'): score += 2
    
    # Name relevance
    words = re.findall(r'\w+', prompt)
    for word in words:
        if len(word) > 3:  # Skip short words
            if word in component['name'].lower():
                score += 6
    
    return score

def get_relevant_examples(user_requirements: str, max_examples: int = 3) -> Dict[str, Any]:
    """
    Get relevant code examples from reference codebases
    
    Args:
        user_requirements: User's natural language requirements
        max_examples: Maximum number of examples to return
    
    Returns:
        Dict with 'examples' list and 'summary' string
    """
    print(f"[ReferenceAnalyzer] Scanning {REFERENCE_DIR}...")
    
    if not REFERENCE_DIR.exists():
        print(f"[ReferenceAnalyzer] Directory not found: {REFERENCE_DIR}")
        return {'examples': [], 'summary': ''}
    
    # Find and analyze files
    files = find_react_files(max_files=150)
    print(f"[ReferenceAnalyzer] Found {len(files)} React files")
    
    # Analyze files
    analyzed = []
    for file_path in files:
        result = analyze_file(file_path)
        if result:
            analyzed.append(result)
    
    print(f"[ReferenceAnalyzer] Analyzed {len(analyzed)} components")
    
    # Score and rank
    scored = []
    for component in analyzed:
        relevance_score = score_relevance(component, user_requirements)
        if relevance_score > 0:
            component['score'] = relevance_score
            scored.append(component)
    
    # Sort by score
    scored.sort(key=lambda x: x['score'], reverse=True)
    top_examples = scored[:max_examples]
    
    print(f"[ReferenceAnalyzer] Selected {len(top_examples)} top examples")
    
    # Build summary text
    summary = ''
    if top_examples:
        summary = 'REFERENCE EXAMPLES:\n\n'
        for idx, ex in enumerate(top_examples, 1):
            active_patterns = [k for k, v in ex['patterns'].items() if v]
            summary += f"Example {idx}: {ex['name']} (from {ex['project']})\n"
            summary += f"Patterns: {', '.join(active_patterns)}\n"
            summary += f"Code:\n{ex['snippet']}\n...\n\n"
    
    return {
        'examples': top_examples,
        'summary': summary,
        'total_analyzed': len(analyzed),
        'total_scored': len(scored)
    }

def main():
    """CLI interface for testing"""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python reference_analyzer.py '<user requirements>'")
        print("Example: python reference_analyzer.py 'Create a map with markers'")
        sys.exit(1)
    
    requirements = ' '.join(sys.argv[1:])
    result = get_relevant_examples(requirements, max_examples=3)
    
    print("\n" + "="*60)
    print("ANALYSIS RESULTS")
    print("="*60)
    print(f"Total analyzed: {result['total_analyzed']}")
    print(f"Total scored: {result['total_scored']}")
    print(f"Top examples: {len(result['examples'])}")
    print("\n" + result['summary'])

if __name__ == '__main__':
    main()
