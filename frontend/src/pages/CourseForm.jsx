import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { Loading } from '../components/common.jsx'
import { WEEKDAYS } from '../lib.js'

const EMPTY = {
  code: '',
  title: '',
  description: '',
  ects: 7.5,
  language: 'en',
  teacher: '',
  provider: 'Universiteit Utrecht',
  level: '',
  start_date: '',
  end_date: '',
  prerequisites: [],
  sessions: [],
}
const NEW_SESSION = { kind: 'Lecture', weekday: 0, start_time: '09:00', end_time: '10:45', location: '' }
const KINDS = ['Lecture', 'Werkcollege', 'Lab', 'Seminar', 'Exam']

export default function CourseForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [catalog, setCatalog] = useState([])
  const [extraPrereqs, setExtraPrereqs] = useState('')
  const [loadError, setLoadError] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(!editing)

  useEffect(() => {
    api.courses().then(setCatalog).catch(setLoadError)
    if (!editing) return
    api
      .course(id)
      .then((c) => {
        setForm({
          ...EMPTY,
          ...c,
          start_date: c.start_date || '',
          end_date: c.end_date || '',
          sessions: c.sessions.map(({ id: _id, ...s }) => s),
        })
        setLoaded(true)
      })
      .catch(setLoadError)
  }, [id, editing])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const setSession = (i, key, value) =>
    setForm((f) => ({ ...f, sessions: f.sessions.map((s, j) => (j === i ? { ...s, [key]: value } : s)) }))
  const togglePrereq = (code) =>
    setForm((f) => ({
      ...f,
      prerequisites: f.prerequisites.includes(code)
        ? f.prerequisites.filter((p) => p !== code)
        : [...f.prerequisites, code],
    }))

  const catalogCodes = catalog.map((c) => c.code).filter((c) => c !== form.code.toUpperCase())
  const externalPrereqs = form.prerequisites.filter((p) => !catalogCodes.includes(p))

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const extra = extraPrereqs.split(',').map((s) => s.trim()).filter(Boolean)
    const payload = {
      ...form,
      ects: Number(form.ects),
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      prerequisites: [...form.prerequisites, ...extra],
      sessions: form.sessions.map((s) => ({ ...s, weekday: Number(s.weekday) })),
    }
    for (const k of ['id', 'status', 'created_at', 'updated_at']) delete payload[k]
    try {
      const saved = editing ? await api.update(id, payload) : await api.create(payload)
      navigate(`/courses/${saved.id}`)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  if (loadError || !loaded) return <Loading error={loadError} />

  return (
    <form className="stack form" onSubmit={submit}>
      <Link to={editing ? `/courses/${id}` : '/courses'} className="back">
        ← Cancel
      </Link>
      <div className="page-head">
        <div>
          <h1>{editing ? `Edit ${form.code}` : 'Add a course'}</h1>
          <p className="muted">Stored as plain SQL; shared as iCalendar and schema.org JSON-LD.</p>
        </div>
      </div>

      {error && <div className="alert alert-error pre">{error}</div>}

      <section className="card">
        <h3>Basics</h3>
        <div className="fields">
          <label>
            Course code *
            <input required value={form.code} onChange={set('code')} placeholder="INFOB2DA" />
          </label>
          <label className="span-2">
            Title *
            <input required value={form.title} onChange={set('title')} placeholder="Data Analysis" />
          </label>
          <label className="span-3">
            Description
            <textarea rows={4} value={form.description} onChange={set('description')} />
          </label>
          <label>
            ECTS
            <input type="number" min="0" max="60" step="0.5" value={form.ects} onChange={set('ects')} />
          </label>
          <label>
            Language
            <select value={form.language} onChange={set('language')}>
              <option value="en">English</option>
              <option value="nl">Nederlands</option>
            </select>
          </label>
          <label>
            Level
            <input value={form.level} onChange={set('level')} placeholder="Bachelor 2" list="levels" />
            <datalist id="levels">
              {['Bachelor 1', 'Bachelor 2', 'Bachelor 3', 'Master'].map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </label>
          <label>
            Teacher
            <input value={form.teacher} onChange={set('teacher')} />
          </label>
          <label className="span-2">
            Provider
            <input value={form.provider} onChange={set('provider')} />
          </label>
          <label>
            Start date
            <input type="date" value={form.start_date} onChange={set('start_date')} />
          </label>
          <label>
            End date
            <input type="date" value={form.end_date} min={form.start_date} onChange={set('end_date')} />
          </label>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Weekly schedule</h3>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setForm((f) => ({ ...f, sessions: [...f.sessions, { ...NEW_SESSION }] }))}
          >
            + Add session
          </button>
        </div>
        {form.sessions.length === 0 && <p className="muted">No sessions yet.</p>}
        {form.sessions.map((s, i) => (
          <div key={i} className="session-row">
            <label>
              Type
              <input list="kinds" value={s.kind} onChange={(e) => setSession(i, 'kind', e.target.value)} />
            </label>
            <label>
              Day
              <select value={s.weekday} onChange={(e) => setSession(i, 'weekday', e.target.value)}>
                {WEEKDAYS.map((d, n) => (
                  <option key={d} value={n}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Start
              <input type="time" required value={s.start_time} onChange={(e) => setSession(i, 'start_time', e.target.value)} />
            </label>
            <label>
              End
              <input type="time" required value={s.end_time} onChange={(e) => setSession(i, 'end_time', e.target.value)} />
            </label>
            <label className="grow">
              Location
              <input value={s.location} onChange={(e) => setSession(i, 'location', e.target.value)} />
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-sm remove"
              aria-label="Remove session"
              onClick={() => setForm((f) => ({ ...f, sessions: f.sessions.filter((_, j) => j !== i) }))}
            >
              ✕
            </button>
          </div>
        ))}
        <datalist id="kinds">
          {KINDS.map((k) => (
            <option key={k} value={k} />
          ))}
        </datalist>
      </section>

      <section className="card">
        <h3>Prerequisites</h3>
        <p className="muted small">Click the courses a student must complete first.</p>
        <div className="chips">
          {catalogCodes.map((code) => (
            <button
              type="button"
              key={code}
              className={form.prerequisites.includes(code) ? 'chip active' : 'chip'}
              onClick={() => togglePrereq(code)}
            >
              {code}
            </button>
          ))}
          {externalPrereqs.map((code) => (
            <button type="button" key={code} className="chip active" onClick={() => togglePrereq(code)}>
              {code} ✕
            </button>
          ))}
        </div>
        <label style={{ marginTop: 12 }}>
          Other course codes (comma-separated, e.g. from another university)
          <input value={extraPrereqs} onChange={(e) => setExtraPrereqs(e.target.value)} placeholder="WISB101, …" />
        </label>
      </section>

      <div className="row">
        <button className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Create course'}
        </button>
      </div>
    </form>
  )
}
