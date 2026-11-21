import { useState } from 'react'
import { links } from '../api.js'

export default function SharePanel({ course }) {
  const [copied, setCopied] = useState(false)
  const shareUrl = `${window.location.origin}/courses/${course.id}`
  const dataUrl = `${window.location.origin}${links.jsonld(course.id)}`

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      window.prompt('Copy this link:', text)
    }
  }

  return (
    <section className="card share">
      <h3>Pass it on</h3>
      <p className="muted small">Open formats – works without this app.</p>
      <div className="share-actions">
        <a className="btn btn-primary" href={links.ics(course.id)} download>
          📅 Add to calendar (.ics)
        </a>
        <a className="btn" href={links.jsonldDownload(course.id)} download>
          ⬇ JSON-LD (schema.org)
        </a>
        <a className="btn btn-ghost" href={links.jsonld(course.id)} target="_blank" rel="noreferrer">
          View raw data ↗
        </a>
        <button className="btn btn-ghost" onClick={() => copy(shareUrl)}>
          {copied ? '✓ Copied' : '🔗 Copy share link'}
        </button>
      </div>
      <div className="qr">
        <img src={links.qr(shareUrl)} alt={`QR code linking to ${shareUrl}`} width="148" height="148" />
        <div className="small">
          <div className="muted">Scan to open this course</div>
          <code className="break">{shareUrl}</code>
          <div className="muted" style={{ marginTop: 8 }}>
            Data endpoint
          </div>
          <code className="break">{dataUrl}</code>
        </div>
      </div>
    </section>
  )
}
