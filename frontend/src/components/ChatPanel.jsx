import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function CitationPill({ citation }) {
  if (!citation) return null
  const lineText =
    citation.start_line != null ? ` · lines ${citation.start_line}-${citation.end_line}` : ''
  return (
    <span className="inline-block font-mono text-xs text-accent bg-accent/10 border border-accent/30 rounded px-2.5 py-1 mt-1.5">
      {citation.file}
      {lineText}
    </span>
  )
}

export default function ChatPanel({
  model,
  tokenEstimate,
  messages,
  onAsk,
  asking,
  onClear,
}) {
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    const q = input.trim()
    if (!q || asking) return
    setInput('')
    onAsk(q)
  }

  const handleExport = () => {
    const transcript = messages.map((m) => `**${m.role}:** ${m.content}`).join('\n\n') || 'No messages yet.'
    const blob = new Blob([transcript], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'chat_export.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center justify-between border border-border bg-panel rounded-md px-3 py-2 mb-3">
        <span className="font-mono text-xs text-muted flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
          {model} &middot; repo context &middot; ~{tokenEstimate.toLocaleString()} tokens
        </span>
        <div className="flex gap-2">
          <button
            onClick={onClear}
            className="font-mono text-xs text-muted border border-border rounded px-2.5 py-1 hover:text-text hover:border-muted transition-colors"
          >
            clear
          </button>
          <button
            onClick={handleExport}
            className="font-mono text-xs text-muted border border-border rounded px-2.5 py-1 hover:text-text hover:border-muted transition-colors"
          >
            export
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">
        {messages.length === 0 && (
          <div className="text-muted text-sm">
            Ask something about your codebase to get started.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className="flex gap-3">
            <div
              className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono border ${
                m.role === 'user'
                  ? 'border-userAccent text-userAccent'
                  : 'border-accent text-accent'
              }`}
            >
              {m.role === 'user' ? 'U' : 'AI'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1.5 prose-table:my-2 prose-pre:bg-black/40 prose-pre:my-2 prose-code:text-accent prose-code:before:content-none prose-code:after:content-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
              </div>
              <CitationPill citation={m.citation} />
            </div>
          </div>
        ))}
        {asking && <div className="text-muted text-sm font-mono">thinking...</div>}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 border border-border bg-panel rounded-md px-3 py-2">
        <textarea
          className="w-full bg-transparent outline-none text-sm resize-none"
          rows={1}
          placeholder="Ask about your codebase..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        <div className="flex justify-end mt-1">
          <span className="font-mono text-xs text-muted">enter to send &middot; shift+enter for newline</span>
        </div>
      </div>
    </div>
  )
}
