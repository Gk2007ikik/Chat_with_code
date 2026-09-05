import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

function guessLanguage(filePath) {
  const ext = filePath.split('.').pop()
  const map = {
    py: 'python', js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
    java: 'java', go: 'go', rb: 'ruby', c: 'c', cpp: 'cpp', cs: 'csharp',
    rs: 'rust', php: 'php', md: 'markdown', json: 'json', html: 'html', css: 'css',
  }
  return map[ext] || 'text'
}

export default function CodePanel({ focusedFile, relatedFiles, onSelectFile }) {
  if (!focusedFile) {
    return (
      <div className="h-full p-4">
        <div className="font-mono text-sm text-text border-b border-border pb-2 mb-2">
          no file selected
        </div>
        <div className="font-mono text-xs text-muted">
          Click a file in the sidebar, or ask a question that references one,
          and its code shows up here.
        </div>
      </div>
    )
  }

  const ext = focusedFile.file.split('.').pop() || 'txt'

  return (
    <div className="h-full flex flex-col p-4">
      <div className="font-mono text-sm text-text border-b border-border pb-2 mb-1 truncate">
        {focusedFile.file} <span className="text-muted text-xs">[{ext}]</span>
      </div>
      <div className="font-mono text-xs text-muted mb-2">
        lines {focusedFile.start_line}-{focusedFile.end_line} &middot; referenced in last reply
      </div>

      <div className="flex-1 overflow-auto rounded border border-border">
        <SyntaxHighlighter
          language={guessLanguage(focusedFile.file)}
          style={vscDarkPlus}
          showLineNumbers
          customStyle={{ margin: 0, background: '#0A0A0C', fontSize: '0.8rem', height: '100%' }}
        >
          {focusedFile.code}
        </SyntaxHighlighter>
      </div>

      {relatedFiles && relatedFiles.length > 0 && (
        <div className="mt-3">
          <div className="font-mono text-xs text-muted tracking-wide mb-1">RELATED</div>
          {relatedFiles.map((rf) => (
            <button
              key={rf}
              onClick={() => onSelectFile(rf)}
              className="w-full text-left font-mono text-xs text-muted hover:text-text hover:bg-panel rounded px-1.5 py-1 truncate transition-colors"
            >
              {rf}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
