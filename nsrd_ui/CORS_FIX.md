# CORS Fix - Backend Proxy Implementation

## Problem
The frontend was trying to connect directly to the Viridian Ollama server from the browser, which caused CORS (Cross-Origin Resource Sharing) errors. Browsers block these requests for security reasons.

## Solution
Created a Node.js backend proxy server that:
1. Runs on port 3001
2. Proxies requests to the Viridian Ollama server
3. Handles authentication with Viridian
4. Serves as a bridge between the frontend and Ollama

## Files Created/Modified

### New Files:
1. **server.js** - Node.js Express backend proxy
   - `/api/ollama/tags` - Get available models
   - `/api/ollama/generate` - Generate text with Ollama
   - Handles authentication to Viridian server

2. **nginx.conf** - Nginx configuration
   - Serves React app on port 80
   - Proxies `/api/*` requests to backend on port 3001

3. **docker-start.sh** - Docker startup script
   - Starts Node.js backend
   - Starts Nginx server

### Modified Files:
1. **Dockerfile** - Updated to include both nginx and node
2. **src/components/ModelSelector.tsx** - Now calls backend API instead of direct Viridian
3. **src/App.tsx** - Updated to use backend proxy for generation
4. **.env.example** - Added BACKEND_URL configuration

## How It Works

```
Browser → Nginx (port 80) → Backend Proxy (port 3001) → Viridian Ollama Server
```

1. Frontend makes request to `/api/ollama/tags`
2. Nginx proxies to `http://localhost:3001/api/ollama/tags`
3. Backend proxy adds authentication and forwards to Viridian
4. Response flows back through the chain

## Running the Application

### Development (Local):
```bash
# Terminal 1: Start backend
node server.js

# Terminal 2: Start React
npm start
```

### Production (Docker):
```bash
docker compose down
docker compose build
docker compose up -d
```

The app will be available at `http://localhost` (port 80)

## Features
- ✅ Real connection to Viridian Ollama server
- ✅ Shows only models actually available on the server
- ✅ Server status indicator with real-time checking
- ✅ Fallback models when backend is unavailable
- ✅ OpenAI and Anthropic API key fields
- ✅ Light Apple-inspired theme

## Next Steps
To test if it works:
1. Rebuild Docker: `docker compose build`
2. Start containers: `docker compose up -d`
3. Check backend logs: `docker compose logs -f`
4. Open browser: `http://localhost`
