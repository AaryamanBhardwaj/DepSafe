import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import HealthGauge from '../components/HealthGauge'
import ShapWaterfall from '../components/ShapWaterfall'
import FeatureTable from '../components/FeatureTable'
import LoadingSkeleton from '../components/LoadingSkeleton'

export default function Package() {
  const { name } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = data ? `${name} — DepSafe` : `Analyzing ${name}... — DepSafe`
  }, [name, data])

  useEffect(() => {
    setLoading(true)
    setError(null)
    setData(null)
    fetch(`/api/package/${encodeURIComponent(name)}`)
      .then(res => {
        if (!res.ok) return res.json().then(e => { throw new Error(e.detail || 'Failed to analyze package') })
        return res.json()
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [name])

  if (loading) return <LoadingSkeleton />

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="card-glow rounded-xl p-8 max-w-md mx-auto border border-red-500/20">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-red-400 text-lg font-medium mb-2">Analysis Failed</p>
          <p className="text-slate-500 text-sm">{error}</p>
          <div className="flex gap-3 mt-5 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="text-cyan-400 hover:text-cyan-300 text-sm cursor-pointer bg-transparent border border-cyan-500/20 hover:border-cyan-500/40 px-4 py-1.5 rounded-lg transition-all"
            >
              Retry
            </button>
            <Link to="/" className="text-slate-500 hover:text-slate-300 text-sm px-4 py-1.5 no-underline transition-colors">
              Try another
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const verdictStyles = {
    low: 'text-emerald-400 bg-emerald-500/8 border-emerald-500/25 shadow-[0_0_15px_rgba(0,255,157,0.06)]',
    medium: 'text-amber-400 bg-amber-500/8 border-amber-500/25 shadow-[0_0_15px_rgba(255,190,11,0.06)]',
    high: 'text-red-400 bg-red-500/8 border-red-500/25 shadow-[0_0_15px_rgba(255,51,102,0.06)]',
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold text-white font-mono neon-text">{name}</h1>
          <div className="flex gap-3 mt-2">
            <a href={data.github_url} target="_blank" rel="noopener" className="text-slate-500 hover:text-cyan-400 text-sm no-underline transition-colors">
              GitHub ↗
            </a>
            <a href={data.npm_url} target="_blank" rel="noopener" className="text-slate-500 hover:text-cyan-400 text-sm no-underline transition-colors">
              npm ↗
            </a>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 mt-2">
          <Link
            to={`/tree/${encodeURIComponent(name)}`}
            className="text-emerald-400 hover:text-emerald-300 text-sm no-underline transition-colors"
          >
            Dependency Tree →
          </Link>
          <Link
            to={`/compare?a=${encodeURIComponent(name)}`}
            className="text-purple-400 hover:text-purple-300 text-sm no-underline transition-colors"
          >
            Compare with...
          </Link>
        </div>
      </div>

      {/* Score + Verdict */}
      <div className="card-glow rounded-xl p-8 mt-6 flex flex-col md:flex-row items-center gap-8">
        <HealthGauge score={data.health_score} />
        <div className="flex-1 text-center md:text-left">
          <div className={`inline-block px-4 py-2 rounded-lg border text-sm font-medium ${verdictStyles[data.risk_level]}`}>
            {data.verdict}
          </div>
          <p className="text-slate-500 text-sm mt-4 max-w-md leading-relaxed">
            {data.explanation}
          </p>
        </div>
      </div>

      {/* SHAP Waterfall */}
      <div className="card-glow rounded-xl p-6 mt-5">
        <ShapWaterfall impacts={data.shap.feature_impacts} />
      </div>

      {/* Feature Table */}
      <div className="card-glow rounded-xl p-6 mt-5">
        <FeatureTable features={data.features} />
      </div>

      {/* Model Transparency */}
      <div className="border-t border-white/5 mt-8 pt-6 pb-12 text-center">
        <p className="text-slate-600 text-xs">
          Prediction by RandomForestClassifier (200 trees) · Trained on 500+ npm packages · F1: 97.5% ·{' '}
          <a
            href="https://github.com/AaryamanBhardwaj/DepSafe/tree/main/model"
            target="_blank"
            rel="noopener"
            className="text-cyan-500/60 hover:text-cyan-400 transition-colors"
          >
            View training data & code
          </a>
        </p>
      </div>
    </div>
  )
}
