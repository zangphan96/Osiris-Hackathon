import { NavLink, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import Catalog from './pages/Catalog.jsx'
import CourseDetail from './pages/CourseDetail.jsx'
import CourseForm from './pages/CourseForm.jsx'
import Prerequisites from './pages/Prerequisites.jsx'
import DataPage from './pages/DataPage.jsx'

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/courses', label: 'Courses' },
  { to: '/prerequisites', label: 'Prerequisites' },
  { to: '/data', label: 'Import / Export' },
]

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <span className="brand-mark" aria-hidden>◆</span>
          <span>
            Open Course Companion
            <small>your course data, portable by design</small>
          </span>
        </NavLink>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              {n.label}
            </NavLink>
          ))}
          <NavLink to="/courses/new" className="btn btn-primary btn-sm">
            + Add course
          </NavLink>
        </nav>
      </header>

      <main className="container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/courses" element={<Catalog />} />
          <Route path="/courses/new" element={<CourseForm />} />
          <Route path="/courses/:id" element={<CourseDetail />} />
          <Route path="/courses/:id/edit" element={<CourseForm />} />
          <Route path="/prerequisites" element={<Prerequisites />} />
          <Route path="/data" element={<DataPage />} />
          <Route path="*" element={<p className="muted">Page not found.</p>} />
        </Routes>
      </main>

      <footer className="footer">
        Built on open standards: <a href="/docs">OpenAPI</a> · iCalendar (RFC 5545) · JSON-LD + schema.org/Course
        <span className="sep">·</span> UU Osiris Hackathon
      </footer>
    </div>
  )
}
