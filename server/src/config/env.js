import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// Always load server/.env, even if the process was started from another folder.
const here = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(here, '..', '..', '.env') })
