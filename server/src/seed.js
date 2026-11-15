import './config/env.js'
import bcrypt from 'bcryptjs'
import { connectDB } from './config/db.js'
import User from './models/User.js'
import WardrobeItem from './models/WardrobeItem.js'
import SavedOutfit from './models/SavedOutfit.js'
await connectDB()
const email = 'demo@trendcraft.local'
let user = await User.findOne({ email })
if (!user) user = await User.create({ name: 'TrendCraft Demo', email, passwordHash: await bcrypt.hash('StyleDemo123!', 12), preferences: { style: 'chic', colors: ['cream','blue'] } })
const sample = [
 ['Cloud cotton tee','Tops','White','minimal'], ['Black ribbed top','Tops','Black','chic'], ['Blush knit top','Tops','Pink','soft'], ['Sage blouse','Tops','Green','elegant'],
 ['Light-wash straight jeans','Bottoms','Blue','casual'], ['Cream tailored trousers','Bottoms','Cream','elegant'], ['Black midi skirt','Bottoms','Black','chic'], ['Chocolate wide-leg pants','Bottoms','Brown','minimal'],
 ['Floral midi dress','Dresses & ethnic wear','Pink','romantic'], ['Ivory kurta set','Dresses & ethnic wear','Cream','classic'],
 ['White sneakers','Shoes','White','casual'], ['Black ballet flats','Shoes','Black','chic'], ['Tan loafers','Shoes','Beige','classic'],
 ['Gold hoops','Accessories','Gold','chic'], ['Cream shoulder bag','Accessories','Cream','minimal'], ['Pearl necklace','Accessories','White','romantic'],
 ['Camel cardigan','Layering','Camel','classic'], ['Denim jacket','Layering','Blue','casual']
]
const count = await WardrobeItem.countDocuments({ user: user._id })
if (!count) {
  await WardrobeItem.insertMany(sample.map(([name,category,color,style]) => ({ user: user._id, name, category, color, style, imageUrl: '' })))
  console.log(`✓ Added ${sample.length} sample wardrobe items`)
} else console.log('Sample wardrobe already exists; leaving it unchanged.')
console.log('\nDemo login:\nEmail: demo@trendcraft.local\nPassword: StyleDemo123!\n')
console.log('Seed completed. Keep this demo account for local development only.')
await mongooseDisconnect()
async function mongooseDisconnect() { const mongoose = await import('mongoose'); await mongoose.default.disconnect() }
