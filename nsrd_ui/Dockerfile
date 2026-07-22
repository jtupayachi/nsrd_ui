FROM node:18-slim

WORKDIR /app

# Install Python 3 and build dependencies for FAISS
RUN apt-get update && apt-get install -y \
    wget \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/projects

# Install Python ML libraries for RAG
RUN pip3 install --break-system-packages --no-cache-dir \
    sentence-transformers \
    faiss-cpu \
    numpy

# Pre-install node deps so they're baked into the image
COPY package*.json ./
RUN npm install

# Copy sanitizer (needed by pipeline at runtime)
COPY sanitizer.js /app/sanitizer.js
COPY langchain_agent.js /app/langchain_agent.js

# Copy Vite+React template and pre-install its deps (including Tailwind v3)
# (so project deploys are fast — just symlink node_modules)
COPY templates/ /app/templates/
RUN cd /app/templates/react-app && NODE_ENV=development npm install

EXPOSE 80

CMD ["sh", "/app/docker-start.sh"]
