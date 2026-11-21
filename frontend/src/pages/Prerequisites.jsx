import { useState } from 'react'
import { api } from '../api.js'
import { Loading, useLoad } from '../components/common.jsx'
import PrereqGraph from '../components/PrereqGraph.jsx'

export default function Prerequisites() {
  const { data, error } = useLoad(() => api.graph(), [])
  const [focus, setFocus] = useState('')

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Prerequisite tree</h1>
          <p className="muted">Arrows point from a prerequisite to the course it unlocks. Click a course to open it.</p>
        </div>
        {data && (
          <label className="inline-label">
            Highlight
            <select value={focus} onChange={(e) => setFocus(e.target.value)}>
              <option value="">— none —</option>
              {data.nodes.map((n) => (
                <option key={n.code} value={n.code}>
                  {n.code}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <section className="card">
        <Loading error={error}>
          {data &&
            (data.nodes.length === 0 ? (
              <p className="muted">No courses yet.</p>
            ) : (
              <PrereqGraph graph={data} highlight={focus || null} />
            ))}
        </Loading>
        <p className="muted small legend">
          <span className="legend-node status-completed" /> completed
          <span className="legend-node status-in_progress" /> in progress
          <span className="legend-node status-planned" /> planned
          <span className="legend-node status-none" /> not in plan
          <span className="legend-node external" /> outside this catalog
        </p>
      </section>
    </div>
  )
}
