import { useCallback, useEffect, useState } from 'react'
import { STATUSES, statusLabel, courseHue } from '../lib.js'

/** Fetch helper: returns { data, error, loading, reload }. */
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(fn, deps)
  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true }))
    return load()
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => setState({ data: null, error, loading: false }))
  }, [load])
  useEffect(() => {
    reload()
  }, [reload])
  return { ...state, reload }
}

export function Loading({ error, children }) {
  if (error)
    return (
      <div className="alert alert-error">
        <strong>Could not reach the API.</strong> {error.message}
        <div className="muted small">Is the backend running on port 8000?</div>
      </div>
    )
  return children ?? <p className="muted">Loading…</p>
}

export function StatusBadge({ status }) {
  if (!status) return null
  return <span className={`badge badge-${status}`}>{statusLabel(status)}</span>
}

export function CodeTag({ code }) {
  return (
    <span className="code-tag" style={{ '--hue': courseHue(code) }}>
      {code}
    </span>
  )
}

export function StatusPicker({ value, onChange, disabled }) {
  return (
    <div className="segmented" role="radiogroup" aria-label="Plan status">
      {STATUSES.map((s) => (
        <button
          key={s.label}
          type="button"
          role="radio"
          aria-checked={(value ?? null) === s.value}
          className={(value ?? null) === s.value ? 'active' : ''}
          disabled={disabled}
          onClick={() => onChange(s.value)}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}
