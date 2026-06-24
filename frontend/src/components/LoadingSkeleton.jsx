export default function LoadingSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 animate-pulse">
      <div className="flex flex-col items-center gap-6">
        <div className="w-44 h-24 bg-white/[0.03] rounded-xl border border-cyan-500/5" />
        <div className="w-64 h-6 bg-white/[0.03] rounded border border-cyan-500/5" />
        <div className="w-96 h-4 bg-white/[0.03] rounded border border-cyan-500/5" />
      </div>
      <div className="mt-12 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 items-center">
            <div className="w-40 h-4 bg-white/[0.03] rounded" />
            <div className="w-16 h-4 bg-white/[0.03] rounded" />
            <div className="flex-1 h-2 bg-white/[0.03] rounded-full" />
          </div>
        ))}
      </div>
      <p className="text-center text-slate-600 mt-8 text-sm">
        Fetching live data from GitHub and npm...
      </p>
    </div>
  )
}
