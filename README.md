# Chat With a Codebase

Point this at any public GitHub repo and ask questions about it in plain
English. Answers are grounded in the actual retrieved code — with file
and line citations — rather than guessed from the model's training data.

## Live Demo

- **App:** https://chat-with-code-eight.vercel.app
- **Backend API:** https://chat-with-code-448935442733.us-central1.run.app
- **Repo:** https://github.com/Gk2007ikik/Chat_with_code

## How it works

1. **Index a repo** — paste a GitHub URL. The backend clones it, splits
   every file into function/class-level chunks (not arbitrary
   fixed-size windows), and embeds each chunk.
2. **Ask a question** — the most relevant chunks are retrieved by
   similarity search and handed to the model as context. It answers
   only from what's retrieved, not from memory.
3. **Read the real code** — every answer cites the file and lines it
   used, shown live in the code panel alongside syntax highlighting.

Language support is universal, not limited to a hardcoded list of
extensions: files are classified as text or binary by sniffing for
null bytes, so the chunker works across Python, JS/TS, Java, Go, Rust,
Kotlin, Lua, and more without an allowlist.

## Architecture

```
React frontend (Vite + Tailwind)  <-- HTTPS -->  FastAPI backend (RAG pipeline)
   deployed on Vercel                          deployed on Google Cloud Run
```

Each browser tab gets a random session ID (stored in localStorage) sent
with every request, so the backend keeps each visitor's indexed repo
isolated in memory — no risk of one visitor's session bleeding into
another's.

Retrieval and generation are deliberately separate concerns:
- **Retrieval** uses ChromaDB's built-in ONNX-runtime embedding model
  (MiniLM-L6-v2) — fixed, not user-selectable.
- **Generation** calls Groq's API using whichever model is picked from
  the live model dropdown (populated from Groq's own `/v1/models`
  endpoint, so it never goes stale as models are added or deprecated).
  Switching models changes how the answer is written, not what code
  gets retrieved.

## Features

- Live, syntax-highlighted code panel (Prism via
  `react-syntax-highlighter`, VS Code Dark+ theme) that updates as you
  click through cited files
- Resizable three-pane layout (file tree / chat / code) that persists
  across the session
- Repo-map context automatically included on general questions
  ("what does this project do?") without keyword-based detection
- Exact-match file lookup: naming a specific file in your question
  bypasses similarity search entirely and pulls that file's real
  chunks directly, correctly disambiguating same-named files (e.g. two
  `README.md`s) by preferring the repo-root version
- Per-file AI summaries generated on demand
- Markdown-rendered answers (via `react-markdown` + `remark-gfm`) with
  clickable citation pills
- Focused-file awareness: the currently open file in the code panel is
  explicitly passed as context, so "explain this file" resolves
  correctly instead of the model asking which file you mean

## Running it locally

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
export GROQ_API_KEY=your_key_here
uvicorn api:app --reload --port 8000
```

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). It's
already configured to call the backend at `http://localhost:8000` by
default — no extra setup needed for local dev.

## Deploying it

**Frontend → Vercel**
- Root directory: `frontend`
- Env var: `VITE_API_BASE=<your backend URL>` — save this as **Config**
  type, not Secret. Vercel makes Secret-type values permanently
  write-only (it can't display them back to you, ever, even to
  yourself), which makes it impossible to verify what's actually
  saved. Config is the right type for a non-sensitive value like a
  public API URL anyway.
- Env var changes require a fresh redeploy (with build cache disabled)
  to actually take effect — a plain "Redeploy" can silently reuse the
  old cached bundle.

**Backend → Google Cloud Run**
- Containerized via the included `Dockerfile` (installs system `git`,
  since the ingest step shells out to it to clone repos — a bare
  `python:slim` image doesn't have it by default)
- Deploy with:
  ```bash
  gcloud run deploy chat-with-code \
    --source . \
    --region us-central1 \
    --allow-unauthenticated \
    --memory 2Gi \
    --set-env-vars GROQ_API_KEY=your_key_here
  ```
- `--memory 2Gi` matters: embedding a real-sized repo needs headroom
  the free tiers of some other platforms don't give you (see "Lessons
  from deploying this" below). Cloud Run's usage-based free allowance
  comfortably covers a low-traffic project like this at that memory
  level.
- Update `allow_origins` in `api.py`'s CORS config to your actual
  deployed frontend URL once both sides are live — leaving it as `*`
  is fine for local dev but shouldn't ship to production.

## Lessons from deploying this

A few things that weren't obvious until they broke in production:

- **Embedding batch size is a real memory lever.** Each call to the
  embedding model processes its whole batch in one forward pass —
  memory scales with batch size *and* text length together, not just
  total data volume. A batch of 100 chunks was enough to get the
  backend OOM-killed on a 512MB host when indexing a large repo;
  dropping it to 16 fixed it, trading a bit of wall-clock time for a
  much lower peak memory footprint.
- **Warm the embedding model at server startup, not on first
  request.** The ONNX model is a one-time ~90MB download. Doing that
  download during a user's first real request stacks its latency on
  top of the actual indexing work, right when a slow/timing-out
  response is most costly. A `@app.on_event("startup")` hook that
  performs a dummy embed forces this cost to happen at boot instead.
- **A silent syntax error looks exactly like a resource problem.** A
  stray duplicate comma in a CORS config crashed the server on every
  single startup — which surfaced as a generic 502 with no body,
  indistinguishable at first glance from a timeout or an
  out-of-memory kill. Checking the actual deploy logs (not just
  guessing from symptoms) is what separated a one-line fix from a
  much longer, unnecessary investigation into memory tuning.

## Project structure

```
.
├── backend/
│   ├── api.py              # FastAPI app: routes, session management, CORS
│   ├── ingest.py            # repo cloning, file walking, chunk collection
│   ├── chunker.py            # function/class-boundary chunking logic
│   ├── vectorstore.py         # ChromaDB + ONNX embedding, retrieval
│   ├── llm.py                  # Groq API calls, prompt construction
│   ├── requirements.txt
│   ├── Dockerfile             # container build for Cloud Run
│   └── .dockerignore
└── frontend/
    ├── src/
    │   ├── App.jsx              # top-level state, resizable panels, routing
    │   ├── api.js                 # fetch wrappers for every backend endpoint
    │   ├── index.css
    │   └── components/
    │       ├── HomePanel.jsx        # landing hero, "how it works" steps
    │       ├── Sidebar.jsx            # repo input, model dropdown, file tree
    │       ├── ChatPanel.jsx            # message history, citations, input
    │       └── CodePanel.jsx              # syntax-highlighted code viewer
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── tailwind.config.js
```

*(If you've added other components since this was last written, worth
a quick double-check against your actual repo — this reflects
everything confirmed during development, but may not be perfectly
exhaustive.)*