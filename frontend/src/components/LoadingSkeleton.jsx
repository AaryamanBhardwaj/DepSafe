export default function LoadingSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 animate-pulse">
      <div className="flex flex-col items-center gap-6">
        <div className="w-44 h-24 bg-slate-800 rounded-xl" />
        <div className="w-64 h-6 bg-slate-800 rounded" />
        <div className="w-96 h-4 bg-slate-800 rounded" />
      </div>
      <div className="mt-12 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 items-center">
            <div className="w-40 h-4 bg-slate-800 rounded" />
            <div className="w-16 h-4 bg-slate-800 rounded" />
            <div className="flex-1 h-3 bg-slate-800 rounded-full" />
          </div>
        ))}
      </div>
      <p className="text-center text-slate-500 mt-8 text-sm">
        Fetching live data from GitHub and npm...
      </p>
    </div>
  )
}
