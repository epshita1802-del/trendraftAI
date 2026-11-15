import { Router } from 'express'
import multer from 'multer'
import mongoose from 'mongoose'
import path from 'node:path'
import fs from 'node:fs'
import { auth } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { uploadDir } from '../config/paths.js'
import WardrobeItem from '../models/WardrobeItem.js'

const router = Router()
fs.mkdirSync(uploadDir, { recursive: true })

const CATEGORIES = ['Tops', 'Bottoms', 'Dresses & ethnic wear', 'Shoes', 'Accessories', 'Layering']
// The file extension comes from the verified MIME type, never from the client-supplied
// file name. (A file named "x.html" with an image MIME type must not be stored as .html.)
const EXT_BY_MIME = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' }

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) =>
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${EXT_BY_MIME[file.mimetype] || '.img'}`),
})
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!EXT_BY_MIME[file.mimetype]) return cb(new Error('Please upload a JPG, PNG, WEBP, or GIF image.'))
    cb(null, true)
  },
})
const dropUpload = file => file && fs.promises.unlink(file.path).catch(() => {})
const text = (v, max) => String(v ?? '').trim().slice(0, max)

router.use(auth)

// Only ever returns the authenticated user's own items.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await WardrobeItem.find({ user: req.user._id }).sort({ createdAt: -1 })
    res.json({ items })
  }),
)

router.post(
  '/',
  upload.single('image'),
  asyncHandler(async (req, res) => {
    const { name, category, color, style, notes } = req.body || {}
    if (!text(name, 100) || !CATEGORIES.includes(category)) {
      await dropUpload(req.file)
      return res.status(400).json({ message: 'Name and a valid category are required.' })
    }
    const item = await WardrobeItem.create({
      user: req.user._id,
      name: text(name, 100),
      category,
      color: text(color, 40) || 'Unknown',
      style: text(style, 40) || 'Everyday',
      notes: text(notes, 400),
      imageUrl: req.file ? `/uploads/${req.file.filename}` : '',
    })
    res.status(201).json({ item })
  }),
)

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Wardrobe item not found.' })
    const limits = { name: 100, color: 40, style: 40, notes: 400 }
    const updates = {}
    for (const [key, max] of Object.entries(limits)) if (req.body?.[key] !== undefined) updates[key] = text(req.body[key], max)
    if (updates.name === '') return res.status(400).json({ message: 'Name cannot be empty.' })
    if (req.body?.category !== undefined) {
      if (!CATEGORIES.includes(req.body.category)) return res.status(400).json({ message: 'Choose a valid category.' })
      updates.category = req.body.category
    }
    const item = await WardrobeItem.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, updates, {
      new: true,
      runValidators: true,
    })
    if (!item) return res.status(404).json({ message: 'Wardrobe item not found.' })
    res.json({ item })
  }),
)

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Wardrobe item not found.' })
    const item = await WardrobeItem.findOneAndDelete({ _id: req.params.id, user: req.user._id })
    if (!item) return res.status(404).json({ message: 'Wardrobe item not found.' })
    if (item.imageUrl?.startsWith('/uploads/')) {
      fs.promises.unlink(path.join(uploadDir, path.basename(item.imageUrl))).catch(() => {})
    }
    res.json({ message: 'Wardrobe item removed.' })
  }),
)
export default router
