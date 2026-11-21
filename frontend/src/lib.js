export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const STATUSES = [
  { value: null, label: 'Not in plan' },
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
]

export const statusLabel = (s) => STATUSES.find((x) => x.value === (s ?? null))?.label ?? s

/** Stable hue per course code so a course has the same colour everywhere. */
export function courseHue(code) {
  let h = 0
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}

export const toMinutes = (t) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export const fmtDate = (iso) =>
  iso ? new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

/** Monday (local) of the week containing `d`, as a Date at 00:00. */
export function mondayOf(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

export const isoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Is the course running at some point in the week starting at `monday`? */
export function runsInWeek(course, monday) {
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const from = course.start_date, to = course.end_date
  if (from && from > isoDate(sunday)) return false
  if (to && to < isoDate(monday)) return false
  return true
}
