import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backend = process.env.BACKEND_URL || 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // reachable from a phone on the same network (for the QR demo)
    port: 5173,
    proxy: {
      '/api': backend,
      '/docs': backend,
      '/openapi.json': backend,
    },
  },
})
