import { useNavigate } from 'react-router-dom'
import { statusLabel } from '../lib.js'

const W = 180
const H = 58
const COL_GAP = 70
const ROW_GAP = 18
const PAD = 16

/** Layered DAG: column = prerequisite depth, edges are prerequisite → course. */
export default function PrereqGraph({ graph, highlight }) {
  const navigate = useNavigate()
  const cols = {}
  for (const n of graph.nodes) (cols[n.depth] ||= []).push(n)
  const pos = {}
  let maxRows = 0
  Object.entries(cols).forEach(([depth, nodes]) => {
    maxRows = Math.max(maxRows, nodes.length)
    nodes.forEach((n, i) => {
      pos[n.code] = { x: PAD + Number(depth) * (W + COL_GAP), y: PAD + i * (H + ROW_GAP) }
    })
  })
  const nCols = Object.keys(cols).length
  const width = PAD * 2 + nCols * W + (nCols - 1) * COL_GAP
  const height = PAD * 2 + maxRows * (H + ROW_GAP) - ROW_GAP

  const related = new Set()
  if (highlight) {
    related.add(highlight)
    graph.edges.forEach((e) => {
      if (e.to === highlight) related.add(e.from)
      if (e.from === highlight) related.add(e.to)
    })
  }

  return (
    <div className="graph-scroll">
      <svg width={width} height={height} className="graph" role="img" aria-label="Prerequisite graph">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" className="graph-arrow" />
          </marker>
        </defs>
        {graph.edges.map((e) => {
          const a = pos[e.from], b = pos[e.to]
          if (!a || !b) return null
          const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x - 2, y2 = b.y + H / 2
          const mx = (x1 + x2) / 2
          const dim = highlight && !(related.has(e.from) && related.has(e.to) && (e.from === highlight || e.to === highlight))
          return (
            <path
              key={`${e.from}-${e.to}`}
              d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
              className={`graph-edge ${dim ? 'dim' : ''}`}
              markerEnd="url(#arrow)"
            />
          )
        })}
        {graph.nodes.map((n) => {
          const p = pos[n.code]
          const dim = highlight && !related.has(n.code)
          return (
            <g
              key={n.code}
              transform={`translate(${p.x},${p.y})`}
              className={`graph-node status-${n.status || 'none'} ${n.external ? 'external' : ''} ${dim ? 'dim' : ''} ${n.code === highlight ? 'focus' : ''}`}
              onClick={() => n.id && navigate(`/courses/${n.id}`)}
              style={{ cursor: n.id ? 'pointer' : 'default' }}
            >
              <title>{`${n.code} – ${n.title}${n.status ? ` (${statusLabel(n.status)})` : ''}`}</title>
              <rect width={W} height={H} rx="10" />
              <text x="12" y="23" className="graph-code">
                {n.code}
              </text>
              <text x="12" y="42" className="graph-title">
                {n.title.length > 24 ? n.title.slice(0, 23) + '…' : n.title}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
