"""
api.py
------
FastAPI backend for the codebase RAG chatbot. Wraps the existing,
unmodified RAG pipeline (ingest.py, chunker.py, vectorstore.py, llm.py)
with HTTP endpoints a real frontend can call.

Sessions: each browser tab generates a random session_id (client-side,
via crypto.randomUUID()) and sends it with every request. The backend
keeps an in-memory dict mapping session_id -> that session's indexed
collection/chunks, exactly mirroring what Streamlit's session_state
did before - just addressed by an explicit ID instead of a cookie.

Run with:
    uvicorn api:app --reload --port 8000
"""

import os
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ingest import get_repo_path, collect_chunks, build_repo_map, group_by_file
from vectorstore import get_client, get_collection, index_chunks, retrieve, get_chunks_by_file
from llm import (
    generate_answer, is_per_file_request, summarize_file,
    extract_filename_mention, find_mentioned_files,
)

app = FastAPI(title="Chat With a Codebase API")

# Allow the frontend (a different origin in dev and likely in prod) to call this API.
# Tighten allow_origins to your actual frontend URL before shipping to production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://chat-with-code-eight.vercel.app"],,
    allow_methods=["*"],
    allow_headers=["*"],
)

# session_id -> {"collection":..., "chunks":..., "repo_map":..., "repo": str}
SESSIONS: dict = {}


class IndexRequest(BaseModel):
    session_id: str
    repo: str


class AskRequest(BaseModel):
    session_id: str
    question: str
    model: str = "openai/gpt-oss-20b"
    top_k: int = 5
    focused_file: Optional[str] = None


def _get_session(session_id: str) -> dict:
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="No indexed repo for this session. Index one first.")
    return session


GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models"


@app.get("/api/health")
def health():
    return {"ok": True, "groq_key_set": bool(os.environ.get("GROQ_API_KEY"))}


