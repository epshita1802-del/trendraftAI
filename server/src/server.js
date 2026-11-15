import './config/env.js'
import app from './app.js'
import { connectDB } from './config/db.js'
import { aiSettings } from './services/styling.js'
const port = Number(process.env.PORT || 5000)
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24) {
  console.error('JWT_SECRET must be set to a random string at least 24 characters long in server/.env')
  process.exit(1)
}
process.on('unhandledRejection', reason => console.error('[server] unhandled rejection:', reason?.message || reason))
try {
  await connectDB()
  const ai = aiSettings()
  console.log(ai.configured ? `✓ AI styling enabled (model: ${ai.model})` : '• AI styling disabled (AI_API_KEY/GEMINI_API_KEY not set); using the local styling engine')
  app.listen(port, () => console.log(`✓ TrendCraft API running at http://localhost:${port}`))
} catch (error) {
  console.error('Could not start server:', error.message)
  process.exit(1)
}
