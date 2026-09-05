import { useState, useEffect } from 'react'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import Sidebar from './components/Sidebar.jsx'
import ChatPanel from './components/ChatPanel.jsx'
import CodePanel from './components/CodePanel.jsx'
import HomePanel from './components/HomePanel.jsx'
import { indexRepo, askQuestion, getFileContent, getModels } from './api.js'

function getSessionId() {
  let id = localStorage.getItem('session_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('session_id', id)
  }
  return id
}

function ResizeHandle() {
  return (
    <PanelResizeHandle className="w-1 bg-border hover:bg-accent transition-colors data-[resize-handle-active]:bg-accent" />
  )
}

export default function App() {
  const [sessionId] = useState(getSessionId)
  const [repoInput, setRepoInput] = useState('')
  const [indexing, setIndexing] = useState(false)
  const [indexed, setIndexed] = useState(false)
  const [files, setFiles] = useState([])
  const [fileCount, setFileCount] = useState(0)
  const [tokenEstimate, setTokenEstimate] = useState(0)
  const [indexedAt, setIndexedAt] = useState(null)
  const [error, setError] = useState(null)

  const [models, setModels] = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [model, setModel] = useState('openai/gpt-oss-20b')
  const [topK, setTopK] = useState(5)

  const [messages, setMessages] = useState([])
  const [asking, setAsking] = useState(false)

  const [focusedFile, setFocusedFile] = useState(null)
  const [relatedFiles, setRelatedFiles] = useState([])

  useEffect(() => {
    getModels()
      .then((data) => {
        setModels(data.models || [])
        if (data.models && data.models.length > 0) {
          const preferred = data.models.find((m) => m.id === 'openai/gpt-oss-20b')
          setModel(preferred ? preferred.id : data.models[0].id)
        }
      })
      .catch(() => {
        // Backend/Groq unreachable for the list - the sidebar falls back
        // to a free-text field so the app is still usable.
      })
      .finally(() => setModelsLoading(false))
  }, [])

  const handleIndex = async (repo) => {
    setIndexing(true)
    setError(null)
    try {
      const data = await indexRepo(sessionId, repo)
      setFiles(data.files)
      setFileCount(data.file_count)
      setTokenEstimate(data.estimated_tokens)
      setIndexedAt(new Date().toLocaleTimeString())
      setIndexed(true)
      setMessages([])
      setFocusedFile(null)
      setRelatedFiles([])
    } catch (e) {
      setError(e.message)
    } finally {
      setIndexing(false)
    }
  }

  const loadFile = async (filePath) => {
    try {
      const data = await getFileContent(sessionId, filePath)
      setFocusedFile(data)
    } catch (e) {
      setError(e.message)
    }
  }

  const handleSelectFile = (filePath) => {
    setRelatedFiles([])
    loadFile(filePath)
  }

  const handleAsk = async (question) => {
    setMessages((prev) => [...prev, { role: 'user', content: question }])
    setAsking(true)
    setError(null)
    try {
      const data = await askQuestion(sessionId, question, model, topK, focusedFile ? focusedFile.file : null)
      if (!data || typeof data.answer === 'undefined') {
        throw new Error('The server returned an unexpected empty response.')
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: data.answer, citation: data.citation }])

      if (data.citation && data.citation.file) {
        await loadFile(data.citation.file)
        setRelatedFiles(data.related_files || [])
      }
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Error: ' + e.message }])
    } finally {
      setAsking(false)
    }
  }

  const handleClear = () => setMessages([])

  return (
    <div className="h-screen w-screen bg-bg text-text font-sans">
      <PanelGroup direction="horizontal">
        <Panel defaultSize={18} minSize={12} maxSize={32}>
          <Sidebar
            repoInput={repoInput}
            onRepoInputChange={setRepoInput}
            onIndex={handleIndex}
            indexing={indexing}
            indexed={indexed}
            files={files}
            onSelectFile={handleSelectFile}
            fileCount={fileCount}
            tokenEstimate={tokenEstimate}
            indexedAt={indexedAt}
            models={models}
            modelsLoading={modelsLoading}
            model={model}
            onModelChange={setModel}
            topK={topK}
            onTopKChange={setTopK}
          />
        </Panel>

        <ResizeHandle />

        <Panel>
          {!indexed ? (
            <HomePanel error={error} />
          ) : (
            <PanelGroup direction="horizontal">
              <Panel defaultSize={62} minSize={30}>
                <ChatPanel
                  model={model}
                  tokenEstimate={tokenEstimate}
                  messages={messages}
                  onAsk={handleAsk}
                  asking={asking}
                  onClear={handleClear}
                />
              </Panel>
              <ResizeHandle />
              <Panel defaultSize={38} minSize={20}>
                <CodePanel
                  focusedFile={focusedFile}
                  relatedFiles={relatedFiles}
                  onSelectFile={handleSelectFile}
                />
              </Panel>
            </PanelGroup>
          )}
        </Panel>
      </PanelGroup>
    </div>
  )
}