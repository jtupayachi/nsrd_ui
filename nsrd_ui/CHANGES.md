# NSRD UI - Recent Changes

## Summary
Updated the NSRD UI application to remove user-configurable server settings and integrate with the Ollama AI model server for enhanced functionality.

## Major Changes

### 1. Removed User-Facing Configuration
- **Removed:** Target Server selector
- **Removed:** App Port input field
- **Reason:** These settings are now handled internally for better security and consistency

### 2. AI Model Integration
The app now connects to the Ollama server for AI-powered generation:
- **Server:** `https://ollama.viridian.ise.utk.edu`
- **Authentication:** HTTP Basic Auth (credentials managed internally)
- **Username:** `ollama_user`
- **Password:** `ollama4Viridian`

### 3. Updated Model Selection
Changed from generic AI models to Ollama-specific models:
- Llama 2
- Llama 3
- Mistral
- Code Llama
- DeepSeek Coder
- Phi

### 4. Enhanced File Upload Support
The application now supports multiple file types:
- **OpenAPI Specifications** (.json, .yaml, .yml)
- **CSV Files** (.csv) - NEW
- **Plain Text** (.txt) - NEW

### 5. Plain Text Requirements Input
Added a new textarea for users to enter application requirements in plain text format, allowing for more flexible input beyond structured file formats.

### 6. SVG Generation Feature
New capability to generate SVG diagrams based on:
- Uploaded files (OpenAPI, CSV, or text)
- Plain text requirements
- Selected AI model

### 7. Updated UI Components

#### App.tsx
- New state management for multiple file uploads
- Plain text requirements state
- SVG output state
- Two generation buttons (App and SVG)
- File removal functionality

#### FileUpload.tsx
- Enhanced file parsing to detect CSV files
- Automatic file type detection (OpenAPI, CSV, or plain text)
- Better error handling for different file formats
- Support for `.csv` file extension

#### ModelSelector.tsx
- Updated model list to reflect Ollama-hosted models
- New model descriptions and icons

#### App.css
- New styles for file list display
- Plain text textarea styling
- SVG output section styling
- Enhanced button styles for dual-action generation

## Internal Configuration

The following settings are now handled internally (not exposed to users):

```typescript
const DEMO_SERVER = 'https://demo2.recoil.ise.utk.edu';
const OLLAMA_HOST = 'https://ollama.viridian.ise.utk.edu';
const OLLAMA_USERNAME = 'ollama_user';
const OLLAMA_PASSWORD = 'ollama4Viridian';
```

## API Integration

### Application Generation
```typescript
POST https://ollama.viridian.ise.utk.edu/api/generate
Headers:
  - Content-Type: application/json
  - Authorization: Basic <base64(username:password)>
Body:
  {
    "model": "llama2",
    "prompt": "Generate application code based on...",
    "stream": false
  }
```

### SVG Generation
Same endpoint as above but with a different prompt focused on SVG diagram generation.

## User Workflow

1. **Upload Files** (Optional)
   - Upload OpenAPI specs, CSV files, or text files
   - View uploaded files with type indicators
   - Remove files as needed

2. **Enter Requirements** (Optional)
   - Provide plain text requirements in the textarea
   - Can be used alone or in combination with file uploads

3. **Select Model**
   - Choose from available Ollama models
   - Models are optimized for different tasks

4. **Generate**
   - Click "Generate Application" for full app generation
   - Click "Generate SVG Diagram" for visual diagram creation
   - View results in the preview section

## Security Notes

- Ollama server credentials are hardcoded in the frontend (consider moving to backend in production)
- HTTPS is used for all API communications
- Basic Authentication is used for Ollama API access

## Future Enhancements

1. Move Ollama credentials to backend API
2. Add support for additional file formats (Excel, XML, etc.)
3. Implement real-time streaming for AI responses
4. Add download functionality for generated SVG
5. Implement multi-file batch processing
6. Add progress indicators for long-running operations

## Testing

To test the changes:

1. Start the development server:
   ```bash
   cd /home/jose/nsrd_ornl/nsrd_ui
   npm start
   ```

2. Upload a CSV file or OpenAPI spec
3. Enter some plain text requirements
4. Select a model
5. Click "Generate Application" or "Generate SVG Diagram"
6. Verify the API calls to Ollama server in browser DevTools

## Dependencies

No new dependencies added. The application uses existing packages:
- react
- @apidevtools/swagger-parser
- js-yaml
- axios (for potential future use)
