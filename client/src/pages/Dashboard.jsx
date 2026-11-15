import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Heart, Shirt, Sparkles, Plus, WandSparkles, Sun } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api, { errorMessage } from '../services/api'
import toast from 'react-hot-toast'
import useWardrobe from '../hooks/useWardrobe'
import { OutfitCollage, SourceBadge } from '../components/OutfitCard'
export default function Dashboard() {
  const { user } = useAuth()
  const { items, status: wardrobeStatus } = useWardrobe()
  const [saved,setSaved] = useState([]), [outfit,setOutfit] = useState(null), [note,setNote] = useState(''), [busy,setBusy] = useState(false)
  useEffect(()=>{ api.get('/outfits/saved').then(r=>setSaved(r.data.outfits)).catch(()=>{}) },[])
  const generate = async () => {
    if (busy) return
    setBusy(true); setNote('')
    try {
      const r = await api.post('/outfits/generate',{occasion:'College',style:user?.preferences?.style||'chic',count:1},{timeout:90000})
      const first = r.data.recommendations?.[0] || null
      setOutfit(first)
      if (!first) setNote(r.data.message || 'Add a few more pieces to your wardrobe to get an outfit idea.')
    } catch(e) { toast.error(errorMessage(e,'Could not generate a look.')) } finally { setBusy(false) }
  }
  return <div className="dashboard-page">
    <div className="welcome-row"><div><span className="eyebrow">TUESDAY, YOUR WAY ✿</span><h1>A lovely day to get dressed, <em>{user?.name?.split(' ')[0]||'you'}.</em></h1><p className="muted">Your style space is ready when you are.</p></div><Link to="/app/studio" className="button button-dark"><Sparkles size={16}/> Open outfit studio</Link></div>
    <div className="stats-grid"><div className="stat-card"><span className="stat-icon"><Shirt size={19}/></span><span className="stat-label">WARDROBE PIECES</span><strong>{wardrobeStatus==='ready'?items.length:'–'}</strong><Link to="/app/wardrobe">View wardrobe <ArrowRight size={13}/></Link></div><div className="stat-card"><span className="stat-icon lavender"><Heart size={19}/></span><span className="stat-label">SAVED LOOKS</span><strong>{saved.length}</strong><Link to="/app/saved">Your favourites <ArrowRight size={13}/></Link></div><div className="stat-card"><span className="stat-icon peach"><Sparkles size={19}/></span><span className="stat-label">STYLE MOOD</span><strong className="stat-style">{user?.preferences?.style||'Chic'}</strong><Link to="/app/profile">Personalise it <ArrowRight size={13}/></Link></div></div>
    <div className="dashboard-main-grid"><section className="panel today-panel"><div className="panel-heading"><div><span className="eyebrow">A LITTLE INSPIRATION</span><h2>Today's outfit idea</h2></div><span className="sun-pill"><Sun size={15}/> Everyday chic</span></div>{outfit?<div className="today-outfit"><div className="today-collage"><OutfitCollage items={outfit.items} compact/></div><div className="today-details"><SourceBadge source={outfit.source}/> <span className="score-pill">≈{outfit.score} match estimate</span><h3>{outfit.title}</h3><p>{outfit.explanation}</p><div className="outfit-mini-items">{outfit.items.slice(0,4).map(i=><span key={i.id}>{i.name}</span>)}</div><Link to="/app/studio" className="text-link">Make it your own <ArrowRight size={15}/></Link></div></div>:<div className="today-empty"><div className="empty-flower">✿</div><h3>Let's find a look that feels like you.</h3><p>We’ll pair pieces from your wardrobe and suggest the little details that pull it all together.</p>{note&&<p className="muted small">{note}</p>}<button className="button button-rose" onClick={generate} disabled={busy||wardrobeStatus==='loading'}>{busy?'Finding your look…':<>Find my look <Sparkles size={16}/></>}</button></div>}</section>
    <aside className="quick-panel"><span className="eyebrow">YOUR NEXT LITTLE STEP</span><h2>Make something<br/><em>feel like you.</em></h2><p>Good style isn't about more clothes. It's about seeing what you already have in a new way.</p><Link to="/app/wardrobe" className="quick-action"><span><Plus size={17}/></span><div><strong>Add a wardrobe piece</strong><small>Upload a photo or add details</small></div><ArrowRight size={16}/></Link><Link to="/app/studio" className="quick-action"><span><WandSparkles size={17}/></span><div><strong>Try a new combination</strong><small>Choose an occasion and mood</small></div><ArrowRight size={16}/></Link><div className="quick-quote">“Style is a way to say who you are without having to speak.”</div></aside></div>
    <div className="bottom-prompt"><div><span className="eyebrow">YOUR CLOSET IS FULL OF POSSIBILITIES</span><h2>Ready to give an old favourite a new story?</h2></div><Link to="/app/studio" className="text-link">Style a new look <ArrowRight size={15}/></Link></div>
  </div>
}
