# Chat With a Codebase — React + FastAPI

A full rebuild of the Streamlit version as a real three-pane
AI-coding-assistant UI: file tree (left), chat (center), and a
persistent live code panel (right) with syntax highlighting.

The underlying RAG pipeline (chunking, embedding, retrieval, Groq calls)
is **unchanged** from the Streamlit version — only the presentation
layer changed. The backend is a thin FastAPI wrapper around the same
`ingest.py` / `chunker.py` / `vectorstore.py` / `llm.py` files.

## Architecture

```
React frontend (Vite + Tailwind)  <-- HTTP -->  FastAPI backend (wraps the RAG pipeline)
     runs on :5173 in dev                            runs on :8000 in dev
```

Each browser tab gets a random session ID (stored in localStorage) sent
with every request, so the backend can keep each visitor's indexed repo
separate in memory — the same isolation the Streamlit version got from
`st.session_state`, just made explicit.

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

This needs **two** separate deployments now (unlike the single Streamlit
Cloud deploy before):

**Backend (FastAPI):** deploy to Render, Railway, or Fly.io (all have
free tiers that support long-running Python processes, unlike
Streamlit Cloud). Set `GROQ_API_KEY` as an environment variable in
whichever platform you use.

**Frontend (React):** deploy to Vercel or Netlify (both free, and
built specifically for this). Before deploying, create a `.env` file
in `frontend/` with:

```
VITE_API_BASE=https://your-backend-url.onrender.com
```

so the deployed frontend knows where to send API requests.

Update the backend's CORS setting in `api.py` (`allow_origins=["*"]`)
to your actual frontend URL once both are deployed, instead of leaving
it open to any origin.

## What's genuinely more accurate here than the Streamlit version

- Real syntax highlighting (via `react-syntax-highlighter` with a VS
  Code Dark+ theme) instead of Streamlit's default code block styling
- Exact control over every pixel: avatar circles, citation pills,
  spacing, hover states — none of which Streamlit lets you fully own
- A genuinely persistent, independently-scrolling three-pane layout
- Fast client-side interactions (clicking a file, clearing chat) with
  no full-page server rerun, unlike Streamlit's rerun-the-whole-script model

## What's still an approximation, not pixel-perfect

- **Syntax highlighting engine**: this uses Prism (via
  `react-syntax-highlighter`), not Monaco (the actual VS Code editor
  component). Prism gets very close visually and is far simpler to
  embed; swapping in Monaco later is possible but adds real complexity
  (web workers, bundler config) for a marginal visual gain.
- **File icons**: the reference shows colored icons per file type;
  this version uses plain monospace filenames. Adding real icons would
  mean pulling in an icon set (e.g. `vscode-icons`) mapped by extension.
- **No streaming**: answers appear all at once rather than token-by-token.
  Groq's API supports streaming; wiring it through FastAPI's
  `StreamingResponse` and consuming it in the frontend is a good next step.

## Project structure

```
fullstack/
├── backend/
│   ├── api.py           # FastAPI app - the only new file
│   ├── ingest.py         # unchanged from the Streamlit version
│   ├── chunker.py         # unchanged
│   ├── vectorstore.py      # unchanged
│   ├── llm.py               # unchanged (one error message tweaked)
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.jsx           # top-level state + wiring
    │   ├── api.js             # fetch wrapper for the backend
    │   ├── components/
    │   │   ├── Sidebar.jsx      # repo input, file tree, stats
    │   │   ├── ChatPanel.jsx     # header, messages, input
    │   │   └── CodePanel.jsx      # syntax-highlighted code + related files
    │   └── index.css
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── tailwind.config.js
```
