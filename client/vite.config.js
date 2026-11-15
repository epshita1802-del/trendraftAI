import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// In development the browser talks to Vite (same origin) and Vite forwards /api and
// /uploads to the Express server. That removes CORS problems and makes image URLs work
// whether you open the app as localhost, 127.0.0.1 or from another device.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_PROXY || 'http://localhost:5000'
  const proxy = { '/api': { target, changeOrigin: true }, '/uploads': { target, changeOrigin: true } }
  return { plugins: [react()], server: { port: 5173, proxy }, preview: { proxy } }
})
