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

  useEffect(() => {
    document.title = data ? `${name} — DepSafe` : `Analyzing ${name}... — DepSafe`
  }, [name, data])

  if (loading) return <LoadingSkeleton />

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 max-w-md mx-auto">
          <p className="text-red-400 text-lg font-medium mb-2">Analysis Failed</p>
          <p className="text-slate-400 text-sm">{error}</p>
          <div className="flex gap-3 mt-4 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="text-indigo-400 hover:text-indigo-300 text-sm cursor-pointer bg-transparent border-none"
            >
              Retry
            </button>
            <Link to="/" className="text-slate-400 hover:text-slate-300 text-sm">
              ← Try another package
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const verdictColors = {
    low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    high: 'text-red-400 bg-red-500/10 border-red-500/30',
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold text-white font-mono">{name}</h1>
          <div className="flex gap-3 mt-2">
            <a href={data.github_url} target="_blank" rel="noopener" className="text-slate-400 hover:text-white text-sm no-underline">
              GitHub ↗
            </a>
            <a href={data.npm_url} target="_blank" rel="noopener" className="text-slate-400 hover:text-white text-sm no-underline">
              npm ↗
            </a>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 mt-2">
          <Link
            to={`/tree/${encodeURIComponent(name)}`}
            className="text-emerald-400 hover:text-emerald-300 text-sm no-underline"
          >
            Dependency Tree →
          </Link>
          <Link
            to={`/compare?a=${encodeURIComponent(name)}`}
            className="text-indigo-400 hover:text-indigo-300 text-sm no-underline"
          >
            Compare with...
          </Link>
        </div>
      </div>

      {/* Score + Verdict */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 mt-6 flex flex-col md:flex-row items-center gap-8">
        <HealthGauge score={data.health_score} />
        <div className="flex-1 text-center md:text-left">
          <div className={`inline-block px-4 py-2 rounded-lg border text-sm font-medium ${verdictColors[data.risk_level]}`}>
            {data.verdict}
          </div>
          <p className="text-slate-400 text-sm mt-4 max-w-md">
            {data.explanation}
          </p>
        </div>
      </div>

      {/* SHAP Waterfall */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mt-6">
        <ShapWaterfall impacts={data.shap.feature_impacts} />
      </div>

      {/* Feature Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mt-6">
        <FeatureTable features={data.features} />
      </div>

      {/* Model Transparency */}
      <div className="border-t border-slate-800 mt-8 pt-6 pb-12 text-center">
        <p className="text-slate-500 text-xs">
          Prediction by RandomForestClassifier (200 trees) · Trained on 500+ npm packages · F1: 97.5% ·{' '}
          <a
            href="https://github.com/AaryamanBhardwaj/DepSafe/tree/main/model"
            target="_blank"
            rel="noopener"
            className="text-indigo-400 hover:text-indigo-300"
          >
            View training data & code
          </a>
        </p>
      </div>
    </div>
  )
}
