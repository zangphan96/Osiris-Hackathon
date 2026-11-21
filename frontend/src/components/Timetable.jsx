import { Link } from 'react-router-dom'
import { SHORT_DAYS, courseHue, toMinutes } from '../lib.js'

const DAY_START = 8 * 60
const DAY_END = 19 * 60
const PX_PER_MIN = 0.9

/** Assign side-by-side lanes to overlapping sessions within one day. */
function layoutDay(items) {
  const sorted = [...items].sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time))
  const laneEnds = []
  for (const it of sorted) {
    let lane = laneEnds.findIndex((end) => end <= toMinutes(it.start_time))
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = toMinutes(it.end_time)
    it.lane = lane
  }
  for (const it of sorted) {
    // number of lanes used by anything overlapping this item
    const overlapping = sorted.filter(
      (o) => toMinutes(o.start_time) < toMinutes(it.end_time) && toMinutes(it.start_time) < toMinutes(o.end_time),
    )
    it.lanes = Math.max(...overlapping.map((o) => o.lane)) + 1
    it.clash = overlapping.length > 1
  }
  return sorted
}

export default function Timetable({ courses }) {
  const days = [0, 1, 2, 3, 4]
  const hasWeekend = courses.some((c) => c.sessions.some((s) => s.weekday > 4))
  if (hasWeekend) days.push(5, 6)

  const byDay = days.map((d) =>
    layoutDay(
      courses.flatMap((c) =>
        c.sessions.filter((s) => s.weekday === d).map((s) => ({ ...s, course: c })),
      ),
    ),
  )
  const hours = []
  for (let m = DAY_START; m < DAY_END; m += 60) hours.push(m)
  const height = (DAY_END - DAY_START) * PX_PER_MIN

  return (
    <div className="timetable-scroll">
      <div className="timetable" style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(110px, 1fr))` }}>
        <div />
        {days.map((d) => (
          <div key={d} className="tt-dayhead">
            {SHORT_DAYS[d]}
          </div>
        ))}
        <div className="tt-hours" style={{ height }}>
          {hours.map((m) => (
            <span key={m} style={{ top: (m - DAY_START) * PX_PER_MIN }}>
              {String(m / 60).padStart(2, '0')}:00
            </span>
          ))}
        </div>
        {byDay.map((items, i) => (
          <div key={days[i]} className="tt-day" style={{ height }}>
            {hours.map((m) => (
              <div key={m} className="tt-line" style={{ top: (m - DAY_START) * PX_PER_MIN }} />
            ))}
            {items.map((it) => {
              const top = (Math.max(toMinutes(it.start_time), DAY_START) - DAY_START) * PX_PER_MIN
              const h = (toMinutes(it.end_time) - toMinutes(it.start_time)) * PX_PER_MIN
              return (
                <Link
                  key={`${it.course.id}-${it.id}`}
                  to={`/courses/${it.course.id}`}
                  className={`tt-block ${it.clash ? 'clash' : ''} ${it.course.status === 'planned' ? 'tentative' : ''}`}
                  style={{
                    top,
                    height: h,
                    left: `calc(${(it.lane / it.lanes) * 100}% + 2px)`,
                    width: `calc(${100 / it.lanes}% - 4px)`,
                    '--hue': courseHue(it.course.code),
                  }}
                  title={`${it.course.code} ${it.course.title}\n${it.kind} ${it.start_time}–${it.end_time}\n${it.location}`}
                >
                  <strong>{it.course.code}</strong>
                  <span>{it.kind}</span>
                  <span className="tt-meta">
                    {it.start_time}–{it.end_time}
                    {it.location ? ` · ${it.location}` : ''}
                  </span>
                </Link>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
