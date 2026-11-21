import { useState } from 'react'
import { api, links } from '../api.js'
import { CodeTag } from '../components/common.jsx'

const IMPORT_AS = [
  { value: '', label: 'Catalog only' },
  { value: 'planned', label: 'Add to my plan as Planned' },
  { value: 'completed', label: 'Add to my plan as Completed' },
]

export default function DataPage() {
  const [asStatus, setAsStatus] = useState('')
  const [url, setUrl] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const run = async (getDoc) => {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const doc = await getDoc()
      setResult(await api.importDoc(doc, asStatus || null))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const onFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    run(async () => {
      try {
        return JSON.parse(await file.text())
      } catch {
        throw new Error(`${file.name} is not valid JSON / JSON-LD`)
      }
    })
  }

  const onUrl = (e) => {
    e.preventDefault()
    run(async () => {
      const res = await fetch(url.trim(), { headers: { Accept: 'application/ld+json, application/json' } })
      if (!res.ok) throw new Error(`Could not fetch ${url} (${res.status})`)
      return res.json()
    })
  }

  const reset = async () => {
    if (!window.confirm('Replace all courses and your plan with the sample data?')) return
    await api.reset()
    setResult(null)
    setError(null)
    window.alert('Sample data restored.')
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Import / Export</h1>
          <p className="muted">
            <strong>Portability test:</strong> if this app disappeared tomorrow, would you still have your data in a
            form other tools can use? Yes – download it below.
          </p>
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <h3>Export</h3>
          <ul className="export-list">
            <li>
              <a className="btn btn-primary" href={links.planIcs} download>
                📅 My timetable (.ics)
              </a>
              <span className="muted small">
                iCalendar – import into Google Calendar, Outlook or Apple Calendar.
              </span>
            </li>
            <li>
              <a className="btn" href={links.planJsonld} download>
                ⬇ My plan (JSON-LD)
              </a>
              <span className="muted small">Your planned, active and completed courses.</span>
            </li>
            <li>
              <a className="btn" href={links.catalog} download>
                ⬇ Full catalog (JSON-LD)
              </a>
              <span className="muted small">
                All courses as a schema.org <code>ItemList</code> of <code>Course</code>.
              </span>
            </li>
            <li>
              <a className="btn btn-ghost" href="/docs" target="_blank" rel="noreferrer">
                OpenAPI docs ↗
              </a>
              <span className="muted small">Every endpoint, machine-readable at /openapi.json.</span>
            </li>
          </ul>
        </section>

        <section className="card">
          <h3>Import</h3>
          <p className="muted small">
            Load a schema.org/Course JSON-LD file – from this app, a second copy of it, or any other system. Existing
            courses are updated by course code.
          </p>
          <label>
            After import
            <select value={asStatus} onChange={(e) => setAsStatus(e.target.value)}>
              {IMPORT_AS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="file-drop">
            <input type="file" accept=".jsonld,.json,application/ld+json,application/json" onChange={onFile} disabled={busy} />
            <span>📂 Choose a .jsonld / .json file</span>
          </label>
          <form className="inline-form" onSubmit={onUrl}>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="…or paste a JSON-LD URL, e.g. http://other-laptop:8000/api/courses/1.jsonld"
              aria-label="JSON-LD URL"
            />
            <button className="btn" disabled={busy}>
              Fetch
            </button>
          </form>

          {busy && <p className="muted">Importing…</p>}
          {error && <div className="alert alert-error">{error}</div>}
          {result && (
            <div className="alert alert-ok">
              <strong>
                Imported {result.created.length} new, updated {result.updated.length}
                {result.skipped.length ? `, skipped ${result.skipped.length}` : ''}.
              </strong>
              <div className="row wrap" style={{ marginTop: 8 }}>
                {[...result.created, ...result.updated].map((c) => (
                  <CodeTag key={c} code={c} />
                ))}
              </div>
              {result.skipped.map((s) => (
                <div key={s} className="small muted">
                  Skipped: {s}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <h3>Demo tools</h3>
        <button className="btn btn-danger" onClick={reset}>
          Reset to sample data
        </button>
      </section>
    </div>
  )
}
