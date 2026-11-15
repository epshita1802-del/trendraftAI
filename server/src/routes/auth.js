import { Router } from 'express'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import { makeToken, safeUser } from '../utils/token.js'
import { auth } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
const router = Router()
router.post('/signup', async (req,res) => {
  try {
    const { name, email, password } = req.body || {}
    if (!name?.trim() || !email?.trim() || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Enter your name and a valid email address.' })
    if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' })
    if (await User.findOne({ email: email.toLowerCase().trim() })) return res.status(409).json({ message: 'An account with this email already exists.' })
    const user = await User.create({ name: name.trim(), email: email.toLowerCase().trim(), passwordHash: await bcrypt.hash(password, 12) })
    res.status(201).json({ token: makeToken(user), user: safeUser(user) })
  } catch (e) { res.status(500).json({ message: 'Could not create account.' }) }
})
router.post('/login', asyncHandler(async (req,res) => {
  const { email, password } = req.body || {}
  const user = await User.findOne({ email: String(email || '').toLowerCase().trim() })
  if (!user || !(await bcrypt.compare(String(password || ''), user.passwordHash))) return res.status(401).json({ message: 'Email or password is incorrect.' })
  res.json({ token: makeToken(user), user: safeUser(user) })
}))
router.get('/me', auth, (req,res) => res.json({ user: safeUser(req.user) }))
router.patch('/me', auth, asyncHandler(async (req,res) => {
  const { name, preferences } = req.body || {}
  if (name?.trim()) req.user.name = name.trim()
  if (preferences && typeof preferences === 'object') {
    req.user.preferences = { ...req.user.preferences.toObject?.(), ...preferences }
  }
  await req.user.save()
  res.json({ user: safeUser(req.user) })
}))
export default router
