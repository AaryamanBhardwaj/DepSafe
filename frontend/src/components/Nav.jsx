import { Link } from 'react-router-dom'

export default function Nav() {
  return (
    <nav className="border-b border-slate-700/50 bg-[#0f172a]/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-white font-semibold text-lg no-underline">
          <span className="text-2xl">🛡️</span>
          <span>DepSafe</span>
        </Link>
        <div className="flex gap-6">
          <Link to="/" className="text-slate-400 hover:text-white text-sm no-underline transition-colors">
            Analyze
          </Link>
          <Link to="/compare" className="text-slate-400 hover:text-white text-sm no-underline transition-colors">
            Compare
          </Link>
        </div>
      </div>
    </nav>
  )
}
