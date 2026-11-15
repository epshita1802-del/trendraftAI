import mongoose from 'mongoose'
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  category: { type: String, enum: ['Tops','Bottoms','Dresses & ethnic wear','Shoes','Accessories','Layering'], required: true },
  color: { type: String, default: 'Unknown' },
  style: { type: String, default: 'Everyday' },
  imageUrl: { type: String, default: '' },
  notes: { type: String, default: '', maxlength: 400 }
}, { timestamps: true })
export default mongoose.model('WardrobeItem', schema)
