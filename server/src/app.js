import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.js'
import wardrobeRoutes from './routes/wardrobe.js'
import outfitRoutes from './routes/outfits.js'
import { uploadDir } from './config/paths.js'
import { aiSettings } from './services/styling.js'

const app = express()

// Allowed browser origins: whatever is configured, plus local dev hosts on any port
// (localhost and 127.0.0.1 are different origins to the browser).
const configured = [process.env.CLIENT_ORIGIN, process.env.CLIENT_URL]
  .filter(Boolean)
  .map(o => o.replace(/\/$/, ''))
const localDev = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || configured.includes(origin) || localDev.test(origin)) return cb(null, true)
      cb(null, false)
    },
  }),
)
app.use(express.json({ limit: '1mb' }))
app.use(
  '/uploads',
  express.static(uploadDir, {
    index: false,
    dotfiles: 'deny',
    setHeaders: res => res.setHeader('X-Content-Type-Options', 'nosniff'),
  }),
)
app.get('/api/health', (_req, res) => {
  const ai = aiSettings()
  res.json({
    ok: true,
    app: 'TrendCraft AI',
    ai: { configured: ai.configured, model: ai.configured ? ai.model : null },
  })
})
app.use('/api/auth', authRoutes)
app.use('/api/wardrobe', wardrobeRoutes)
app.use('/api/outfits', outfitRoutes)
app.use('/api', (_req, res) => res.status(404).json({ message: 'Unknown API route.' }))
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'Image must be 5 MB or smaller.' })
  if (err?.name === 'CastError') return res.status(400).json({ message: 'That identifier is not valid.' })
  if (err?.name === 'ValidationError') return res.status(400).json({ message: 'Some fields are not valid.' })
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ message: 'Request body is not valid JSON.' })
  if (err?.status && err.status < 500) return res.status(err.status).json({ message: err.message || 'Bad request.' })
  if (err?.message?.startsWith('Please upload')) return res.status(400).json({ message: err.message })
  // Never send stack traces or internals to the browser; log a short line instead.
  console.error('[server] unhandled error:', err?.name, err?.message)
  res.status(500).json({ message: 'Unexpected server error.' })
})
export default app
