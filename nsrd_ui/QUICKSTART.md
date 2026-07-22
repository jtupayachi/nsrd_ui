 rff# Quick Start Guide

## Getting Started in 3 Steps

### Step 1: Start the Application

**Option A: Using the start script (Recommended)**
```bash
./start.sh
```

**Option B: Using Docker Compose directly**
```bash
# Production mode
docker-compose up --build

# Development mode
docker-compose --profile dev up nsrd-ui-dev
```

### Step 2: Access the Application

- **Production**: http://localhost:3000
- **Development**: http://localhost:3001

### Step 3: Generate Your First App

1. **Upload a spec**: Drag and drop `sample-openapi.yaml` or your own OpenAPI specification
2. **Select a model**: Choose your preferred AI model (default: GPT-4)
3. **Set the port**: Configure where your app will run (default: 8000)
4. **Generate**: Click "Generate App" button
5. **Preview**: View your live application in the iframe!

## Sample OpenAPI Spec

A sample `sample-openapi.yaml` file is included for testing. It defines a simple Pet Store API with:
- GET /pets - List all pets
- POST /pets - Create a new pet
- GET /pets/{petId} - Get a specific pet

## Docker Commands Cheat Sheet

```bash
# Start production container
docker-compose up -d

# Start development container
docker-compose --profile dev up nsrd-ui-dev

# View logs
docker-compose logs -f

# Stop containers
docker-compose down

# Rebuild and restart
docker-compose up --build --force-recreate

# Remove all containers and volumes
docker-compose down -v

# Access container shell
docker exec -it nsrd-ui sh
```

## Development Workflow

1. **Make changes** to files in `src/`
2. **Changes auto-reload** in development mode
3. **Test locally** at http://localhost:3001
4. **Build for production** when ready:
   ```bash
   docker-compose build
   ```

## Customization

### Adding New AI Models

Edit `src/components/ModelSelector.tsx`:

```typescript
const AVAILABLE_MODELS: Model[] = [
  // ... existing models
  {
    id: 'your-model-id',
    name: 'Your Model Name',
    description: 'Model description',
    icon: '🤖'
  }
];
```

### Changing Ports

Edit `docker-compose.yml`:

```yaml
services:
  nsrd-ui:
    ports:
      - "YOUR_PORT:80"  # Change YOUR_PORT
```

### API Integration

Implement your backend API call in `src/App.tsx`:

```typescript
const handleGenerateApp = async () => {
  const response = await axios.post('/api/generate', {
    spec: uploadedSpec,
    model: selectedModel,
    port: appPort
  });
  setAppUrl(response.data.appUrl);
};
```

## Troubleshooting

### Port conflicts
```bash
# Check what's using port 3000
lsof -ti:3000

# Kill the process
kill -9 $(lsof -ti:3000)
```

### Container issues
```bash
# Clean restart
docker-compose down -v
docker-compose up --build
```

### Node modules issues (development)
```bash
# Rebuild without cache
docker-compose build --no-cache
```

## Next Steps

1. ✅ Upload your OpenAPI specification
2. ✅ Select your AI model
3. ✅ Generate and preview your app
4. 🔄 Integrate with your backend API
5. 🚀 Deploy to production

## Support

- Documentation: See README.md
- Issues: Contact NSRD team
- Sample specs: Use `sample-openapi.yaml` for testing
