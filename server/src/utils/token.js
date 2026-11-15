import jwt from 'jsonwebtoken'
export function makeToken(user) {
  return jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' })
}
export function safeUser(user) {
  return { id: user._id, name: user.name, email: user.email, preferences: user.preferences }
}
