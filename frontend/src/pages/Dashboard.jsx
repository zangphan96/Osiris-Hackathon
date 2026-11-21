import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, links } from '../api.js'
import { CodeTag, Loading, StatusBadge, useLoad } from '../components/common.jsx'
import Timetable from '../components/Timetable.jsx'
import { fmtDate, isoDate, mondayOf, runsInWeek } from '../lib.js'

const YEAR_TARGET = 60

function Stat({ label, value, sub, tone }) {
  return (
    <div className={`stat stat-${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

function Suggestions({ onAdded }) {
  const [interests, setInterests] = useState('')
  const [query, setQuery] = useState('')
  const { data, error, reload } = useLoad(() => api.suggestions(query), [query])

  const add = async (id) => {
    await api.setStatus(id, 'planned')
    await reload()
    onAdded()
  }

  return (
    <section className="card">
      <div className="card-head">
        <h3>Suggested next courses</h3>
        <span className="muted small">explainable, rule-based</span>
      </div>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault()
          setQuery(interests)
        }}
      >
        <input
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
          placeholder="Your interests, e.g. data, web, AI"
          aria-label="Interests"
        />
        <button className="btn">Update</button>
      </form>
      <Loading error={error}>
        {data && data.length === 0 && <p className="muted">No unlocked courses left – nice work.</p>}
        <ul className="suggest-list">
          {data?.map(({ course, score, reasons }) => (
            <li key={course.id}>
              <div className="suggest-main">
                <Link to={`/courses/${course.id}`}>
                  <CodeTag code={course.code} /> {course.title}
                </Link>
                <ul className="reasons">
                  {reasons.map((r) => (
                    <li key={r} className={r.startsWith('Timetable clash') ? 'warn' : ''}>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="suggest-side">
                <span className="score" title="Suggestion score">
                  {score}
                </span>
                <button className="btn btn-sm" onClick={() => add(course.id)}>
                  + Plan
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Loading>
    </section>
  )
}

export default function Dashboard() {
  const { data: plan, error, reload } = useLoad(() => api.plan(), [])
  const [week, setWeek] = useState(() => mondayOf(new Date()))

  const weekCourses = useMemo(
    () => (plan?.courses ?? []).filter((c) => c.status !== 'completed' && runsInWeek(c, week)),
    [plan, week],
  )

  if (!plan) return <Loading error={error} />
  const { totals, conflicts, courses } = plan
  const shiftWeek = (n) => {
    const d = new Date(week)
    d.setDate(d.getDate() + 7 * n)
    setWeek(d)
  }
  const sunday = new Date(week)
  sunday.setDate(sunday.getDate() + 6)

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Your plan, timetable and what to take next.</p>
        </div>
        <div className="row">
          <a className="btn" href={links.planIcs} download>
            📅 Export timetable (.ics)
          </a>
          <a className="btn btn-ghost" href={links.planJsonld} download>
            ⬇ Plan as JSON-LD
          </a>
        </div>
      </div>

      <div className="stats">
        <Stat
          label="ECTS completed"
          value={totals.completed}
          tone="completed"
          sub={
            <div className="progress" aria-label={`${totals.completed} of ${YEAR_TARGET} ECTS`}>
              <span style={{ width: `${Math.min(100, (totals.completed / YEAR_TARGET) * 100)}%` }} />
              <span
                className="progress-pending"
                style={{ width: `${Math.min(100, ((totals.in_progress + totals.planned) / YEAR_TARGET) * 100)}%` }}
              />
            </div>
          }
        />
        <Stat label="ECTS in progress" value={totals.in_progress} tone="in_progress" />
        <Stat label="ECTS planned" value={totals.planned} tone="planned" />
        <Stat
          label="Conflicts"
          value={conflicts.length}
          tone={conflicts.length ? 'error' : 'ok'}
          sub={conflicts.length ? 'see below' : 'all clear'}
        />
      </div>

      {conflicts.length > 0 && (
        <section className="card">
          <h3>Conflicts &amp; warnings</h3>
          <ul className="conflicts">
            {conflicts.map((c, i) => (
              <li key={i} className={`conflict-${c.severity}`}>
                <span className="conflict-type">{c.type === 'schedule' ? '⏰ Timetable' : '🔗 Prerequisite'}</span>
                {c.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h3>Timetable</h3>
          <div className="row">
            <button className="btn btn-sm btn-ghost" onClick={() => shiftWeek(-1)} aria-label="Previous week">
              ←
            </button>
            <span className="small">
              {fmtDate(isoDate(week))} – {fmtDate(isoDate(sunday))}
            </span>
            <button className="btn btn-sm btn-ghost" onClick={() => shiftWeek(1)} aria-label="Next week">
              →
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setWeek(mondayOf(new Date()))}>
              Today
            </button>
          </div>
        </div>
        {weekCourses.length === 0 ? (
          <p className="muted">No planned or in-progress courses run this week.</p>
        ) : (
          <Timetable courses={weekCourses} />
        )}
        <p className="muted small legend">
          <span className="legend-solid" /> in progress <span className="legend-dashed" /> planned
          <span className="legend-clash" /> clash
        </p>
      </section>

      <div className="grid-2">
        <section className="card">
          <h3>My courses</h3>
          {courses.length === 0 ? (
            <p className="muted">
              Nothing in your plan yet. <Link to="/courses">Browse courses</Link>.
            </p>
          ) : (
            <ul className="plan-list">
              {courses
                .slice()
                .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''))
                .map((c) => (
                  <li key={c.id}>
                    <Link to={`/courses/${c.id}`}>
                      <CodeTag code={c.code} /> {c.title}
                    </Link>
                    <span className="row">
                      <span className="muted small">{c.ects} EC</span>
                      <StatusBadge status={c.status} />
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </section>
        <Suggestions onAdded={reload} />
      </div>
    </div>
  )
}
