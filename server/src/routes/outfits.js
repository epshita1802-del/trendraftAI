import { Router } from 'express'
import mongoose from 'mongoose'
import { auth } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import WardrobeItem from '../models/WardrobeItem.js'
import SavedOutfit from '../models/SavedOutfit.js'
import { aiSettings, comboKey, foundationOf, generateOutfits, publicItem, SCORE_NOTE } from '../services/styling.js'

const router = Router()
router.use(auth)

const str = (v, fallback, max = 40) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback)
const ids = list => (Array.isArray(list) ? list.map(String).filter(id => mongoose.isValidObjectId(id)).slice(0, 300) : [])
const MODE_LABEL = { ai: 'AI', mixed: 'Mixed', fallback: 'Local', none: 'Local' }
// One generation per user at a time: protects the AI quota from double clicks and extra tabs.
const inFlight = new Set()

router.post(
  '/generate',
  asyncHandler(async (req, res) => {
    const body = req.body || {}
    const userId = String(req.user._id)
    if (inFlight.has(userId)) {
      return res.status(429).json({ message: 'Your outfits are already being styled. Please wait a moment.', code: 'BUSY' })
    }
    inFlight.add(userId)
    try {
      const history = (Array.isArray(body.history) ? body.history : [])
        .slice(-40)
        .map(h => ({ key: str(h?.key, '', 400), foundationKey: str(h?.foundationKey, '', 400) }))
        .filter(h => h.key || h.foundationKey)
      // Always scoped to the authenticated user; client-supplied ids can only narrow the set.
      const items = await WardrobeItem.find({ user: req.user._id }).lean()
      const result = await generateOutfits({
        items,
        prefs: req.user.preferences?.toObject?.() ?? req.user.preferences ?? {},
        occasion: str(body.occasion, 'Casual'),
        style: str(body.style, req.user.preferences?.style || 'chic'),
        weather: str(body.weather, 'Mild'),
        focus: str(body.focus, 'Any'),
        count: Number.isFinite(Number(body.count)) ? Number(body.count) : 4,
        exclude: ids(body.exclude),
        history,
        forceFallback: body.forceFallback === true || body.forceDemo === true,
        seed: Date.now(), // new variety on every click
        ai: aiSettings(),
      })

      // Helpful while debugging: shows in the server terminal why AI was or wasn't used.
      console.log(`[generate] source=${result.source} ai.used=${result.aiStatus?.used} code=${result.aiStatus?.code || '-'}`)

      res.json({
        recommendations: result.recommendations,
        recommendation: result.recommendations[0] || null, // kept for older clients
        source: result.source,
        mode: MODE_LABEL[result.source],
        aiStatus: result.aiStatus,
        code: result.code,
        message: result.message,
        wardrobeCount: items.length,
      })
    } finally {
      inFlight.delete(userId)
    }
  }),
)

// Saved looks, with the live wardrobe items attached so images always match the item ids.
router.get(
  '/saved',
  asyncHandler(async (req, res) => {
    const outfits = await SavedOutfit.find({ user: req.user._id }).sort({ createdAt: -1 }).lean()
    const allIds = [...new Set(outfits.flatMap(o => (o.itemIds || []).map(String)))]
    const live = await WardrobeItem.find({ _id: { $in: allIds }, user: req.user._id }).lean()
    const byId = new Map(live.map(i => [String(i._id), i]))
    res.json({
      outfits: outfits.map(o => {
        const items = (o.itemIds || []).map(id => byId.get(String(id))).filter(Boolean).map(i => publicItem(i))
        return { ...o, items, missingCount: (o.itemIds || []).length - items.length }
      }),
    })
  }),
)

router.post(
  '/saved',
  asyncHandler(async (req, res) => {
    const { recommendation, occasion, style } = req.body || {}
    const wanted = ids(recommendation?.ownedItemIds)
    if (!recommendation || !wanted.length) return res.status(400).json({ message: 'A valid outfit recommendation is required.' })
    const owned = await WardrobeItem.find({ _id: { $in: wanted }, user: req.user._id }).lean()
    if (owned.length !== new Set(wanted).size) {
      return res.status(400).json({ message: 'This outfit contains pieces that are not in your wardrobe.' })
    }
    // Build the stored snapshot from the database, not from what the browser sent.
    const key = comboKey(owned.map(i => String(i._id)))
    const existing = await SavedOutfit.findOne({ user: req.user._id, 'snapshot.key': key })
    if (existing) return res.status(200).json({ outfit: existing, alreadySaved: true })
    const snapshot = {
      key,
      foundationKey: foundationOf(owned),
      score: Math.max(0, Math.min(99, Math.round(Number(recommendation.score)) || 0)),
      scoreNote: SCORE_NOTE,
      source: recommendation.source === 'ai' ? 'ai' : 'fallback',
      explanation: str(recommendation.explanation, '', 600),
      colorAdvice: str(recommendation.colorAdvice, '', 400),
      stylingTips: (Array.isArray(recommendation.stylingTips) ? recommendation.stylingTips : []).map(t => str(t, '', 200)).filter(Boolean).slice(0, 4),
      hairstyle: { name: str(recommendation.hairstyle?.name, '', 60), reason: str(recommendation.hairstyle?.reason, '', 200) },
      items: owned.map(i => publicItem(i)),
    }
    const outfit = await SavedOutfit.create({
      user: req.user._id,
      title: str(recommendation.title, 'Saved look', 100),
      occasion: str(occasion || recommendation.occasion, 'Casual'),
      style: str(style || recommendation.style, 'chic'),
      itemIds: owned.map(i => i._id),
      snapshot,
    })
    res.status(201).json({ outfit })
  }),
)

router.delete(
  '/saved/:id',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Saved outfit not found.' })
    const outfit = await SavedOutfit.findOneAndDelete({ _id: req.params.id, user: req.user._id })
    if (!outfit) return res.status(404).json({ message: 'Saved outfit not found.' })
    res.json({ message: 'Outfit removed.' })
  }),
)

router.patch(
  '/saved/:id/feedback',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Saved outfit not found.' })
    const feedback = ['like', 'dislike'].includes(req.body?.feedback) ? req.body.feedback : ''
    const outfit = await SavedOutfit.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { feedback, liked: feedback === 'like' },
      { new: true },
    )
    if (!outfit) return res.status(404).json({ message: 'Saved outfit not found.' })
    res.json({ outfit })
  }),
)
export default router