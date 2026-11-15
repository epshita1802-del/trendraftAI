import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import Protected from './components/Protected'
import Shell from './components/Shell'
import Landing from './pages/Landing'
import { Login, Signup } from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Wardrobe from './pages/Wardrobe'
import Studio from './pages/Studio'
import Saved from './pages/Saved'
import Profile from './pages/Profile'
import './styles.css'
import './outfits.css'
export default function App() {
  return <BrowserRouter><AuthProvider><Toaster position="top-right" toastOptions={{duration:3000,style:{borderRadius:'14px',fontFamily:'DM Sans'}}}/><Routes><Route path="/" element={<Landing/>}/><Route path="/login" element={<Login/>}/><Route path="/signup" element={<Signup/>}/><Route element={<Protected/>}><Route path="/app" element={<Shell/>}><Route index element={<Dashboard/>}/><Route path="wardrobe" element={<Wardrobe/>}/><Route path="studio" element={<Studio/>}/><Route path="saved" element={<Saved/>}/><Route path="profile" element={<Profile/>}/></Route></Route><Route path="*" element={<Landing/>}/></Routes></AuthProvider></BrowserRouter>
}
