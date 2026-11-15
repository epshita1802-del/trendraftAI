import path from 'node:path'
import { fileURLToPath } from 'node:url'
// Resolve relative to this file, not process.cwd(), so uploads are found no matter
// which folder the server was started from (root `npm run dev` or `server/`).
const here = path.dirname(fileURLToPath(import.meta.url))
export const uploadDir = path.resolve(here, '..', '..', 'uploads')
