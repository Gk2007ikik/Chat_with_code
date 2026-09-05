import { useState, useMemo } from 'react'

export default function Sidebar({
  repoInput,
  onRepoInputChange,
  onIndex,
  indexing,
  indexed,
  files,
  onSelectFile,
  fileCount,
  tokenEstimate,
  indexedAt,
  models,
  modelsLoading,
  model,
  onModelChange,
  topK,
  onTopKChange,
}) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return files
    return files.filter((f) => f.toLowerCase().includes(search.toLowerCase()))
  }, [files, search])

  return (
    <div className="h-full flex flex-col bg-panel p-4">
      <div className="font-mono text-xs text-muted tracking-wide mb-2">CODEBASE</div>

      <input
        className="bg-bg border border-border rounded px-2 py-1.5 text-sm mb-2 outline-none focus:border-accent"
        placeholder="https://github.com/user/repo or /path/to/repo"
        value={repoInput}
        onChange={(e) => onRepoInputChange(e.target.value)}
      />

      <label className="text-xs text-muted mb-1">Model</label>
      {modelsLoading ? (
        <div className="text-xs text-muted font-mono mb-2">loading models...</div>
      ) : models.length > 0 ? (
        <select
          className="bg-bg border border-border rounded px-2 py-1.5 text-sm mb-2 font-mono outline-none focus:border-accent"
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id}
            </option>
          ))}
        </select>
      ) : (
        <input
          className="bg-bg border border-border rounded px-2 py-1.5 text-sm mb-2 font-mono outline-none focus:border-accent"
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          placeholder="e.g. openai/gpt-oss-20b"
        />
      )}

      <label className="text-xs text-muted mb-1">Chunks to retrieve: {topK}</label>
      <input
        type="range"
        min="1"
        max="10"
        value={topK}
        onChange={(e) => onTopKChange(Number(e.target.value))}
        className="mb-3 accent-accent"
      />

      <button
        disabled={indexing || !repoInput.trim()}
        onClick={() => onIndex(repoInput.trim())}
        className="bg-accent text-bg font-medium rounded px-3 py-1.5 text-sm mb-3 disabled:opacity-40 hover:brightness-110 transition-colors"
      >
        {indexing ? 'Indexing...' : 'Index repo'}
      </button>

      {indexed && (
        <>
          <div className="border-t border-border my-2" />
          <div className="font-mono text-xs text-muted tracking-wide mb-2">FILES</div>
          <input
            className="bg-bg border border-border rounded px-2 py-1.5 text-sm mb-2 font-mono outline-none focus:border-accent"
            placeholder="search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="flex-1 overflow-y-auto min-h-0 mb-2">
            {filtered.map((fp) => (
              <button
                key={fp}
                onClick={() => onSelectFile(fp)}
                className="w-full text-left font-mono text-xs text-muted hover:text-text hover:bg-bg rounded px-1.5 py-1 truncate transition-colors"
                title={fp}
              >
                {fp}
              </button>
            ))}
          </div>

          <div className="font-mono text-xs text-muted border-t border-border pt-2 leading-relaxed">
            <div>files &nbsp; {fileCount}</div>
            <div>tokens &nbsp; ~{tokenEstimate.toLocaleString()}</div>
            <div>indexed &nbsp; {indexedAt}</div>
          </div>
        </>
      )}
    </div>
  )
}
