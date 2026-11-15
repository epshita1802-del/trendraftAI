import { useCallback, useEffect, useRef, useState } from 'react'
import api, { errorMessage } from '../services/api'

/** Loads the signed-in user's wardrobe with explicit loading / error states. */
export default function useWardrobe() {
  const [items, setItems] = useState([])
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [error, setError] = useState('')
  const latest = useRef(0)
  const load = useCallback(async opts => {
    const run = ++latest.current
    // A silent reload (after add/edit) keeps the grid on screen instead of flashing a spinner.
    if (!opts?.silent) setStatus('loading')
    setError('')
    try {
      const { data } = await api.get('/wardrobe')
      if (run !== latest.current) return
      setItems(Array.isArray(data.items) ? data.items : [])
      setStatus('ready')
    } catch (e) {
      if (run !== latest.current) return
      setError(errorMessage(e, 'Could not load your wardrobe.'))
      setStatus('error')
    }
  }, [])
  useEffect(() => { load(); return () => { latest.current++ } }, [load])
  return { items, setItems, status, error, reload: load }
}
