import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import api from '../services/api'
const AuthContext = createContext(null)
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const restore = useCallback(() => {
    if (!localStorage.getItem('tc_token')) { setLoading(false); return }
    setLoading(true); setAuthError('')
    api.get('/auth/me')
      .then(r => setUser(r.data.user))
      .catch(e => {
        // Only a rejected token ends the session. A network hiccup must not log the user out.
        if (e.response?.status === 401) localStorage.removeItem('tc_token')
        else setAuthError('Cannot reach the TrendCraft server. Make sure the backend is running, then try again.')
      })
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { restore() }, [restore])
  useEffect(() => {
    const onUnauthorized = () => { localStorage.removeItem('tc_token'); setUser(null) }
    window.addEventListener('tc:unauthorized', onUnauthorized)
    return () => window.removeEventListener('tc:unauthorized', onUnauthorized)
  }, [])
  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('tc_token', data.token); setUser(data.user); return data.user
  }
  const signup = async payload => {
    const { data } = await api.post('/auth/signup', payload)
    localStorage.setItem('tc_token', data.token); setUser(data.user); return data.user
  }
  const logout = () => { localStorage.removeItem('tc_token'); setUser(null) }
  const updateUser = u => setUser(u)
  return <AuthContext.Provider value={{ user, loading, authError, retry: restore, login, signup, logout, updateUser }}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)
