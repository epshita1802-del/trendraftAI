import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Heart, LayoutDashboard, LogOut, Shirt, Sparkles, UserRound, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
export default function Shell() {
  const { user, logout } = useAuth()
  const [open,setOpen] = useState(false)
  const navigate = useNavigate()
  const links = [
    {to:'/app',label:'Overview',icon:LayoutDashboard,end:true},
    {to:'/app/wardrobe',label:'My wardrobe',icon:Shirt},
    {to:'/app/studio',label:'Outfit studio',icon:Sparkles},
    {to:'/app/saved',label:'Saved looks',icon:Heart},
    {to:'/app/profile',label:'Profile',icon:UserRound}
  ]
  const exit = () => { logout(); navigate('/') }
  return <div className="app-shell">
    <aside className={`sidebar ${open?'sidebar-open':''}`}>
      <NavLink to="/" className="brand"><span className="brand-mark">t</span><span>trendcraft<span className="brand-ai"> AI</span><small>YOUR PERSONAL STYLIST</small></span></NavLink>
      <div className="side-label">YOUR SPACE</div>
      <nav>{links.map(({to,label,icon:Icon,end})=><NavLink key={to} to={to} end={end} onClick={()=>setOpen(false)} className={({isActive})=>`side-link ${isActive?'active':''}`}><Icon size={18}/>{label}</NavLink>)}</nav>
      <div className="sidebar-note"><Sparkles size={18}/><strong>A little style magic</strong><span>Build looks from the pieces you already love.</span></div>
      <button className="side-link logout" onClick={exit}><LogOut size={18}/> Sign out</button>
    </aside>
    {open && <button className="mobile-scrim" onClick={()=>setOpen(false)} aria-label="Close menu"/>}
    <main className="app-main">
      <header className="topbar"><button className="icon-button mobile-menu" onClick={()=>setOpen(!open)} aria-label="Toggle menu">{open?<X/>:<Menu/>}</button><div className="breadcrumb">Your personal style space <span>✦</span></div><div className="user-pill"><span className="avatar">{(user?.name||'S').slice(0,1).toUpperCase()}</span><span>{user?.name?.split(' ')[0]||'Stylist'}</span></div></header>
      <div className="content-wrap"><Outlet/></div>
      <footer className="app-footer">Made for your everyday kind of magic <span>✧</span></footer>
    </main>
  </div>
}
