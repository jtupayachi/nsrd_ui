#!/usr/bin/env python3
"""
Persistent RAG HTTP microservice.

Loads the embedding model + FAISS index ONCE at startup, then answers
search queries at near-zero latency (no per-call model reload).

Endpoints:
  GET /health              → 200  "ok"
  GET /search?q=...&n=3   → 200  {"summary": "...", "method": "semantic-rag"}

Start via docker-start.sh before node.  Node calls via wget (already in image).
"""

import sys
import os
import json
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler

# Co-located rag_embeddings.py is the source of truth for the RAG logic
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rag_embeddings import get_relevant_examples_rag, get_rag_instance

PORT = int(os.environ.get('RAG_PORT', '5001'))


class RAGHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path == '/health':
            self._respond(200, b'ok', 'text/plain')
            return

        if parsed.path == '/search':
            params = urllib.parse.parse_qs(parsed.query)
            query = params.get('q', [''])[0].strip()
            n = max(1, min(int(params.get('n', ['3'])[0]), 10))

            if not query:
                self._json(400, {'error': 'missing q parameter'})
                return

            result = get_relevant_examples_rag(query, max_examples=n)
            self._json(200, result)
            return

        self._respond(404, b'not found', 'text/plain')

    def _json(self, code, data):
        body = json.dumps(data).encode()
        self._respond(code, body, 'application/json')

    def _respond(self, code, body, content_type):
        self.send_response(code)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass  # silence per-request access logs — keep container output clean


if __name__ == '__main__':
    print('[RAGServer] Loading embedding model + FAISS index…', flush=True)
    rag = get_rag_instance()   # warm-up: loads sentence-transformers model once
    chunk_count = len(rag.metadata) if rag else 0
    if chunk_count:
        print(f'[RAGServer] {chunk_count} chunks ready', flush=True)
    else:
        print('[RAGServer] WARNING: no chunks loaded — /search will return empty results', flush=True)

    server = HTTPServer(('127.0.0.1', PORT), RAGHandler)
    print(f'[RAGServer] Listening on 127.0.0.1:{PORT}', flush=True)
    server.serve_forever()
