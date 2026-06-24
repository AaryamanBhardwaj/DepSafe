const FEATURE_META = {
  commits_90d: { label: 'Commits (90d)', good: 'high' },
  commits_365d: { label: 'Commits (365d)', good: 'high' },
  commit_velocity_trend: { label: 'Commit Velocity Trend', good: 'high', format: v => v.toFixed(2) + 'x' },
  contributors_total: { label: 'Total Contributors', good: 'high' },
  contributors_90d: { label: 'Active Contributors (90d)', good: 'high' },
  bus_factor: { label: 'Bus Factor (top contributor %)', good: 'low', format: v => v.toFixed(1) + '%' },
  open_issues: { label: 'Open Issues', good: 'neutral' },
  closed_issues_90d: { label: 'Closed Issues (90d)', good: 'high' },
  issue_response_time_median: { label: 'Issue Response Time (hrs)', good: 'low', format: v => v.toFixed(1) + 'h' },
  days_since_last_release: { label: 'Days Since Last Release', good: 'low' },
  release_frequency: { label: 'Avg Days Between Releases', good: 'low' },
  release_regularity: { label: 'Release Regularity (std dev)', good: 'low' },
  weekly_downloads: { label: 'Weekly Downloads', good: 'high', format: v => v.toLocaleString() },
  download_trend: { label: 'Download Trend', good: 'high', format: v => v.toFixed(2) + 'x' },
  dependent_count: { label: 'Dependent Packages', good: 'high', format: v => v.toLocaleString() },
  has_readme: { label: 'Has README', good: 'high', format: v => v ? 'Yes' : 'No' },
  has_license: { label: 'Has License', good: 'high', format: v => v ? 'Yes' : 'No' },
  repo_stars: { label: 'GitHub Stars', good: 'high', format: v => v.toLocaleString() },
  repo_open_prs: { label: 'Open PRs', good: 'neutral' },
  days_since_last_commit: { label: 'Days Since Last Commit', good: 'low' },
}

function getBarColor(feature, value) {
  const meta = FEATURE_META[feature]
  if (!meta) return '#00e0ff'
  if (meta.good === 'neutral') return '#00e0ff'
  if (feature === 'days_since_last_commit' || feature === 'days_since_last_release') {
    if (value <= 30) return '#00ff9d'
    if (value <= 180) return '#ffbe0b'
    return '#ff3366'
  }
  if (feature === 'bus_factor') {
    if (value <= 40) return '#00ff9d'
    if (value <= 70) return '#ffbe0b'
    return '#ff3366'
  }
  return '#00e0ff'
}

function getBarWidth(feature, value) {
  const maxes = {
    commits_90d: 500, commits_365d: 2000, commit_velocity_trend: 3,
    contributors_total: 100, contributors_90d: 50, bus_factor: 100,
    open_issues: 1000, closed_issues_90d: 500, issue_response_time_median: 720,
    days_since_last_release: 365, release_frequency: 365, release_regularity: 200,
    weekly_downloads: 10000000, download_trend: 2, dependent_count: 10000,
    has_readme: 1, has_license: 1, repo_stars: 100000, repo_open_prs: 200,
    days_since_last_commit: 365,
  }
  const max = maxes[feature] || 100
  return Math.min((value / max) * 100, 100)
}

export default function FeatureTable({ features }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-slate-400 mb-3">Feature Breakdown</h3>
      <div className="space-y-1">
        {Object.entries(FEATURE_META).map(([key, meta]) => {
          const value = features[key]
          if (value === undefined) return null
          const formatted = meta.format ? meta.format(value) : value
          const barWidth = getBarWidth(key, value)
          const barColor = getBarColor(key, value)
          return (
            <div key={key} className="grid grid-cols-[minmax(120px,200px)_60px_1fr] sm:grid-cols-[200px_80px_1fr] items-center gap-2 py-1.5 px-2 rounded hover:bg-white/[0.02] text-sm transition-colors">
              <span className="text-slate-400 truncate">{meta.label}</span>
              <span className="text-slate-200 font-mono text-right">{formatted}</span>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${barWidth}%`, backgroundColor: barColor }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
