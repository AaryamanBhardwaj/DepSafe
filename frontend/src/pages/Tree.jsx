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

  let bgColor = 'rgba(8,16,32,0.9)'
  let borderColor = '#1e293b'
  let textColor = '#64748b'

  if (score !== null && score !== undefined) {
    if (score >= 70) {
      bgColor = 'rgba(0,255,157,0.08)'
      borderColor = '#00ff9d'
      textColor = '#00ff9d'
    } else if (score >= 40) {
      bgColor = 'rgba(255,190,11,0.08)'
      borderColor = '#ffbe0b'
      textColor = '#ffbe0b'
    } else {
      bgColor = 'rgba(255,51,102,0.08)'
      borderColor = '#ff3366'
      textColor = '#ff3366'
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
        boxShadow: isRoot ? `0 0 25px ${borderColor}30` : `0 0 10px ${borderColor}15`,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#1e293b' }} />
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
      <Handle type="source" position={Position.Bottom} style={{ background: '#1e293b' }} />
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
      style: { stroke: '#1e293b', strokeWidth: 1.5 },
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
        <div className="card-glow rounded-xl p-8 max-w-md mx-auto border border-red-500/20">
          <p className="text-red-400 text-lg font-medium mb-2">Tree Analysis Failed</p>
          <p className="text-slate-500 text-sm">{error}</p>
          <Link to="/" className="inline-block mt-4 text-cyan-400 hover:text-cyan-300 text-sm">
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
      <div className="bg-[#050a12]/90 backdrop-blur-md border-b border-cyan-500/10 px-4 py-3">
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
                <div className={`text-2xl font-bold neon-text ${
                  data.chain_health >= 70 ? 'text-[#00ff9d]' :
                  data.chain_health >= 40 ? 'text-[#ffbe0b]' : 'text-[#ff3366]'
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
                  className="text-[#ff3366] font-mono text-sm hover:text-red-300 no-underline"
                >
                  {weakest.name} ({weakest.health_score})
                </Link>
              </div>
            )}
          </div>
        </div>

        {data.summary && (
          <div className="max-w-6xl mx-auto mt-2">
            <p className="text-sm text-amber-300/80 bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-1.5">
              {data.summary}
            </p>
          </div>
        )}
      </div>

      {/* Tree visualization */}
      <div className="flex-1" style={{ background: '#050a12' }}>
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
          <Background color="#0a1628" gap={20} />
          <Controls
            style={{ background: '#0a1628', border: '1px solid rgba(0,224,255,0.1)', borderRadius: 8 }}
          />
        </ReactFlow>
      </div>

      {/* Legend */}
      <div className="bg-[#050a12]/90 backdrop-blur-md border-t border-cyan-500/10 px-4 py-2 flex items-center justify-center gap-6 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#00ff9d]/15 border border-[#00ff9d] inline-block" /> Healthy (70+)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#ffbe0b]/15 border border-[#ffbe0b] inline-block" /> Declining (40-69)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#ff3366]/15 border border-[#ff3366] inline-block" /> At Risk (&lt;40)
        </span>
        <span className="text-slate-700">|</span>
        <span>Click a node to view details</span>
      </div>
    </div>
  )
}
