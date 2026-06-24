import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-20 text-center">
      <h1 className="text-7xl font-bold gradient-text mb-4">404</h1>
      <p className="text-slate-500 text-lg mb-6">Page not found</p>
      <Link
        to="/"
        className="inline-block bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-all no-underline shadow-[0_0_15px_rgba(0,224,255,0.2)]"
      >
        Back to Home
      </Link>
    </div>
  )
}
