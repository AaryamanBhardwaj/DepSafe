import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const EXAMPLES = [
  { name: 'express', label: 'express', desc: 'Healthy', color: 'text-emerald-400 border-emerald-500/30' },
  { name: 'request', label: 'request', desc: 'Abandoned', color: 'text-red-400 border-red-500/30' },
  { name: 'moment', label: 'moment', desc: 'Declining', color: 'text-amber-400 border-amber-500/30' },
]

const STEPS = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
      </svg>
    ),
    title: '20 Live Features',
    desc: 'Fetches commit activity, contributor patterns, release cadence, download trends, and more from GitHub and npm in real time.',
    gradient: 'from-cyan-500/20 to-cyan-500/5',
    border: 'border-cyan-500/20',
    text: 'text-cyan-400',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
    title: 'Random Forest Model',
    desc: 'Trained on 1,725 real npm packages with historical maintenance data. 200-tree ensemble with balanced class weights. F1: 98.6%.',
    gradient: 'from-purple-500/20 to-purple-500/5',
    border: 'border-purple-500/20',
    text: 'text-purple-400',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'SHAP Explanations',
    desc: 'Every prediction includes a breakdown of which features pushed the score up or down — not a black box, but a transparent assessment.',
    gradient: 'from-emerald-500/20 to-emerald-500/5',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
  },
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
        <div className="inline-block mb-6 px-4 py-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 text-xs font-medium tracking-wider uppercase">
          ML-Powered Analysis
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 tracking-tight">
          Should you trust this
          <br />
          <span className="gradient-text">dependency?</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
          Paste an npm package name. Get an ML-powered health score with
          explainable predictions showing exactly <em className="text-slate-300 not-italic">why</em> — not just a number.
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSubmit} className="max-w-xl mx-auto mb-8">
        <div className="flex gap-2 p-1.5 rounded-xl bg-[#0a1628] border border-cyan-500/15 focus-within:border-cyan-500/40 focus-within:shadow-[0_0_20px_rgba(0,224,255,0.08)] transition-all">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. express, lodash, left-pad"
            className="flex-1 bg-transparent px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none text-base"
          />
          <button
            type="submit"
            className="bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white px-6 py-2.5 rounded-lg font-medium transition-all whitespace-nowrap shadow-[0_0_15px_rgba(0,224,255,0.2)] hover:shadow-[0_0_25px_rgba(0,224,255,0.3)] cursor-pointer"
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
            className={`bg-[#0a1628] hover:bg-[#0f1e36] border ${ex.color} rounded-lg px-4 py-2 text-sm transition-all cursor-pointer hover:scale-[1.02]`}
          >
            <span className="text-white font-mono">{ex.label}</span>
            <span className="text-slate-500 ml-2">{ex.desc}</span>
          </button>
        ))}
      </div>

      {/* How it works */}
      <div className="border-t border-white/5 pt-14 pb-16">
        <h2 className="text-2xl font-semibold text-white text-center mb-3">How it works</h2>
        <p className="text-slate-500 text-sm text-center mb-10">Three steps, fully transparent</p>
        <div className="grid md:grid-cols-3 gap-5">
          {STEPS.map((step) => (
            <div
              key={step.title}
              className={`card-glow rounded-xl p-6 text-center border ${step.border} hover:scale-[1.02] transition-transform`}
            >
              <div className={`w-12 h-12 bg-gradient-to-br ${step.gradient} rounded-xl flex items-center justify-center mx-auto mb-4 ${step.text}`}>
                {step.icon}
              </div>
              <h3 className="text-white font-medium mb-2">{step.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Compare CTA */}
      <div className="border-t border-white/5 py-12 text-center">
        <p className="text-slate-500 mb-4">Want to compare two packages head-to-head?</p>
        <button
          onClick={() => navigate('/compare')}
          className="bg-[#0a1628] hover:bg-[#0f1e36] border border-purple-500/20 hover:border-purple-500/40 text-purple-300 px-6 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer hover:shadow-[0_0_15px_rgba(168,85,247,0.1)]"
        >
          Open Comparison Tool
        </button>
      </div>
    </div>
  )
}
