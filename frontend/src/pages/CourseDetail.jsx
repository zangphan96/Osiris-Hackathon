import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, links } from '../api.js'
import { CodeTag, Loading, StatusBadge, StatusPicker, useLoad } from '../components/common.jsx'
import SharePanel from '../components/SharePanel.jsx'
import { WEEKDAYS, fmtDate } from '../lib.js'

/** Embed the schema.org JSON-LD in the page <head> so crawlers & tools can read it too. */
function useJsonLdInHead(id) {
  useEffect(() => {
    let script
    let cancelled = false
    fetch(links.jsonld(id))
      .then((r) => (r.ok ? r.text() : null))
      .then((text) => {
        if (!text || cancelled) return
        script = document.createElement('script')
        script.type = 'application/ld+json'
        script.textContent = text
        document.head.appendChild(script)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      script?.remove()
    }
  }, [id])
}

export default function CourseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: course, error, reload } = useLoad(() => api.course(id), [id])
  const { data: all } = useLoad(() => api.courses(), [id])
  const [busy, setBusy] = useState(false)
  useJsonLdInHead(id)

  useEffect(() => {
    if (course) document.title = `${course.code} ${course.title} · Open Course Companion`
    return () => {
      document.title = 'Open Course Companion'
    }
  }, [course])

  if (!course) return <Loading error={error} />

  const byCode = Object.fromEntries((all ?? []).map((c) => [c.code, c]))
  const unlocks = (all ?? []).filter((c) => c.prerequisites.includes(course.code))

  const changeStatus = async (status) => {
    setBusy(true)
    try {
      await api.setStatus(course.id, status)
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(`Delete ${course.code} ${course.title}? This cannot be undone.`)) return
    await api.remove(course.id)
    navigate('/courses')
  }

  return (
    <div className="stack">
      <Link to="/courses" className="back">
        ← All courses
      </Link>
      <div className="page-head">
        <div>
          <div className="row">
            <CodeTag code={course.code} />
            <StatusBadge status={course.status} />
          </div>
          <h1>{course.title}</h1>
          <p className="muted">
            {course.provider}
            {course.level ? ` · ${course.level}` : ''}
          </p>
        </div>
        <div className="row">
          <Link to={`/courses/${course.id}/edit`} className="btn">
            ✎ Edit
          </Link>
          <button className="btn btn-danger" onClick={remove}>
            Delete
          </button>
        </div>
      </div>

      <div className="detail-layout">
        <div className="stack">
          <section className="card">
            <h3>My plan</h3>
            <StatusPicker value={course.status} onChange={changeStatus} disabled={busy} />
          </section>

          <section className="card">
            <dl className="facts">
              <div>
                <dt>ECTS</dt>
                <dd>{course.ects}</dd>
              </div>
              <div>
                <dt>Teacher</dt>
                <dd>{course.teacher || '—'}</dd>
              </div>
              <div>
                <dt>Language</dt>
                <dd>{course.language.toUpperCase()}</dd>
              </div>
              <div>
                <dt>Period</dt>
                <dd>
                  {fmtDate(course.start_date)} – {fmtDate(course.end_date)}
                </dd>
              </div>
            </dl>
            {course.description && <p className="description">{course.description}</p>}
          </section>

          <section className="card">
            <h3>Weekly schedule</h3>
            {course.sessions.length === 0 ? (
              <p className="muted">No sessions scheduled.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Day</th>
                    <th>Time</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {course.sessions.map((s) => (
                    <tr key={s.id}>
                      <td>{s.kind}</td>
                      <td>{WEEKDAYS[s.weekday]}</td>
                      <td>
                        {s.start_time}–{s.end_time}
                      </td>
                      <td>{s.location || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card">
            <h3>Prerequisites</h3>
            {course.prerequisites.length === 0 ? (
              <p className="muted">None – anyone can start this course.</p>
            ) : (
              <ul className="plan-list">
                {course.prerequisites.map((code) => {
                  const p = byCode[code]
                  return (
                    <li key={code}>
                      {p ? (
                        <Link to={`/courses/${p.id}`}>
                          <CodeTag code={code} /> {p.title}
                        </Link>
                      ) : (
                        <span>
                          <CodeTag code={code} /> <span className="muted">not in this catalog</span>
                        </span>
                      )}
                      {p?.status === 'completed' ? (
                        <span className="ok">✓ done</span>
                      ) : (
                        <StatusBadge status={p?.status} />
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            {unlocks.length > 0 && (
              <>
                <h4>Unlocks</h4>
                <div className="row wrap">
                  {unlocks.map((c) => (
                    <Link key={c.id} to={`/courses/${c.id}`}>
                      <CodeTag code={c.code} />
                    </Link>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>

        <SharePanel course={course} />
      </div>
    </div>
  )
}
