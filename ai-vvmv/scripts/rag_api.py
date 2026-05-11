#!/usr/bin/env python3
"""FastAPI service for the local import/export RAG assistant."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

try:
    from .chat_memory_engine import DEFAULT_DB as DEFAULT_MEMORY_DB
    from .chat_memory_engine import extract_preferences_from_chat, record_event, reflect, retrieve_memory, update_preference
    from .generic_autofill_engine import autofill as run_autofill
    from .rag_index_cli import DEFAULT_INDEX, build_prompt, call_ollama, query_fts, summarize_risk_flags
except ImportError:  # Allows running this file directly from scripts/.
    from chat_memory_engine import DEFAULT_DB as DEFAULT_MEMORY_DB
    from chat_memory_engine import extract_preferences_from_chat, record_event, reflect, retrieve_memory, update_preference
    from generic_autofill_engine import autofill as run_autofill
    from rag_index_cli import DEFAULT_INDEX, build_prompt, call_ollama, query_fts, summarize_risk_flags


DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b-instruct")
DEFAULT_OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
DEFAULT_REPORT_DIR = Path(os.getenv("RAG_REPORT_DIR", str(Path(__file__).resolve().parents[1] / "llm-dataset" / "ai-assets" / "reports")))
DEFAULT_MEMORY_PATH = Path(os.getenv("AGENT_MEMORY_DB", str(DEFAULT_MEMORY_DB)))

app = FastAPI(
    title="VVMV Import/Export RAG API",
    description="Local RAG API backed by SQLite FTS5 and optional Ollama generation.",
    version="0.1.0",
)


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, description="User question")
    top_k: int = Field(5, ge=1, le=20, description="Number of retrieved context chunks")
    index: Optional[Path] = Field(None, description="Path to rag_fts.sqlite")


class AskRequest(QueryRequest):
    model: str = Field(DEFAULT_MODEL, description="Ollama model name")
    ollama_url: str = Field(DEFAULT_OLLAMA_URL, description="Ollama generate endpoint")


class RetrieveResponse(BaseModel):
    query: str
    hits: List[Dict[str, Any]]
    risk_summary: str
    prompt: str


class AskResponse(RetrieveResponse):
    answer: str


class AutofillRequest(BaseModel):
    declaration: Dict[str, Any] = Field(default_factory=dict)
    cargo: List[Dict[str, Any]] = Field(default_factory=list)
    report_dir: Optional[Path] = None
    use_memory: bool = True


class MemoryEventRequest(BaseModel):
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    event_type: str = "chat"
    text: str = ""
    payload: Dict[str, Any] = Field(default_factory=dict)
    learn_preferences: bool = False


class FeedbackRequest(BaseModel):
    scope: Dict[str, Any] = Field(default_factory=dict)
    field: str
    value: Any
    accepted: bool = True
    source: str = "feedback"


class MemoryQueryRequest(BaseModel):
    context: Dict[str, Any] = Field(default_factory=dict)
    text_query: str = ""
    limit: int = Field(10, ge=1, le=50)


def resolve_index(index: Optional[Path]) -> Path:
    db_path = index or Path(os.getenv("RAG_INDEX", str(DEFAULT_INDEX)))
    if not db_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Index not found: {db_path}. Run scripts/build_rag_index.py first.",
        )
    return db_path


@app.get("/health")
def health() -> Dict[str, Any]:
    index = Path(os.getenv("RAG_INDEX", str(DEFAULT_INDEX)))
    return {"status": "ok", "index": str(index), "index_exists": index.exists()}


@app.post("/retrieve", response_model=RetrieveResponse)
def retrieve(request: QueryRequest) -> RetrieveResponse:
    index = resolve_index(request.index)
    hits = query_fts(index, request.query, request.top_k)
    prompt = build_prompt(request.query, hits)
    return RetrieveResponse(query=request.query, hits=hits, risk_summary=summarize_risk_flags(hits), prompt=prompt)


@app.post("/ask", response_model=AskResponse)
def ask(request: AskRequest) -> AskResponse:
    index = resolve_index(request.index)
    hits = query_fts(index, request.query, request.top_k)
    prompt = build_prompt(request.query, hits)
    try:
        answer = call_ollama(prompt, request.model, request.ollama_url)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Ollama request failed: {exc}") from exc
    return AskResponse(
        query=request.query,
        hits=hits,
        risk_summary=summarize_risk_flags(hits),
        prompt=prompt,
        answer=answer,
    )


@app.post("/autofill")
def autofill(request: AutofillRequest) -> Dict[str, Any]:
    report_dir = request.report_dir or DEFAULT_REPORT_DIR
    if not report_dir.exists():
        raise HTTPException(status_code=404, detail=f"Report dir not found: {report_dir}")
    payload = request.model_dump()
    if request.use_memory:
        context = {k: v for k, v in request.declaration.items() if v not in (None, "")}
        payload["memory"] = retrieve_memory(DEFAULT_MEMORY_PATH, context, "", limit=10)
    return run_autofill(payload, report_dir)


@app.post("/memory/event")
def memory_event(request: MemoryEventRequest) -> Dict[str, Any]:
    payload = request.payload.copy()
    payload.update(
        {
            "session_id": request.session_id,
            "user_id": request.user_id,
            "event_type": request.event_type,
            "text": request.text,
        }
    )
    result = record_event(DEFAULT_MEMORY_PATH, payload)
    if request.learn_preferences:
        result["learned"] = extract_preferences_from_chat(DEFAULT_MEMORY_PATH, payload)
    return result


@app.post("/chat-hint")
def chat_hint(request: MemoryEventRequest) -> Dict[str, Any]:
    payload = request.payload.copy()
    payload.update(
        {
            "session_id": request.session_id,
            "user_id": request.user_id,
            "event_type": request.event_type,
            "text": request.text,
        }
    )
    recorded = record_event(DEFAULT_MEMORY_PATH, payload)
    learned = extract_preferences_from_chat(DEFAULT_MEMORY_PATH, payload)
    return {"recorded": recorded, "learned": learned}


@app.post("/feedback")
def feedback(request: FeedbackRequest) -> Dict[str, Any]:
    return update_preference(DEFAULT_MEMORY_PATH, request.model_dump())


@app.post("/memory/search")
def memory_search(request: MemoryQueryRequest) -> Dict[str, Any]:
    return retrieve_memory(DEFAULT_MEMORY_PATH, request.context, request.text_query, request.limit)


@app.post("/reflect")
def reflection() -> Dict[str, Any]:
    return reflect(DEFAULT_MEMORY_PATH)
