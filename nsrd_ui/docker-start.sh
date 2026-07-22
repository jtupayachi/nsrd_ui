#!/bin/sh
set -e

echo "=========================================="
echo "  GIS Dashboard Builder"
echo "=========================================="

# ── 0. Ensure template devDependencies are installed ──
# NODE_ENV=production (set by docker-compose) skips devDeps; force them.
# Vite, Tailwind, PostCSS must be present for project builds to succeed.
if [ ! -f /app/templates/react-app/node_modules/.bin/vite ]; then
  echo ""
  echo "📦 Installing template devDependencies (Vite, Tailwind, PostCSS)..."
  cd /app/templates/react-app && NODE_ENV=development npm install --silent
  cd /app
  echo "✅ Template dependencies ready"
fi

# ── 1. Build React app (if build/ is empty) ───────
if [ ! -f /app/build/index.html ]; then
  echo ""
  echo "🏗️  Building React app from mounted source..."
  npx react-app-rewired build
  echo "✅ Build complete"
else
  echo "✅ Build found, skipping (delete volume to rebuild)"
fi

# ── 1.5. Start persistent RAG embedding server (loads model once, stays warm) ──
echo ""
echo "🧠 Starting RAG embedding server (port 5001)…"
python3 /app/rag_server.py &
RAG_PID=$!

# Wait up to 90 s for the model to load + index to be ready
RAG_READY=0
for i in $(seq 1 90); do
  if wget -q -O /dev/null http://127.0.0.1:5001/health 2>/dev/null; then
    RAG_READY=1
    echo "✅ RAG server ready (${i}s, PID $RAG_PID)"
    break
  fi
  sleep 1
done

if [ "$RAG_READY" = "0" ]; then
  echo "⚠️  RAG server did not start in 90 s — pipeline will fall back to keyword search"
fi

# ── 2. Start Express (serves static + API on port 80) ──
echo ""
echo "🚀 Starting server on port 80..."
echo "=========================================="
exec node server.js
