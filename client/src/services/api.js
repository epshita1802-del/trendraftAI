import axios from 'axios'

// Default '/api' goes through the Vite dev proxy. Set VITE_API_URL (for example
// http://localhost:5000/api) in client/.env if the API is hosted somewhere else.
const apiBase = import.meta.env.VITE_API_URL || '/api'
const api = axios.create({ baseURL: apiBase, timeout: 30000 })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('tc_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// A 401 from anything except the login/signup forms means the session is gone.
api.interceptors.response.use(
  response => response,
  error => {
    const url = error.config?.url || ''
    if (error.response?.status === 401 && !/^\/auth\/(login|signup)/.test(url)) {
      window.dispatchEvent(new Event('tc:unauthorized'))
    }
    return Promise.reject(error)
  },
)

// Uploaded images are served by the API server at /uploads/...
const assetOrigin = import.meta.env.VITE_ASSET_URL || (/^https?:\/\//.test(apiBase) ? new URL(apiBase).origin : '')
export const assetUrl = path => {
  if (!path) return ''
  if (/^https?:\/\//.test(path)) return path
  return `${assetOrigin}${path.startsWith('/') ? path : `/${path}`}`
}

/** A human-readable message for any failed request. */
export function errorMessage(error, fallback = 'Something went wrong.') {
  if (error?.code === 'ECONNABORTED') return 'The request took too long. Please try again.'
  if (!error?.response) return 'Cannot reach the TrendCraft server. Make sure the backend is running (npm run dev) and try again.'
  if (error.response.status === 401) return 'Your session has expired. Please log in again.'
  return error.response.data?.message || fallback
}
export default api