@app.get("/api/models")
def list_models():
    """
    Fetch the live list of models available to this Groq API key, filtered
    to ones actually suitable for chat (text in, text out) - excluding
    transcription/speech models, and moderation/safety-classifier models
    (identifiable by "guard" in the id) which aren't meant for general Q&A.
    We deliberately don't hardcode a model list here: Groq's lineup changes
    over time (models get deprecated), so asking live avoids ever shipping
    a stale/broken default again.
    """
    import requests as _requests

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="GROQ_API_KEY is not set on the server.")

    try:
        resp = _requests.get(
            GROQ_MODELS_URL,
            headers={"Authorization": "Bearer " + api_key},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Couldn't reach Groq: {e}")

    models = []
    for m in data.get("data", []):
        model_id = m.get("id", "")
        if not m.get("active", False):
            continue
        if "guard" in model_id.lower():
            continue
        inputs = m.get("input_modalities", [])
        outputs = m.get("output_modalities", [])
        if "text" in inputs and "text" in outputs:
            models.append({"id": model_id, "name": m.get("name", model_id)})

    models.sort(key=lambda m: m["id"])
    return {"models": models}


@app.post("/api/index")
def index_repo(req: IndexRequest):
    try:
        repo_path = get_repo_path(req.repo.strip())
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Couldn't get repo: {e}")

    chunks = collect_chunks(repo_path)
    if not chunks:
        raise HTTPException(status_code=400, detail="No supported code files found in this repo.")

    client = get_client()
    collection = get_collection(client, reset=True)
    index_chunks(collection, chunks)

    SESSIONS[req.session_id] = {
        "collection": collection,
        "chunks": chunks,
        "repo_map": build_repo_map(chunks),
        "repo": req.repo.strip(),
    }

    known_files = sorted(set(c.file_path for c in chunks))
    total_chars = sum(len(c.code) for c in chunks)

    return {
        "repo": req.repo.strip(),
        "chunk_count": len(chunks),
        "file_count": len(known_files),
        "files": known_files,
        "estimated_tokens": total_chars // 4,
    }


@app.get("/api/files/{session_id}")
def list_files(session_id: str):
    session = _get_session(session_id)
    return {"files": sorted(set(c.file_path for c in session["chunks"]))}


@app.get("/api/file-content/{session_id}/{file_path:path}")
def file_content(session_id: str, file_path: str):
    session = _get_session(session_id)
    hits = get_chunks_by_file(session["collection"], file_path)
    if not hits:
        raise HTTPException(status_code=404, detail="File not found in index.")
    sorted_hits = sorted(hits, key=lambda h: h["meta"]["start_line"])
    code = "\n\n".join(h["code"] for h in sorted_hits)
    return {
        "file": file_path,
        "code": code,
        "start_line": sorted_hits[0]["meta"]["start_line"],
        "end_line": sorted_hits[-1]["meta"]["end_line"],
    }


@app.post("/api/ask")
def ask(req: AskRequest):
    session = _get_session(req.session_id)
    collection = session["collection"]
    chunks = session["chunks"]
    repo_map = session["repo_map"]
    known_files = sorted(set(c.file_path for c in chunks))

    named_file = extract_filename_mention(req.question, known_files)

    if named_file:
        hits = get_chunks_by_file(collection, named_file)
        answer = generate_answer(req.question, hits, model=req.model, repo_map=repo_map)
        citation = None
        if hits:
            sorted_hits = sorted(hits, key=lambda h: h["meta"]["start_line"])
            citation = {
                "file": named_file,
                "start_line": sorted_hits[0]["meta"]["start_line"],
                "end_line": sorted_hits[-1]["meta"]["end_line"],
            }
        return {"answer": answer, "citation": citation, "related_files": [], "mode": "named_file"}

    if is_per_file_request(req.question):
        by_file = group_by_file(chunks)
        lines = []
        for file_path, file_chunks in sorted(by_file.items()):
            code_sample = "\n\n".join(c.code for c in file_chunks)[:1500]
            summary = summarize_file(file_path, code_sample, model=req.model)
            lines.append(f"- **{file_path}**: {summary}")
        return {"answer": "\n".join(lines), "citation": None, "related_files": [], "mode": "per_file"}

    effective_top_k = max(req.top_k, 10)
    hits = retrieve(collection, req.question, top_k=effective_top_k)

    # If no file was explicitly named in the question but one is currently
    # open in the code panel, fold its real content in as extra context.
    # This lets vague follow-ups ("explain this", "what does this do")
    # resolve to whatever the person is actually looking at, without
    # guessing intent from keywords - the model decides whether it's
    # actually relevant to the question, same as it does with the repo map.
    if req.focused_file and req.focused_file in known_files:
        already_have = {(h["meta"]["file_path"], h["meta"]["start_line"]) for h in hits}
        focused_hits = get_chunks_by_file(collection, req.focused_file)
        for h in focused_hits:
            key = (h["meta"]["file_path"], h["meta"]["start_line"])
            if key not in already_have:
                hits.append(h)
                already_have.add(key)

    answer = generate_answer(req.question, hits, model=req.model, repo_map=repo_map, focused_file=req.focused_file)

    mentioned = find_mentioned_files(answer, known_files)
    citation = None
    related_files = []
    if mentioned:
        primary = mentioned[0]
        primary_hits = [h for h in hits if h["meta"]["file_path"] == primary]
        if primary_hits:
            sorted_hits = sorted(primary_hits, key=lambda h: h["meta"]["start_line"])
            citation = {
                "file": primary,
                "start_line": sorted_hits[0]["meta"]["start_line"],
                "end_line": sorted_hits[-1]["meta"]["end_line"],
            }
        else:
            citation = {"file": primary, "start_line": None, "end_line": None}
        related_files = mentioned[1:6]

    return {"answer": answer, "citation": citation, "related_files": related_files, "mode": "general"}
