"""
FastAPI Integration for Reference Codebase Analyzer
Provides REST endpoints to analyze reference codebases and get relevant examples
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import reference_analyzer

app = FastAPI(title="Reference Codebase Analyzer API")

class AnalysisRequest(BaseModel):
    requirements: str
    max_examples: int = 3

class AnalysisResponse(BaseModel):
    examples: List[Dict[str, Any]]
    summary: str
    total_analyzed: int
    total_scored: int

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "reference-analyzer"}

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_requirements(request: AnalysisRequest):
    """
    Analyze user requirements and return relevant code examples
    
    Example:
        POST /analyze
        {
            "requirements": "Create a map with markers showing locations",
            "max_examples": 3
        }
    """
    try:
        result = reference_analyzer.get_relevant_examples(
            request.requirements, 
            max_examples=request.max_examples
        )
        return AnalysisResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats")
async def get_stats():
    """Get statistics about reference codebases"""
    try:
        files = reference_analyzer.find_react_files(max_files=500)
        
        # Group by project
        projects = {}
        for file_path in files:
            project = file_path.parts[-5] if len(file_path.parts) > 5 else 'unknown'
            projects[project] = projects.get(project, 0) + 1
        
        return {
            "total_files": len(files),
            "projects": projects,
            "reference_dir": str(reference_analyzer.REFERENCE_DIR)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
