import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const EXAMPLES = [
  { name: 'express', label: 'express', desc: 'Healthy' },
  { name: 'request', label: 'request', desc: 'Abandoned' },
  { name: 'moment', label: 'moment', desc: 'Declining' },
]

export default function Landing() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    const pkg = query.trim()
    if (pkg) navigate(`/package/${encodeURIComponent(pkg)}`)
  }

  return (
    <div className="max-w-4xl mx-auto px-4">
      {/* Hero */}
      <div className="text-center pt-20 pb-12">
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 tracking-tight">
          Should you trust this
          <br />
          <span className="bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
            dependency?
          </span>
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          Paste an npm package name. Get an ML-powered health score with
          explainable predictions showing exactly <em>why</em> — not just a number.
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSubmit} className="max-w-xl mx-auto mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. express, lodash, left-pad"
            className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-base"
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap"
          >
            Analyze
          </button>
        </div>
      </form>

      {/* Example buttons */}
      <div className="flex flex-wrap justify-center gap-3 mb-16">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.name}
            onClick={() => navigate(`/package/${ex.name}`)}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-sm transition-colors cursor-pointer"
          >
            <span className="text-white font-mono">{ex.label}</span>
            <span className="text-slate-500 ml-2">· {ex.desc}</span>
          </button>
        ))}
      </div>

      {/* How it works */}
      <div className="border-t border-slate-800 pt-12 pb-16">
        <h2 className="text-2xl font-semibold text-white text-center mb-10">How it works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📊</span>
            </div>
            <h3 className="text-white font-medium mb-2">20 Live Features</h3>
            <p className="text-slate-400 text-sm">
              Fetches commit activity, contributor patterns, release cadence, download trends,
              and more from GitHub and npm in real time.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🧠</span>
            </div>
            <h3 className="text-white font-medium mb-2">Random Forest Model</h3>
            <p className="text-slate-400 text-sm">
              Trained on {'>'}500 real npm packages with historical maintenance data.
              200-tree ensemble with balanced class weights. F1 score: 97.5%.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🔍</span>
            </div>
            <h3 className="text-white font-medium mb-2">SHAP Explanations</h3>
            <p className="text-slate-400 text-sm">
              Every prediction includes a breakdown of which features pushed the
              score up or down — not a black box, but a transparent assessment.
            </p>
          </div>
        </div>
      </div>

      {/* Compare CTA */}
      <div className="border-t border-slate-800 py-12 text-center">
        <p className="text-slate-400 mb-4">Want to compare two packages head-to-head?</p>
        <button
          onClick={() => navigate('/compare')}
          className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
        >
          Open Comparison Tool
        </button>
      </div>
    </div>
  )
}
