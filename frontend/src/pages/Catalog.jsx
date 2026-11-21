import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { CodeTag, Loading, StatusBadge, useLoad } from '../components/common.jsx'
import { SHORT_DAYS, STATUSES, fmtDate } from '../lib.js'

export default function Catalog() {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200)
    return () => clearTimeout(t)
  }, [q])

  const { data, error } = useLoad(() => api.courses(debounced), [debounced])
  const shown = (data ?? []).filter((c) =>
    filter === 'all' ? true : filter === 'none' ? !c.status : c.status === filter,
  )

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Courses</h1>
          <p className="muted">{data ? `${data.length} course${data.length === 1 ? '' : 's'}` : ' '}</p>
        </div>
        <Link to="/courses/new" className="btn btn-primary">
          + Add course
        </Link>
      </div>

      <div className="toolbar">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search code, title, teacher…"
          aria-label="Search courses"
        />
        <div className="chips">
          <button className={filter === 'all' ? 'chip active' : 'chip'} onClick={() => setFilter('all')}>
            All
          </button>
          {STATUSES.map((s) => (
            <button
              key={s.label}
              className={filter === (s.value ?? 'none') ? 'chip active' : 'chip'}
              onClick={() => setFilter(s.value ?? 'none')}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <Loading error={error}>
        {data && shown.length === 0 && <p className="muted">No courses match.</p>}
        <div className="course-grid">
          {shown.map((c) => (
            <Link key={c.id} to={`/courses/${c.id}`} className="card course-card">
              <div className="course-card-top">
                <CodeTag code={c.code} />
                <StatusBadge status={c.status} />
              </div>
              <h3>{c.title}</h3>
              <p className="muted clamp">{c.description || 'No description.'}</p>
              <div className="course-card-meta small">
                <span>{c.ects} EC</span>
                {c.level && <span>{c.level}</span>}
                {c.start_date && <span>from {fmtDate(c.start_date)}</span>}
                {c.sessions.length > 0 && (
                  <span>{[...new Set(c.sessions.map((s) => SHORT_DAYS[s.weekday]))].join(', ')}</span>
                )}
              </div>
              {c.prerequisites.length > 0 && (
                <div className="small muted">Requires: {c.prerequisites.join(', ')}</div>
              )}
            </Link>
          ))}
        </div>
      </Loading>
    </div>
  )
}
