const STEPS = [
  {
    n: '01',
    title: 'Index a repo',
    body: 'Paste a GitHub URL or local path. Code gets split into function-level chunks and embedded.',
  },
  {
    n: '02',
    title: 'Ask a question',
    body: 'The most relevant chunks are retrieved and handed to the model - no guessing from memory.',
  },
  {
    n: '03',
    title: 'Read the real code',
    body: 'Every answer cites the file and lines it used, shown live in the code panel on the right.',
  },
]

export default function HomePanel({ error }) {
  return (
    <div className="relative h-full overflow-hidden overflow-y-auto">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="animated-grid-bg" />
        <div className="animated-glow-bg absolute rounded-full" />
      </div>

      <div className="relative flex flex-col px-6 md:px-14 pt-16 pb-12">
        <h1 className="font-techno font-bold text-text leading-[1.08] tracking-tight text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-10 max-w-5xl">
          Chat with a codebase you've never seen before
        </h1>

        <div className="max-w-2xl w-full">
          <p className="text-muted text-sm leading-relaxed mb-8">
            Point this at any public repo and ask questions in plain English.
            Answers are grounded in the actual retrieved code, with file and
            line citations - not guessed from training data.
          </p>

          {error && (
            <div className="border border-red-500/40 bg-red-500/10 text-red-400 text-sm rounded px-3 py-2 mb-6">
              {error}
            </div>
          )}

          <div className="font-mono text-xs text-muted tracking-wide mb-3">HOW IT WORKS</div>
          <div className="space-y-4">
            {STEPS.map((s) => (
              <div key={s.n} className="flex gap-4">
                <div className="font-mono text-xs text-accent border border-accent/30 bg-accent/10 rounded w-8 h-8 flex items-center justify-center shrink-0">
                  {s.n}
                </div>
                <div>
                  <div className="text-sm text-text font-medium">{s.title}</div>
                  <div className="text-xs text-muted mt-0.5 leading-relaxed">{s.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}