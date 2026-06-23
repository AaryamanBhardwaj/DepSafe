import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-20 text-center">
      <h1 className="text-6xl font-bold text-slate-700 mb-4">404</h1>
      <p className="text-slate-400 text-lg mb-6">Page not found</p>
      <Link
        to="/"
        className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors no-underline"
      >
        Back to Home
      </Link>
    </div>
  )
}
