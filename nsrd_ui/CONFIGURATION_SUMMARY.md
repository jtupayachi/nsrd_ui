# NSRD UI Configuration Summary

## What Was Changed

### ✅ Removed from UI
1. **Target Server selector** - Now uses `https://demo2.recoil.ise.utk.edu` internally
2. **App Port input** - Port management is handled internally by the server

### ✅ Added Features
1. **Multiple File Type Support**
   - OpenAPI specifications (.json, .yaml, .yml)
   - CSV files (.csv)
   - Plain text files (.txt)

2. **Plain Text Requirements Input**
   - Large textarea for entering application requirements
   - Can be used alone or with uploaded files

3. **SVG Generation**
   - New button to generate SVG diagrams
   - Uses Ollama AI models for generation
   - Shows SVG output visually and as code

4. **File Management**
   - Display all uploaded files with type indicators
   - Remove individual files
   - Support for multiple file uploads

### ✅ Updated Model Configuration
Now uses **Ollama Server** at `https://ollama.viridian.ise.utk.edu`:

**Authentication:**
```python
OLLAMA_HOST = "https://ollama.viridian.ise.utk.edu"
USERNAME = "ollama_user"
PASSWORD = "ollama4Viridian"
```

**Available Models:**
- Llama 2 (default)
- Llama 3
- Mistral
- Code Llama
- DeepSeek Coder
- Phi

## Files Modified

1. **src/App.tsx**
   - Removed server/port configuration UI
   - Added support for multiple file types
   - Added plain text requirements state
   - Added SVG generation functionality
   - Updated to use Ollama API with authentication

2. **src/components/FileUpload.tsx**
   - Added CSV file detection and parsing
   - Enhanced file type detection
   - Updated file acceptance list

3. **src/components/ModelSelector.tsx**
   - Updated model list to Ollama models
   - Updated descriptions and icons

4. **src/App.css**
   - Added styles for file list display
   - Added plain text textarea styles
   - Added SVG output section styles
   - Enhanced button styles

## How It Works Now

### User Flow:
1. **Step 1: Upload Files** (Optional)
   - Drag & drop or browse for files
   - Supports OpenAPI, CSV, and text files
   - See list of uploaded files with option to remove

2. **Step 2: Enter Requirements** (Optional)
   - Type plain text requirements in the textarea
   - Can describe what you want the app to do

3. **Step 3: Select Model**
   - Choose from Ollama-hosted AI models
   - Different models optimized for different tasks

4. **Step 4: Generate**
   - Click "Generate Application" for full app
   - Click "Generate SVG Diagram" for visual output
   - View results in the preview section

### Technical Flow:
```
Frontend (React) → Ollama API (with Basic Auth) → AI Model → Response
                ↓
         Display Results
```

## API Calls

### Generate Application:
```javascript
POST https://ollama.viridian.ise.utk.edu/api/generate
Headers:
  Authorization: Basic b2xsYW1hX3VzZXI6b2xsYW1hNFZpcmlkaWFu
  Content-Type: application/json
Body:
{
  "model": "llama2",
  "prompt": "Generate application code based on...",
  "stream": false
}
```

### Generate SVG:
```javascript
POST https://ollama.viridian.ise.utk.edu/api/generate
Headers:
  Authorization: Basic b2xsYW1hX3VzZXI6b2xsYW1hNFZpcmlkaWFu
  Content-Type: application/json
Body:
{
  "model": "llama2",
  "prompt": "Generate an SVG diagram based on...",
  "stream": false
}
```

## Quick Start

```bash
# Navigate to the project
cd /home/jose/nsrd_ornl/nsrd_ui

# Install dependencies (if needed)
npm install

# Start development server
npm start

# Build for production
npm run build
```

## Example Usage

### Upload a CSV File:
```csv
location,freight_volume,date
Nashville,1500,2024-01-01
Memphis,2000,2024-01-01
```

### Enter Plain Text Requirements:
```
Create a dashboard that:
- Shows a map with freight locations
- Displays volume data from the CSV
- Includes date filtering
- Has a summary statistics panel
```

### Select Model:
- Choose "Llama 2" or "Code Llama" for code generation
- Choose "DeepSeek Coder" for more specialized code tasks

### Generate:
- Click "Generate Application" to create the full app
- Click "Generate SVG Diagram" to create a visual diagram

## Important Notes

⚠️ **Security:** Ollama credentials are currently in the frontend code. For production, these should be moved to a backend service.

✅ **CORS:** All requests use HTTPS and proper authentication headers.

✅ **File Size:** No explicit file size limits, but consider adding them for production use.

✅ **Error Handling:** Comprehensive error handling with user-friendly messages.

## Next Steps

Consider:
1. Moving Ollama credentials to backend API
2. Adding file size limits
3. Implementing request caching
4. Adding download buttons for generated content
5. Implementing real-time streaming for AI responses
6. Adding more file format support (Excel, XML, etc.)
