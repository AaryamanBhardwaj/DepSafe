export default function HealthGauge({ score, size = 180 }) {
  const radius = (size - 20) / 2
  const circumference = Math.PI * radius
  const progress = (score / 100) * circumference

  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#eab308' : '#ef4444'
  const bgColor = score >= 70 ? 'rgba(34,197,94,0.1)' : score >= 40 ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.1)'

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        <path
          d={`M 10 ${size / 2 + 10} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2 + 10}`}
          fill="none"
          stroke="#334155"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d={`M 10 ${size / 2 + 10} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2 + 10}`}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          style={{ filter: `drop-shadow(0 0 8px ${color}40)` }}
        />
        <text
          x={size / 2}
          y={size / 2 - 5}
          textAnchor="middle"
          fill={color}
          fontSize="36"
          fontWeight="700"
          fontFamily="Inter, system-ui"
        >
          {score}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 18}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="12"
          fontFamily="Inter, system-ui"
        >
          / 100
        </text>
      </svg>
    </div>
  )
}
