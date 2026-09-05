// API base URL: set VITE_API_BASE in a .env file (or your host's env vars)
// when the backend is deployed somewhere other than localhost:8000.
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

async function handle(res) {
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.detail || 'Request failed')
  }
  return data
}

export async function indexRepo(sessionId, repo) {
  const res = await fetch(`${API_BASE}/api/index`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, repo }),
  })
  return handle(res)
}

export async function askQuestion(sessionId, question, model, topK, focusedFile) {
  const res = await fetch(`${API_BASE}/api/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      question,
      model,
      top_k: topK,
      focused_file: focusedFile || null,
    }),
  })
  return handle(res)
}

export async function getFileContent(sessionId, filePath) {
  const res = await fetch(
    `${API_BASE}/api/file-content/${sessionId}/${encodeURIComponent(filePath)}`
  )
  return handle(res)
}

export async function getModels() {
  const res = await fetch(`${API_BASE}/api/models`)
  return handle(res)
}

export async function checkHealth() {
  const res = await fetch(`${API_BASE}/api/health`)
  return handle(res)
}
