import mongoose from 'mongoose'
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  occasion: { type: String, default: 'Casual' },
  style: { type: String, default: 'chic' },
  itemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'WardrobeItem' }],
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  liked: { type: Boolean, default: false },
  feedback: { type: String, default: '' }
}, { timestamps: true })
export default mongoose.model('SavedOutfit', schema)
