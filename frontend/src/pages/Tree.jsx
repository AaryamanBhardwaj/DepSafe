import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import LoadingSkeleton from '../components/LoadingSkeleton'

function HealthNode({ data }) {
  const score = data.health_score
  const hasError = data.error
  const isRoot = data.isRoot

  let bgColor = '#334155'
  let borderColor = '#475569'
  let textColor = '#94a3b8'

  if (score !== null && score !== undefined) {
    if (score >= 70) {
      bgColor = 'rgba(34,197,94,0.15)'
      borderColor = '#22c55e'
      textColor = '#22c55e'
    } else if (score >= 40) {
      bgColor = 'rgba(234,179,8,0.15)'
      borderColor = '#eab308'
      textColor = '#eab308'
    } else {
      bgColor = 'rgba(239,68,68,0.15)'
      borderColor = '#ef4444'
      textColor = '#ef4444'
    }
  }

  return (
    <div
      style={{
        background: bgColor,
        border: `2px solid ${borderColor}`,
        borderRadius: 12,
        padding: '10px 16px',
        minWidth: 140,
        textAlign: 'center',
        boxShadow: isRoot ? `0 0 20px ${borderColor}40` : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#475569' }} />
      <div style={{ fontFamily: 'monospace', color: '#f1f5f9', fontSize: 13, fontWeight: 600 }}>
        {data.label}
      </div>
      {score !== null && score !== undefined ? (
        <div style={{ color: textColor, fontSize: 18, fontWeight: 700, marginTop: 4 }}>
          {score}
        </div>
      ) : hasError ? (
        <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>
          {hasError === 'no_github' ? 'No GitHub repo' : hasError === 'rate_limit' ? 'Rate limited' : 'Error'}
        </div>
      ) : (
        <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>...</div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#475569' }} />
    </div>
  )
}

const nodeTypes = { health: HealthNode }

function buildGraph(tree, parentId = null, nodes = [], edges = [], pos = { x: 0, y: 0 }, level = 0) {
  const id = `${tree.name}-${level}-${pos.x}`
  nodes.push({
    id,
    type: 'health',
    position: { x: pos.x, y: level * 120 },
    data: {
      label: tree.name,
      health_score: tree.health_score,
      error: tree.error,
      risk_level: tree.risk_level,
      isRoot: level === 0,
    },
  })

  if (parentId) {
    edges.push({
      id: `${parentId}-${id}`,
      source: parentId,
      target: id,
      style: { stroke: '#475569', strokeWidth: 1.5 },
      animated: tree.health_score !== null && tree.health_score < 40,
    })
  }

  const childCount = tree.dependencies?.length || 0
  if (childCount > 0) {
    const spacing = Math.max(180, 180 * Math.pow(0.7, level))
    const totalWidth = (childCount - 1) * spacing
    const startX = pos.x - totalWidth / 2

    tree.dependencies.forEach((dep, i) => {
      buildGraph(dep, id, nodes, edges, { x: startX + i * spacing, y: 0 }, level + 1)
    })
  }

  return { nodes, edges }
}

export default function TreeView() {
  const { name } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  useEffect(() => {
    document.title = `${name} Dependencies — DepSafe`
  }, [name])

  useEffect(() => {
    setLoading(true)
    setError(null)
    setData(null)
    fetch(`/api/tree/${encodeURIComponent(name)}?depth=2`)
      .then(res => {
        if (!res.ok) return res.json().then(e => { throw new Error(e.detail || 'Failed to load tree') })
        return res.json()
      })
      .then(d => {
        setData(d)
        const { nodes: n, edges: e } = buildGraph(d.tree)
        setNodes(n)
        setEdges(e)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [name])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <LoadingSkeleton />
        <p className="text-center text-slate-500 text-sm mt-4">
          Resolving dependency tree and scoring each package... This may take up to a minute.
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 max-w-md mx-auto">
          <p className="text-red-400 text-lg font-medium mb-2">Tree Analysis Failed</p>
          <p className="text-slate-400 text-sm">{error}</p>
          <Link to="/" className="inline-block mt-4 text-indigo-400 hover:text-indigo-300 text-sm">
            ← Try another package
          </Link>
        </div>
      </div>
    )
  }

  const weakest = data?.weakest_link

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col">
      {/* Top summary bar */}
      <div className="bg-slate-800/50 border-b border-slate-700 px-4 py-3">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white font-mono">{name}</h1>
            <p className="text-slate-400 text-sm">
              {data.total_dependencies} dependencies · {data.scored_count} scored
            </p>
          </div>

          <div className="flex items-center gap-6">
            {data.chain_health !== null && (
              <div className="text-center">
                <div className="text-xs text-slate-500 uppercase tracking-wider">Chain Health</div>
                <div className={`text-2xl font-bold ${
                  data.chain_health >= 70 ? 'text-emerald-400' :
                  data.chain_health >= 40 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {data.chain_health}
                </div>
              </div>
            )}

            {weakest && (
              <div className="text-center">
                <div className="text-xs text-slate-500 uppercase tracking-wider">Weakest Link</div>
                <Link
                  to={`/package/${weakest.name}`}
                  className="text-red-400 font-mono text-sm hover:text-red-300 no-underline"
                >
                  {weakest.name} ({weakest.health_score})
                </Link>
              </div>
            )}
          </div>
        </div>

        {data.summary && (
          <div className="max-w-6xl mx-auto mt-2">
            <p className="text-sm text-amber-300/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
              {data.summary}
            </p>
          </div>
        )}
      </div>

      {/* Tree visualization */}
      <div className="flex-1" style={{ background: '#0f172a' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, node) => {
            if (node.data.health_score !== null) {
              window.open(`/package/${node.data.label}`, '_blank')
            }
          }}
        >
          <Background color="#1e293b" gap={20} />
          <Controls
            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
          />
        </ReactFlow>
      </div>

      {/* Legend */}
      <div className="bg-slate-800/50 border-t border-slate-700 px-4 py-2 flex items-center justify-center gap-6 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500 inline-block" /> Healthy (70+)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-500/30 border border-amber-500 inline-block" /> Declining (40-69)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-500/30 border border-red-500 inline-block" /> At Risk (&lt;40)
        </span>
        <span className="text-slate-600">|</span>
        <span>Click a node to view details</span>
      </div>
    </div>
  )
}
