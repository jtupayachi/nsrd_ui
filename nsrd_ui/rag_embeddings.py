"""
RAG System with Semantic Embeddings and FAISS
Extracts code patterns and visual styles from reference codebases
Uses sentence-transformers for semantic search
"""

import os
import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
import numpy as np

try:
    from sentence_transformers import SentenceTransformer
    import faiss
    EMBEDDINGS_AVAILABLE = True
except ImportError:
    EMBEDDINGS_AVAILABLE = False
    print("[RAG] Warning: sentence-transformers or faiss not available")

# Check if running in Docker
if os.path.exists('/reference-codebases'):
    REFERENCE_DIR = Path('/reference-codebases')
else:
    REFERENCE_DIR = Path('/home/jose/nsrd_ornl/reference-codebases')

CACHE_DIR = Path('/app/.cache') if os.path.exists('/app') else Path('.cache')
CACHE_DIR.mkdir(exist_ok=True)

INDEX_FILE = CACHE_DIR / 'faiss_index.bin'
METADATA_FILE = CACHE_DIR / 'code_metadata.json'

class CodeRAG:
    """RAG system for code retrieval with semantic search"""
    
    def __init__(self, model_name='all-MiniLM-L6-v2'):
        """Initialize RAG system with embedding model"""
        if not EMBEDDINGS_AVAILABLE:
            raise RuntimeError("sentence-transformers and faiss are required")
        
        print(f"[RAG] Loading embedding model: {model_name}")
        self.model = SentenceTransformer(model_name)
        self.index = None
        self.metadata = []
        self.embedding_dim = 384  # for all-MiniLM-L6-v2
        
    def extract_code_chunks(self, file_path: Path, max_chunk_size: int = 800) -> List[Dict[str, Any]]:
        """
        Extract meaningful code chunks from a file
        Captures components, functions, styles, and patterns
        """
        try:
            content = file_path.read_text(encoding='utf-8', errors='ignore')
            lines = content.split('\n')
            
            # Skip very large or very small files
            if len(lines) < 10 or len(lines) > 2000:
                return []
            
            chunks = []
            
            # Special case: files inside fixes/ or nsrd/ are stored as a single whole-file
            # chunk so the JSDoc comment header (containing domain vocabulary + user query phrases)
            # is always embedded in the FAISS vector.
            if 'fixes' in file_path.parts or 'nsrd' in file_path.parts:
                chunks.append({
                    'text': content[:max_chunk_size * 2],
                    'type': 'fix-example',
                    'name': file_path.stem,
                    'file': str(file_path.relative_to(REFERENCE_DIR)),
                    'project': file_path.parts[-5] if len(file_path.parts) > 5 else 'unknown'
                })
                return chunks

            # Extract component definitions
            component_pattern = r'(?:export\s+)?(?:default\s+)?(?:function|const|class)\s+(\w+)\s*[=:(<]'
            for match in re.finditer(component_pattern, content):
                start_pos = match.start()
                # Include the leading block comment (/** ... */) if it immediately precedes this match
                comment_start = start_pos
                pre = content[:start_pos].rstrip()
                cm = re.search(r'/\*\*[\s\S]*?\*/', pre)
                if cm and pre[cm.end():].strip() == '':
                    comment_start = cm.start()
                # Find end of component (rough heuristic)
                end_pos = min(start_pos + max_chunk_size, len(content))
                chunk_text = content[comment_start:end_pos]
                
                chunks.append({
                    'text': chunk_text,
                    'type': 'component',
                    'name': match.group(1),
                    'file': str(file_path.relative_to(REFERENCE_DIR)),
                    'project': file_path.parts[-5] if len(file_path.parts) > 5 else 'unknown'
                })
            
            # Extract styled-components and CSS-in-JS
            styled_pattern = r'(?:const|export\s+const)\s+(\w+)\s*=\s*styled\.\w+`([^`]{50,800})`'
            for match in re.finditer(styled_pattern, content, re.DOTALL):
                chunks.append({
                    'text': match.group(0),
                    'type': 'styled-component',
                    'name': match.group(1),
                    'styles': match.group(2),
                    'file': str(file_path.relative_to(REFERENCE_DIR)),
                    'project': file_path.parts[-5] if len(file_path.parts) > 5 else 'unknown'
                })
            
            # Extract CSS modules and plain CSS
            if file_path.suffix == '.css':
                css_rules = re.findall(r'([.#][\w-]+\s*{[^}]{50,600}})', content, re.DOTALL)
                for rule in css_rules:
                    chunks.append({
                        'text': rule,
                        'type': 'css',
                        'name': file_path.stem,
                        'file': str(file_path.relative_to(REFERENCE_DIR)),
                        'project': file_path.parts[-5] if len(file_path.parts) > 5 else 'unknown'
                    })
            
            # Extract hook definitions
            hook_pattern = r'(?:export\s+)?(?:const|function)\s+(use[A-Z]\w+)\s*[=(<]'
            for match in re.finditer(hook_pattern, content):
                start_pos = match.start()
                end_pos = min(start_pos + max_chunk_size, len(content))
                chunk_text = content[start_pos:end_pos]
                
                chunks.append({
                    'text': chunk_text,
                    'type': 'hook',
                    'name': match.group(1),
                    'file': str(file_path.relative_to(REFERENCE_DIR)),
                    'project': file_path.parts[-5] if len(file_path.parts) > 5 else 'unknown'
                })
            
            # If no specific patterns found, take first N chars as chunk
            if not chunks and len(content) > 200:
                chunks.append({
                    'text': content[:max_chunk_size],
                    'type': 'general',
                    'name': file_path.stem,
                    'file': str(file_path.relative_to(REFERENCE_DIR)),
                    'project': file_path.parts[-5] if len(file_path.parts) > 5 else 'unknown'
                })
            
            return chunks
            
        except Exception as e:
            print(f"[RAG] Error processing {file_path}: {e}")
            return []
    
    def find_files(self, max_files: int = 300) -> List[Path]:
        """Find all React/TS/JS/CSS files in reference codebases"""
        extensions = {'.tsx', '.jsx', '.ts', '.js', '.css'}
        exclude_dirs = {'node_modules', '.git', 'dist', 'build', 'coverage', '.next', 'out', '.cache', '__pycache__'}
        
        files = []
        for root, dirs, filenames in os.walk(REFERENCE_DIR):
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            
            for filename in filenames:
                if Path(filename).suffix in extensions:
                    file_path = Path(root) / filename
                    files.append(file_path)
                    if len(files) >= max_files:
                        return files
        
        return files
    
    def build_index(self, force_rebuild: bool = False):
        """Build FAISS index from reference codebases"""
        
        # Load existing index if available
        if not force_rebuild and INDEX_FILE.exists() and METADATA_FILE.exists():
            print(f"[RAG] Loading existing index from {INDEX_FILE}")
            self.index = faiss.read_index(str(INDEX_FILE))
            with open(METADATA_FILE, 'r') as f:
                self.metadata = json.load(f)
            print(f"[RAG] Loaded {len(self.metadata)} code chunks")
            return
        
        print("[RAG] Building new FAISS index...")
        
        if not REFERENCE_DIR.exists():
            print(f"[RAG] Reference directory not found: {REFERENCE_DIR}")
            return
        
        # Find all files
        files = self.find_files(max_files=300)
        print(f"[RAG] Found {len(files)} files to process")
        
        # Extract chunks from all files
        all_chunks = []
        for i, file_path in enumerate(files):
            if i % 50 == 0:
                print(f"[RAG] Processing file {i}/{len(files)}")
            
            chunks = self.extract_code_chunks(file_path)
            all_chunks.extend(chunks)
        
        print(f"[RAG] Extracted {len(all_chunks)} code chunks")
        
        if not all_chunks:
            print("[RAG] No chunks found, cannot build index")
            return
        
        # Create embeddings
        print("[RAG] Generating embeddings...")
        texts = [chunk['text'] for chunk in all_chunks]
        embeddings = self.model.encode(texts, show_progress_bar=True, batch_size=32)
        
        # Build FAISS index
        print("[RAG] Building FAISS index...")
        self.index = faiss.IndexFlatL2(self.embedding_dim)
        self.index.add(embeddings.astype('float32'))
        
        # Save metadata
        self.metadata = all_chunks
        
        # Persist to disk
        faiss.write_index(self.index, str(INDEX_FILE))
        with open(METADATA_FILE, 'w') as f:
            json.dump(self.metadata, f)
        
        print(f"[RAG] Index saved to {INDEX_FILE}")
        print(f"[RAG] Total chunks indexed: {len(self.metadata)}")
    
    def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Semantic search for relevant code examples
        
        Args:
            query: User requirements or search query
            top_k: Number of results to return
            
        Returns:
            List of relevant code chunks with metadata
        """
        if self.index is None or not self.metadata:
            print("[RAG] Index not loaded, building now...")
            self.build_index()
        
        if self.index is None:
            return []
        
        # Generate query embedding
        query_embedding = self.model.encode([query], show_progress_bar=False)
        
        # Search FAISS index
        distances, indices = self.index.search(query_embedding.astype('float32'), top_k)
        
        # Collect results
        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx < len(self.metadata):
                result = self.metadata[idx].copy()
                result['similarity_score'] = float(1 / (1 + dist))  # Convert distance to similarity
                results.append(result)
        
        return results
    
    def get_examples_for_prompt(self, user_requirements: str, max_examples: int = 3) -> str:
        """
        Get formatted code examples for LLM prompt.

        FAISS does chunk-level matching (precise), but we return the FULL source
        file for each unique match so the model sees a complete, runnable component
        rather than an 800-char fragment.  Files are deduplicated — if multiple
        chunks from the same file score highly, the file is only shown once.

        Args:
            user_requirements: User's natural language requirements
            max_examples: Maximum number of *unique files* to include
            
        Returns:
            Formatted string with complete file contents
        """
        # Over-fetch chunks so we can deduplicate to max_examples unique files
        results = self.search(user_requirements, top_k=max_examples * 4)

        if not results:
            return ''

        # Deduplicate: keep the highest-scoring chunk per file path
        seen_files = {}
        for r in results:
            fp = r.get('file', '')
            if fp not in seen_files or r['similarity_score'] > seen_files[fp]['similarity_score']:
                seen_files[fp] = r

        # Sort by score descending, take top max_examples files
        top = sorted(seen_files.values(), key=lambda x: x['similarity_score'], reverse=True)[:max_examples]

        prompt = 'REFERENCE EXAMPLES (semantic search):\n\n'

        for i, example in enumerate(top, 1):
            rel_path = example.get('file', '')
            score = example['similarity_score']
            etype = example.get('type', 'component')
            name = example.get('name', rel_path)

            prompt += f"Example {i} ({etype}): {name}\n"
            prompt += f"Project: {example.get('project', 'unknown')}\n"
            prompt += f"File: {rel_path}\n"
            prompt += f"Similarity: {score:.2f}\n"
            prompt += "Code:\n"

            # Try to read the complete source file from disk
            full_content = None
            if rel_path:
                abs_path = REFERENCE_DIR / rel_path
                try:
                    full_content = abs_path.read_text(encoding='utf-8', errors='ignore')
                except Exception:
                    full_content = None

            if full_content:
                # Cap at 8000 chars — enough for the core structure of any
                # golden-example template (the full file is injected inline
                # by buildChatMessages when needed for code generation).
                MAX_FILE_CHARS = 8000
                if len(full_content) <= MAX_FILE_CHARS:
                    prompt += full_content
                else:
                    prompt += full_content[:MAX_FILE_CHARS] + f'\n... (truncated — {len(full_content)} chars total)\n'
            else:
                # Fallback: use stored chunk text
                prompt += example['text']

            prompt += '\n\n'

        return prompt


# Global instance
_rag_instance = None

def get_rag_instance():
    """Get or create global RAG instance"""
    global _rag_instance
    if _rag_instance is None and EMBEDDINGS_AVAILABLE:
        _rag_instance = CodeRAG()
        _rag_instance.build_index()
    return _rag_instance


def get_relevant_examples_rag(user_requirements: str, max_examples: int = 3) -> Dict[str, Any]:
    """
    Get relevant code examples using RAG (for compatibility with existing code)
    
    Args:
        user_requirements: User's natural language requirements
        max_examples: Maximum number of examples to return
        
    Returns:
        Dict with 'summary' string and metadata
    """
    try:
        rag = get_rag_instance()
        if rag is None:
            return {'summary': '', 'method': 'fallback'}
        
        summary = rag.get_examples_for_prompt(user_requirements, max_examples)
        
        return {
            'summary': summary,
            'method': 'semantic-rag',
            'examples_count': max_examples
        }
    except Exception as e:
        print(f"[RAG] Error: {e}")
        return {'summary': '', 'method': 'error', 'error': str(e)}


if __name__ == '__main__':
    """CLI interface for testing and building index"""
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == '--build':
        print("Building FAISS index...")
        rag = CodeRAG()
        rag.build_index(force_rebuild=True)
        print("Done!")
    elif len(sys.argv) > 1:
        query = ' '.join(sys.argv[1:])
        result = get_relevant_examples_rag(query, max_examples=3)
        if result.get('summary'):
            print(result['summary'])
        else:
            print("No results found.")
    else:
        print("Usage:")
        print("  python rag_embeddings.py --build           # Build FAISS index")
        print("  python rag_embeddings.py 'query text'      # Search for examples")
