# NSRD GIS Builder — Deployment Guide

Deployment instructions for the **NSRD GIS Builder** prototype
(`jtupayac/nsrd-ui`), a self-contained, multi-page React app generator built at
Oak Ridge National Laboratory.

---

## 1. What is in the image

The published image is **fully self-contained** — a single `docker run` boots
the entire prototype with no bind mounts and no build step:

| Component | Baked into image |
|-----------|:----------------:|
| Express API + generation pipeline (`server.js`, `pipeline.js`) | ✅ |
| Python RAG engine (`rag_server.py`, `rag_embeddings.py`) | ✅ |
| Production React build of the builder UI (`/app/build`) | ✅ |
| Vite + React project template (Tailwind, PostCSS pre-installed) | ✅ |
| Reference codebases used by RAG (`/reference-codebases`) | ✅ |
| Sentence-transformers embedding model (`all-MiniLM-L6-v2`) | ✅ |
| Pre-built FAISS index (270 code chunks, warm start) | ✅ |

**Image:** `docker.io/jtupayac/nsrd-ui:latest`
**Exposed port:** `80` (HTTP)
**Only external dependency:** the Viridian **Ollama** LLM endpoint used for code
generation (`https://ollama.viridian.ise.utk.edu`). Everything else runs offline
inside the container.

---

## 2. Prerequisites

- Docker Engine 20.10+ (or Docker Desktop)
- Outbound HTTPS access to the Ollama endpoint (for actual app generation)
- ~7 GB free disk for the image

---

## 3. Quick start (pull & run)

```bash
# Pull the published image
docker pull jtupayac/nsrd-ui:latest

# Run it, mapping host port 8432 → container port 80
docker run -d \
  --name nsrd-ui \
  -p 8432:80 \
  --restart unless-stopped \
  jtupayac/nsrd-ui:latest
```

Open the app at **http://localhost:8432**.

First boot takes ~6–10 s while the RAG server loads the baked-in FAISS index
(watch `docker logs -f nsrd-ui` for `✅ RAG server ready`).

---

## 4. Health checks

```bash
# Builder API (should return JSON status ok)
curl http://localhost:8432/health

# RAG embedding server (inside the container, should print "ok")
docker exec nsrd-ui wget -qO- http://127.0.0.1:5001/health
```

Expected:

```json
{"status":"ok","message":"Backend proxy server is running"}
```

---

## 5. Persisting generated projects (optional)

Generated projects live at `/app/projects` inside the container. To keep them
across container recreation, mount a named volume:

```bash
docker run -d \
  --name nsrd-ui \
  -p 8432:80 \
  -v nsrd_projects:/app/projects \
  --restart unless-stopped \
  jtupayac/nsrd-ui:latest
```

---

## 6. docker-compose (production, behind nginx-proxy)

The repository ships a `docker-compose.yml` wired for an
[`nginx-proxy`](https://github.com/nginx-proxy/nginx-proxy) +
Let's Encrypt reverse proxy. To deploy the **self-contained image** with that
proxy, use this minimal override:

```yaml
services:
  nsrd-ui:
    image: jtupayac/nsrd-ui:latest
    container_name: nsrd-ui
    ports:
      - "8432:80"
    environment:
      - NODE_ENV=production
      - VIRTUAL_HOST=demo2.recoil.ise.utk.edu
      - VIRTUAL_PORT=80
      - LETSENCRYPT_HOST=demo2.recoil.ise.utk.edu
      - LETSENCRYPT_EMAIL=jtupayac@vols.utk.edu
    volumes:
      - nsrd_projects:/app/projects
    networks:
      - default
      - nsrd-network
    restart: unless-stopped

volumes:
  nsrd_projects:

networks:
  nsrd-network:
    external: true
    name: nginx-proxy
```

```bash
docker compose up -d
```

> The bind-mount-heavy `docker-compose.yml` in the repo root is for **local
> development** (live source editing). For deployment, prefer the published
> image as shown above so nothing depends on host paths.

---

## 7. Configuration reference

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `80` | Express listen port inside the container |
| `RAG_PORT` | `5001` | Internal RAG embedding server port |
| `NODE_ENV` | `production` | Node runtime mode |
| `VIRTUAL_HOST` / `VIRTUAL_PORT` | — | nginx-proxy routing (optional) |
| `LETSENCRYPT_HOST` / `LETSENCRYPT_EMAIL` | — | TLS via acme-companion (optional) |

The Ollama endpoint and credentials are configured in `server.js`
(`OLLAMA_HOST`). To point at a different LLM gateway, rebuild with an edited
`server.js` or fork the config.

---

## 8. Rebuilding the self-contained image

From the `nsrd_ui/` directory (the build stages the reference codebases and
builds the React bundle + FAISS index):

```bash
# Stage reference codebases into the build context
cp -r ../reference-codebases ./reference-codebases

# Build the self-contained image
docker build -f Dockerfile.hub -t jtupayac/nsrd-ui:latest .

# Push to Docker Hub
docker login
docker push jtupayac/nsrd-ui:latest
```

`Dockerfile.hub` differs from the dev `Dockerfile` by baking in source, the
React build, reference codebases, the embedding model, and a pre-built FAISS
index so the image needs no bind mounts.

---

## 9. Operations cheat sheet

```bash
docker logs -f nsrd-ui            # follow startup + request logs
docker exec -it nsrd-ui sh        # shell into the container
docker restart nsrd-ui            # restart
docker stop nsrd-ui               # stop
docker rm -f nsrd-ui              # remove (keeps the image)
docker pull jtupayac/nsrd-ui:latest && \
  docker rm -f nsrd-ui && \
  docker run -d --name nsrd-ui -p 8432:80 --restart unless-stopped \
    jtupayac/nsrd-ui:latest       # update to the latest image
```

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| UI loads but "Generate" fails | Ollama endpoint unreachable | Verify outbound HTTPS to `ollama.viridian.ise.utk.edu` |
| No models in the Thinker/Coder dropdowns | Ollama `/api/tags` failed | Check `docker logs nsrd-ui` for the fetch error |
| RAG falls back to keyword search | FAISS index missing | Confirm `/app/.cache/faiss_index.bin` exists in the container |
| Port already in use | `8432` taken on host | Map a different host port, e.g. `-p 9000:80` |

See also the [User Guide](../user-guide/USER_GUIDE.md).
