import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, ReferenceLine } from 'recharts'

const FEATURE_LABELS = {
  commits_90d: 'Commits (90d)',
  commits_365d: 'Commits (365d)',
  commit_velocity_trend: 'Commit Velocity',
  contributors_total: 'Total Contributors',
  contributors_90d: 'Active Contributors (90d)',
  bus_factor: 'Bus Factor',
  open_issues: 'Open Issues',
  closed_issues_90d: 'Closed Issues (90d)',
  issue_response_time_median: 'Issue Response Time',
  days_since_last_release: 'Days Since Release',
  release_frequency: 'Release Frequency',
  release_regularity: 'Release Regularity',
  weekly_downloads: 'Weekly Downloads',
  download_trend: 'Download Trend',
  dependent_count: 'Dependents',
  has_readme: 'Has README',
  has_license: 'Has License',
  repo_stars: 'Stars',
  repo_open_prs: 'Open PRs',
  days_since_last_commit: 'Days Since Commit',
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-[#0a1628] border border-cyan-500/15 rounded-lg px-3 py-2 text-sm shadow-xl backdrop-blur-sm">
      <p className="text-white font-medium">{d.label}</p>
      <p className="text-slate-500">Value: {d.rawValue}</p>
      <p style={{ color: d.shap > 0 ? '#00ff9d' : '#ff3366' }}>
        Impact: {d.shap > 0 ? '+' : ''}{d.shap.toFixed(4)}
      </p>
    </div>
  )
}

export default function ShapWaterfall({ impacts, maxFeatures = 10 }) {
  const sorted = [...impacts]
    .sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value))
    .slice(0, maxFeatures)

  const data = sorted.map(f => ({
    label: FEATURE_LABELS[f.feature] || f.feature,
    shap: f.shap_value,
    rawValue: typeof f.value === 'number' && f.value % 1 !== 0
      ? f.value.toFixed(2)
      : f.value,
  }))

  const maxAbs = Math.max(...data.map(d => Math.abs(d.shap)), 0.01)

  return (
    <div className="w-full">
      <h3 className="text-sm font-medium text-slate-400 mb-3">
        SHAP Feature Impact — what pushed the score up or down
      </h3>
      <ResponsiveContainer width="100%" height={Math.max(data.length * 36, 200)}>
        <BarChart data={data} layout="vertical" margin={{ left: 140, right: 20, top: 5, bottom: 5 }}>
          <XAxis
            type="number"
            domain={[-maxAbs * 1.2, maxAbs * 1.2]}
            tickFormatter={v => v.toFixed(3)}
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={{ stroke: '#1e293b' }}
            tickLine={{ stroke: '#1e293b' }}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fill: '#e2e8f0', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={135}
          />
          <Tooltip content={<CustomTooltip />} cursor={false} />
          <ReferenceLine x={0} stroke="#1e293b" />
          <Bar dataKey="shap" radius={[4, 4, 4, 4]} barSize={20}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.shap > 0 ? '#00ff9d' : '#ff3366'}
                fillOpacity={0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
