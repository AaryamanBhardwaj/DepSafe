export default function HealthGauge({ score, size = 180 }) {
  const radius = (size - 20) / 2
  const circumference = Math.PI * radius
  const progress = (score / 100) * circumference

  const color = score >= 70 ? '#00ff9d' : score >= 40 ? '#ffbe0b' : '#ff3366'
  const glowColor = score >= 70 ? 'rgba(0,255,157,0.3)' : score >= 40 ? 'rgba(255,190,11,0.3)' : 'rgba(255,51,102,0.3)'

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        <defs>
          <filter id={`glow-${score}`}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d={`M 10 ${size / 2 + 10} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2 + 10}`}
          fill="none"
          stroke="#0f1e36"
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
          filter={`url(#glow-${score})`}
          style={{ filter: `drop-shadow(0 0 10px ${glowColor})` }}
        />
        <text
          x={size / 2}
          y={size / 2 - 5}
          textAnchor="middle"
          fill={color}
          fontSize="36"
          fontWeight="700"
          fontFamily="Inter, system-ui"
          style={{ textShadow: `0 0 20px ${glowColor}` }}
        >
          {score}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 18}
          textAnchor="middle"
          fill="#475569"
          fontSize="12"
          fontFamily="Inter, system-ui"
        >
          / 100
        </text>
      </svg>
    </div>
  )
}
