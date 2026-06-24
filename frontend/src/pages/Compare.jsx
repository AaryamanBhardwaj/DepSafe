import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import HealthGauge from '../components/HealthGauge'
import ShapWaterfall from '../components/ShapWaterfall'
import LoadingSkeleton from '../components/LoadingSkeleton'

export default function Compare() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [pkgA, setPkgA] = useState(searchParams.get('a') || '')
  const [pkgB, setPkgB] = useState(searchParams.get('b') || '')
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    document.title = pkgA && pkgB && data ? `${pkgA} vs ${pkgB} — DepSafe` : 'Compare — DepSafe'
  }, [pkgA, pkgB, data])

  const doCompare = () => {
    if (!pkgA.trim() || !pkgB.trim()) return
    setLoading(true)
    setError(null)
    setData(null)
    setSearchParams({ a: pkgA.trim(), b: pkgB.trim() })
    fetch(`/api/compare?a=${encodeURIComponent(pkgA.trim())}&b=${encodeURIComponent(pkgB.trim())}`)
      .then(res => {
        if (!res.ok) return res.json().then(e => { throw new Error(e.detail || 'Comparison failed') })
        return res.json()
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (searchParams.get('a') && searchParams.get('b')) {
      setPkgA(searchParams.get('a'))
      setPkgB(searchParams.get('b'))
      doCompare()
    }
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    doCompare()
  }

  const verdictColors = {
    low: 'text-emerald-400',
    medium: 'text-amber-400',
    high: 'text-red-400',
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-2">Compare Packages</h1>
      <p className="text-slate-500 text-sm mb-6">Head-to-head health analysis</p>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 mb-8">
        <input
          type="text"
          value={pkgA}
          onChange={(e) => setPkgA(e.target.value)}
          placeholder="First package (e.g. express)"
          className="flex-1 bg-[#0a1628] border border-cyan-500/15 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/40 focus:shadow-[0_0_15px_rgba(0,224,255,0.06)] transition-all"
        />
        <span className="text-slate-600 self-center font-bold text-lg hidden sm:block">vs</span>
        <input
          type="text"
          value={pkgB}
          onChange={(e) => setPkgB(e.target.value)}
          placeholder="Second package (e.g. fastify)"
          className="flex-1 bg-[#0a1628] border border-purple-500/15 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/40 focus:shadow-[0_0_15px_rgba(168,85,247,0.06)] transition-all"
        />
        <button
          type="submit"
          className="bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap cursor-pointer shadow-[0_0_15px_rgba(0,224,255,0.15)]"
        >
          Compare
        </button>
      </form>

      {loading && <LoadingSkeleton />}

      {error && (
        <div className="card-glow rounded-xl p-6 text-center border border-red-500/20">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {data && (
        <>
          {/* Recommendation */}
          <div className="card-glow rounded-xl p-4 mb-8 text-center border border-cyan-500/15">
            <p className="text-cyan-300 font-medium text-sm">{data.recommendation}</p>
          </div>

          {/* Side by side scores */}
          <div className="grid md:grid-cols-2 gap-5 mb-8">
            {Object.entries(data.packages).map(([name, pkg]) => (
              <div key={name} className="card-glow rounded-xl p-6 text-center">
                <h2 className="text-xl font-mono text-white mb-4 neon-text">{name}</h2>
                <HealthGauge score={pkg.health_score} size={150} />
                <p className={`mt-3 text-sm font-medium ${verdictColors[pkg.risk_level]}`}>
                  {pkg.verdict}
                </p>
                <p className="text-slate-500 text-xs mt-2">{pkg.explanation}</p>
              </div>
            ))}
          </div>

          {/* Side by side SHAP */}
          <div className="grid md:grid-cols-2 gap-5 mb-8">
            {Object.entries(data.packages).map(([name, pkg]) => (
              <div key={name} className="card-glow rounded-xl p-4">
                <h3 className="text-sm font-mono text-slate-400 mb-2">{name}</h3>
                <ShapWaterfall impacts={pkg.shap.feature_impacts} maxFeatures={8} />
              </div>
            ))}
          </div>

          {/* Feature comparison table */}
          <div className="card-glow rounded-xl p-6">
            <h3 className="text-sm font-medium text-slate-500 mb-4">Feature Comparison</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left py-2 px-2 text-slate-500 font-medium">Feature</th>
                    <th className="text-right py-2 px-2 text-cyan-400/70 font-medium font-mono">{pkgA}</th>
                    <th className="text-right py-2 px-2 text-purple-400/70 font-medium font-mono">{pkgB}</th>
                    <th className="text-center py-2 px-2 text-slate-500 font-medium">Favors</th>
                  </tr>
                </thead>
                <tbody>
                  {data.feature_comparison
                    .sort((a, b) => Math.abs(b.shap_a - b.shap_b) - Math.abs(a.shap_a - a.shap_b))
                    .map((f) => (
                    <tr key={f.feature} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="py-2 px-2 text-slate-400">{f.feature.replace(/_/g, ' ')}</td>
                      <td className="py-2 px-2 text-right text-slate-200 font-mono">
                        {typeof f.value_a === 'number' ? (f.value_a % 1 ? f.value_a.toFixed(2) : f.value_a.toLocaleString()) : f.value_a}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-200 font-mono">
                        {typeof f.value_b === 'number' ? (f.value_b % 1 ? f.value_b.toFixed(2) : f.value_b.toLocaleString()) : f.value_b}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {f.favors === 'tie' ? (
                          <span className="text-slate-600">—</span>
                        ) : (
                          <span className={f.favors === pkgA.trim() ? 'text-cyan-400' : 'text-purple-400'}>
                            {f.favors}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
