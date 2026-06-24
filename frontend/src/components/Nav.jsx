import { Link, useLocation } from 'react-router-dom'

export default function Nav() {
  const location = useLocation()

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <nav className="border-b border-cyan-500/10 bg-[#050a12]/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 text-white font-semibold text-lg no-underline group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-sm font-bold shadow-[0_0_12px_rgba(0,224,255,0.3)] group-hover:shadow-[0_0_20px_rgba(0,224,255,0.4)] transition-shadow">
            D
          </div>
          <span className="tracking-tight">Dep<span className="text-cyan-400">Safe</span></span>
        </Link>
        <div className="flex gap-6">
          <Link
            to="/"
            className={`text-sm no-underline transition-colors ${isActive('/') && !isActive('/compare') ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Analyze
          </Link>
          <Link
            to="/compare"
            className={`text-sm no-underline transition-colors ${isActive('/compare') ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Compare
          </Link>
        </div>
      </div>
    </nav>
  )
}
