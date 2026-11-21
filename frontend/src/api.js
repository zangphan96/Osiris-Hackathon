const BASE = '/api'

async function req(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`
    try {
      const j = await res.json()
      if (typeof j.detail === 'string') msg = j.detail
      else if (Array.isArray(j.detail))
        msg = j.detail.map((d) => `${d.loc.slice(1).join(' › ')}: ${d.msg}`).join('\n')
    } catch {
      /* keep status text */
    }
    throw new Error(msg)
  }
  return res.status === 204 ? null : res.json()
}

export const api = {
  courses: (q) => req(`/courses${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  course: (id) => req(`/courses/${id}`),
  create: (data) => req('/courses', { method: 'POST', body: data }),
  update: (id, data) => req(`/courses/${id}`, { method: 'PUT', body: data }),
  remove: (id) => req(`/courses/${id}`, { method: 'DELETE' }),
  setStatus: (id, status) => req(`/courses/${id}/status`, { method: 'PUT', body: { status } }),
  plan: () => req('/plan'),
  suggestions: (interests = '') => req(`/suggestions?interests=${encodeURIComponent(interests)}`),
  graph: () => req('/graph'),
  importDoc: (doc, asStatus) =>
    req(`/import${asStatus ? `?as_status=${asStatus}` : ''}`, { method: 'POST', body: doc }),
  reset: () => req('/demo/reset', { method: 'POST' }),
}

export const links = {
  ics: (id) => `${BASE}/courses/${id}.ics`,
  jsonld: (id) => `${BASE}/courses/${id}.jsonld`,
  jsonldDownload: (id) => `${BASE}/courses/${id}.jsonld?download=true`,
  qr: (data) => `${BASE}/qr.svg?data=${encodeURIComponent(data)}`,
  catalog: `${BASE}/export/catalog.jsonld`,
  planIcs: `${BASE}/export/plan.ics`,
  planJsonld: `${BASE}/export/plan.jsonld`,
}
