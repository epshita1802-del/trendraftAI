import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
export default function Protected() {
  const { user, loading, authError, retry } = useAuth()
  if (loading) return <div className="page-loading">Preparing your wardrobe…</div>
  if (!user && authError) return <div className="page-loading"><div className="state-box"><h2>We can’t reach the server.</h2><p>{authError}</p><button className="button button-rose" onClick={retry}>Try again</button></div></div>
  return user ? <Outlet /> : <Navigate to="/login" replace />
}
