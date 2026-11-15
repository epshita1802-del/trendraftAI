import { useEffect, useRef, useState } from 'react'
import { Sparkles, RefreshCw, Shirt, SlidersHorizontal, ArrowRight, Check, AlertTriangle, Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api, { errorMessage } from '../services/api'
import { useAuth } from '../context/AuthContext'
import useWardrobe from '../hooks/useWardrobe'
import OutfitCard from '../components/OutfitCard'

const occasions = ['Casual', 'College', 'Office', 'Party', 'Date', 'Festive', 'Formal']
const styles = ['chic', 'minimal', 'streetwear', 'Korean-inspired', 'elegant', 'casual', 'experimental']
const counts = [3, 4, 5]

export default function Studio() {
  const { user } = useAuth()
  const { items, status: wardrobeStatus, error: wardrobeError, reload } = useWardrobe()
  const [occasion, setOccasion] = useState('College')
  const [style, setStyle] = useState(user?.preferences?.style || 'chic')
  const [weather, setWeather] = useState('Mild')
  const [focus, setFocus] = useState('Any')
  const [count, setCount] = useState(4)
  const [result, setResult] = useState(null) // last successful /outfits/generate payload
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState([])
  const [savedKeys, setSavedKeys] = useState(() => new Set())
  const [savingKey, setSavingKey] = useState('')
  const inFlight = useRef(false)

  useEffect(() => {
    api.get('/outfits/saved').then(r => setSavedKeys(new Set(r.data.outfits.map(o => o.snapshot?.key).filter(Boolean)))).catch(() => {})
  }, [])

  // No manual selection: the server reads this user's whole wardrobe and styles it automatically.
  const generate = async () => {
    if (inFlight.current) return // ignore accidental double clicks
    inFlight.current = true
    setBusy(true); setError('')
    try {
      const { data } = await api.post('/outfits/generate', { occasion, style, weather, focus, count, history }, { timeout: 90000 })
      setResult(data)
      setHistory(prev => [...prev, ...data.recommendations.map(r => ({ key: r.key, foundationKey: r.foundationKey }))].slice(-40))
    } catch (e) {
      setError(errorMessage(e, 'Could not style your outfits.'))
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  const save = async outfit => {
    setSavingKey(outfit.key)
    try {
      const { data } = await api.post('/outfits/saved', { recommendation: outfit, occasion: outfit.occasion, style: outfit.style })
      setSavedKeys(prev => new Set(prev).add(outfit.key))
      toast.success(data.alreadySaved ? 'This look was already in your saved looks' : 'Saved to your favourite looks ♡')
    } catch (e) {
      toast.error(errorMessage(e, 'Could not save this look.'))
    } finally {
      setSavingKey('')
    }
  }

  const recs = result?.recommendations || []
  const wardrobeEmpty = wardrobeStatus === 'ready' && items.length === 0
  const aiNote = result && result.aiStatus && !result.aiStatus.used && recs.length > 0 ? result.aiStatus : null

  return (
    <div className="page-section">
      <div className="page-heading">
        <div><span className="eyebrow">YOUR PERSONAL FASHION PLAYGROUND</span><h1>The outfit <em>studio.</em></h1><p>One wardrobe. A hundred ways to feel like yourself.</p></div>
        {result && <span className="mode-pill"><span /> {result.source === 'ai' ? 'AI styling' : result.source === 'mixed' ? 'AI + local styling' : 'Local styling'}</span>}
      </div>
      <div className="studio-layout">
        <section className="studio-controls panel">
          <div className="panel-heading"><div><span className="eyebrow">FIRST, SET THE MOOD</span><h2>What are we dressing for?</h2></div><SlidersHorizontal size={18} /></div>
          <label className="field-label">The occasion</label>
          <div className="occasion-grid">{occasions.map(o => <button key={o} className={occasion === o ? 'picked' : ''} onClick={() => setOccasion(o)}>{o}</button>)}</div>
          <label className="field-label">Your style mood</label>
          <select className="full-select" value={style} onChange={e => setStyle(e.target.value)}>{styles.map(s => <option key={s}>{s}</option>)}</select>
          <div className="form-two">
            <label className="field-label">Weather / season<select className="full-select" value={weather} onChange={e => setWeather(e.target.value)}>{['Mild', 'Warm', 'Hot', 'Cool', 'Cold', 'Rainy'].map(s => <option key={s}>{s}</option>)}</select></label>
            <label className="field-label">Colour direction<select className="full-select" value={focus} onChange={e => setFocus(e.target.value)}>{['Any', 'Neutrals', 'Pastels', 'Earth tones', 'Bold colours', 'Monochrome'].map(s => <option key={s}>{s}</option>)}</select></label>
          </div>
          <label className="field-label">How many looks?</label>
          <div className="occasion-grid count-grid">{counts.map(n => <button key={n} className={count === n ? 'picked' : ''} onClick={() => setCount(n)}>{n}</button>)}</div>
          <div className="wardrobe-availability">
            <span><Shirt size={16} /> Working with your wardrobe</span>
            <strong>{wardrobeStatus === 'loading' ? '…' : wardrobeStatus === 'error' ? '—' : `${items.length} pieces`}</strong>
          </div>
          <button className="button button-rose button-full generate-button" onClick={generate} disabled={busy || wardrobeStatus === 'loading' || wardrobeEmpty}>
            <Sparkles size={17} />{busy ? 'Styling your wardrobe…' : recs.length ? 'Generate new looks' : 'Generate outfits'} <ArrowRight size={16} />
          </button>
          <p className="microcopy">We pick the pieces for you. Every suggestion uses clothes you actually own.</p>
        </section>

        <section className="studio-result">
          {wardrobeStatus === 'error' && (
            <div className="state-box"><AlertTriangle size={22} /><h2>We couldn’t load your wardrobe.</h2><p>{wardrobeError}</p><button className="button button-rose" onClick={reload}><RefreshCw size={15} /> Try again</button></div>
          )}
          {wardrobeEmpty && !busy && (
            <div className="empty-state"><span className="empty-flower">✿</span><h2>Your wardrobe is empty.</h2><p>Add a few pieces (a top and a bottom, or a dress) and we’ll build outfits from them automatically.</p><Link to="/app/wardrobe" className="button button-rose">Add your first pieces</Link></div>
          )}
          {error && !busy && (
            <div className="state-box"><AlertTriangle size={22} /><h2>Something got in the way.</h2><p>{error}</p><button className="button button-rose" onClick={generate}><RefreshCw size={15} /> Try again</button></div>
          )}
          {busy && (
            <div className="outfit-stack" aria-busy="true" aria-live="polite">
              <p className="working-note"><Sparkles size={15} /> Looking through your wardrobe for the best combinations…</p>
              {Array.from({ length: count }, (_, i) => <div className="outfit-card skeleton" key={i} />)}
            </div>
          )}
          {!busy && !error && wardrobeStatus === 'ready' && !wardrobeEmpty && !result && (
            <div className="studio-welcome">
              <div className="welcome-art"><div className="welcome-hanger">♧</div><span>✦</span><i>♡</i></div>
              <span className="eyebrow">A LITTLE INSPIRATION GOES A LONG WAY</span>
              <h2>Your next favourite outfit<br /><em>is already in your wardrobe.</em></h2>
              <p>Pick the occasion and your mood, then press Generate. We’ll choose matching pieces from your wardrobe and show them with your own photos.</p>
              <button className="button button-rose" onClick={generate}><Sparkles size={16} /> Find my looks</button>
              <div className="studio-promise"><span><Check size={14} /> Real wardrobe pieces</span><span><Check size={14} /> No manual picking</span><span><Check size={14} /> Fresh combinations</span></div>
            </div>
          )}
          {!busy && !error && result && recs.length === 0 && (
            <div className="empty-state"><span className="empty-flower">♡</span><h2>{result.code === 'INCOMPLETE_WARDROBE' ? 'Almost there.' : 'No outfits yet.'}</h2><p>{result.message || 'We could not put together a complete outfit from your wardrobe yet.'}</p><Link to="/app/wardrobe" className="button button-rose">Go to my wardrobe</Link></div>
          )}
          {!busy && !error && recs.length > 0 && (
            <div className="outfit-stack">
              {aiNote && <div className="notice warn"><Info size={16} /><div><strong>{aiNote.code === 'AI_NOT_CONFIGURED' ? 'Using the local styling engine' : 'AI styling was not used this time'}</strong><p>{aiNote.message}</p></div></div>}
              {result.aiStatus?.used && result.aiStatus.message && <div className="notice"><Info size={16} /><div><p>{result.aiStatus.message}</p></div></div>}
              {result.message && <div className="notice"><Info size={16} /><div><p>{result.message}</p></div></div>}
              {recs.map(o => <OutfitCard key={o.key} outfit={o} saved={savedKeys.has(o.key)} saving={savingKey === o.key} onSave={save} />)}
              <div className="result-actions">
                <button className="button button-light" onClick={generate} disabled={busy}><RefreshCw size={16} /> Regenerate</button>
                <Link to="/app/saved" className="button button-dark">View saved looks</Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
