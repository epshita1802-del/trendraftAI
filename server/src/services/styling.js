// Styling service: a local rule-based engine (the fallback) plus an optional Gemini-backed
// stylist. Both return the same outfit shape and every outfit only ever contains items
// that really exist in the caller's wardrobe.

export const CATEGORY = {
  top: 'Tops',
  bottom: 'Bottoms',
  dress: 'Dresses & ethnic wear',
  shoes: 'Shoes',
  accessory: 'Accessories',
  layer: 'Layering',
}
export const DEFAULT_AI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai'
export const DEFAULT_AI_MODEL = 'gemini-3.8-flash'
export const SCORE_NOTE = 'Compatibility is an estimate of how well the pieces go together, not an objective measurement.'
const MAX_ACCESSORIES = 3

/** Reads AI settings from the environment. The key is only ever used server-side. */
export function aiSettings(env = process.env) {
  const apiKey = String(env.AI_API_KEY || '').trim() || String(env.GEMINI_API_KEY || '').trim()
  return {
    apiKey,
    baseUrl: (env.AI_BASE_URL || '').trim() || DEFAULT_AI_BASE_URL,
    model: (env.AI_MODEL || '').trim() || DEFAULT_AI_MODEL,
    configured: Boolean(apiKey),
  }
}

/* ----------------------------- shared helpers ----------------------------- */

const idOf = item => String(item._id ?? item.id)
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s)
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const hash = s => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
export const comboKey = ids => [...new Set(ids.map(String))].sort().join('|')
// The "foundation" is the main piece(s) of an outfit: a dress, or a top plus a bottom.
const FOUNDATION_CATEGORIES = ['Tops', 'Bottoms', 'Dresses & ethnic wear']
export const foundationOf = pieces => comboKey(pieces.filter(p => FOUNDATION_CATEGORIES.includes(p.category)).map(idOf))
const historyKeys = (history, field) => history.map(h => h?.[field]).filter(k => typeof k === 'string' && k)

const palettes = {
  black: ['white', 'cream', 'beige', 'denim', 'blue', 'grey', 'pink', 'red', 'olive', 'camel'],
  white: ['black', 'blue', 'denim', 'beige', 'brown', 'olive', 'pink', 'grey', 'cream'],
  beige: ['white', 'black', 'brown', 'olive', 'blue', 'denim', 'cream', 'maroon'],
  blue: ['white', 'black', 'cream', 'beige', 'grey', 'navy', 'brown'],
  pink: ['white', 'cream', 'grey', 'denim', 'blue', 'brown', 'black'],
  green: ['cream', 'beige', 'white', 'black', 'denim', 'brown'],
  red: ['black', 'white', 'cream', 'denim', 'beige'],
  brown: ['cream', 'white', 'beige', 'blue', 'denim', 'olive', 'black'],
  purple: ['white', 'cream', 'grey', 'black', 'denim'],
  grey: ['white', 'black', 'pink', 'blue', 'cream', 'burgundy'],
  cream: ['black', 'brown', 'blue', 'denim', 'olive', 'pink', 'beige', 'white'],
  camel: ['black', 'white', 'cream', 'blue', 'denim', 'brown'],
}
const COLOR_FAMILIES = [
  ['white', /\b(white|ivory|cream|off.white)\b/],
  ['black', /\b(black|charcoal)\b/],
  ['grey', /\b(grey|gray|silver)\b/],
  ['brown', /\b(brown|tan|camel|beige|khaki|taupe)\b/],
  ['blue', /\b(blue|navy|denim|teal|turquoise|cyan)\b/],
  ['green', /\b(green|olive|sage|mint|emerald)\b/],
  ['pink', /\b(pink|blush|rose|fuchsia|magenta)\b/],
  ['red', /\b(red|burgundy|maroon|wine)\b/],
  ['purple', /\b(purple|violet|lilac|lavender)\b/],
  ['orange', /\b(orange|coral|rust|terracotta)\b/],
  ['yellow', /\b(yellow|mustard|gold)\b/],
]
const NEUTRAL_COLORS = new Set(['white', 'black', 'grey', 'brown'])
const HARMONIOUS_PAIRS = [
  ['blue', 'pink'], ['blue', 'brown'], ['blue', 'orange'], ['blue', 'green'],
  ['green', 'pink'], ['green', 'brown'], ['green', 'yellow'],
  ['pink', 'purple'], ['pink', 'red'], ['pink', 'yellow'], ['red', 'purple'], ['red', 'orange'],
  ['purple', 'yellow'], ['orange', 'yellow'],
]
const NEUTRALS = /black|white|cream|ivory|beige|grey|gray|camel|tan|brown|navy|denim/
const PASTELS = /pink|blush|lilac|lavender|mint|sage|peach|baby|powder|cream|ivory/
const EARTH = /brown|camel|tan|olive|rust|beige|khaki|terracotta|mustard|green/
const BOLD = /red|royal|emerald|fuchsia|orange|yellow|cobalt|magenta|purple|gold/

const colorKey = c => (c || 'unknown').toLowerCase().replace(/light |dark |washed |-wash/g, '').trim()
const colorFamily = color => {
  const value = String(color || '').toLowerCase().replace(/[-_/]/g, ' ')
  return COLOR_FAMILIES.find(([, pattern]) => pattern.test(value))?.[0] || ''
}
const colorsGoTogether = (a, b) => {
  const ca = colorFamily(a), cb = colorFamily(b)
  if (!ca || !cb || ca === cb || NEUTRAL_COLORS.has(ca) || NEUTRAL_COLORS.has(cb)) return true
  if ((palettes[ca] || []).some(color => colorFamily(color) === cb)) return true
  return HARMONIOUS_PAIRS.some(([first, second]) => (first === ca && second === cb) || (first === cb && second === ca))
}
const styleText = i => `${i.style || ''} ${i.name || ''} ${i.notes || ''}`.toLowerCase()

const styleFamily = item => {
  const text = styleText(item)
  if (/sport|athletic|active/.test(text)) return 'sporty'
  if (/formal|tailor|office|business|elegant|classic/.test(text)) return 'polished'
  if (/streetwear|street style/.test(text)) return 'street'
  if (/romantic|feminine|floral|soft/.test(text)) return 'romantic'
  if (/minimal|chic|casual|everyday|comfy/.test(text)) return 'everyday'
  return ''
}

function stylePairBonus(a, b) {
  const first = styleFamily(a), second = styleFamily(b)
  if (!first || !second) return 0
  if (first === second) return 8
  if ((first === 'sporty' && second === 'polished') || (first === 'polished' && second === 'sporty')) return -16
  if ((first === 'street' && second === 'polished') || (first === 'polished' && second === 'street')) return -10
  return -3
}

function stylesSuit(a, b, requestedStyle) {
  const first = styleFamily(a), second = styleFamily(b)
  if (!first || !second || first === second) return true
  const contrast = (first === 'sporty' && second === 'polished') || (first === 'polished' && second === 'sporty')
    || (first === 'street' && second === 'polished') || (first === 'polished' && second === 'street')
  return !contrast || String(requestedStyle).toLowerCase() === 'experimental'
}

function scorePair(a, b, prefs, occasion) {
  const ca = colorKey(a.color), cb = colorKey(b.color)
  let score = 55
  if (colorsGoTogether(a.color, b.color)) score += colorFamily(a.color) && colorFamily(a.color) === colorFamily(b.color) ? 20 : 15
  else score -= 30
  score += stylePairBonus(a, b)
  if ((prefs?.colors || []).some(c => ca.includes(c.toLowerCase()) || cb.includes(c.toLowerCase()))) score += 5
  if (occasion === 'Party' && /party|dressy|statement/i.test(`${a.style} ${b.style}`)) score += 5
  if (occasion === 'College' && /casual|everyday|street/i.test(`${a.style} ${b.style}`)) score += 5
  return clamp(score, 0, 98)
}

const colorsSuitOutfit = (item, pieces) => pieces.every(piece => colorsGoTogether(item.color, piece.color))

/** Public, display-safe view of a wardrobe item (what the browser receives). */
export function publicItem(item, note = '') {
  return {
    id: idOf(item),
    name: item.name,
    category: item.category,
    color: item.color || '',
    style: item.style || '',
    imageUrl: item.imageUrl || '',
    ...(note ? { note } : {}),
  }
}

const ROLE_ORDER = [CATEGORY.dress, CATEGORY.top, CATEGORY.bottom, CATEGORY.layer, CATEGORY.shoes, CATEGORY.accessory]
const sortForDisplay = items => [...items].sort((a, b) => ROLE_ORDER.indexOf(a.category) - ROLE_ORDER.indexOf(b.category))

export function hasFoundation(items) {
  const has = c => items.some(i => i.category === c)
  return has(CATEGORY.dress) || (has(CATEGORY.top) && has(CATEGORY.bottom))
}

/** Explains, in plain words, what the wardrobe is missing for complete outfits. */
export function wardrobeGap(items) {
  if (!items.length) return 'Your wardrobe is empty. Add a few pieces (a top and a bottom, or a dress) to get outfit ideas.'
  if (hasFoundation(items)) return ''
  const has = c => items.some(i => i.category === c)
  if (has(CATEGORY.top) && !has(CATEGORY.bottom)) return 'Add at least one bottom (or a dress) so we can complete an outfit around your tops.'
  if (has(CATEGORY.bottom) && !has(CATEGORY.top)) return 'Add at least one top (or a dress) so we can complete an outfit around your bottoms.'
  return 'Add at least one top and one bottom (or a dress) to unlock personalised combinations.'
}

const HAIR = [
  ['Soft waves', 'Adds a relaxed finish without competing with the outfit.'],
  ['Sleek low bun', 'Keeps the look polished and lets the outfit stand out.'],
  ['High ponytail', 'A practical, fresh choice for a busy day.'],
  ['Open straight hair', 'Creates a clean, understated silhouette.'],
  ['Loose braid', 'Adds a soft, effortless detail to the overall look.'],
]

/* --------------------------- local (fallback) engine --------------------------- */

const OCCASION_RULES = {
  Formal: { good: /elegant|classic|tailor|formal|chic|minimal|blazer|trouser|silk/, bad: /street|athletic|sport|ripped|graphic|distressed/ },
  Office: { good: /elegant|classic|tailor|formal|chic|minimal|blazer|trouser|smart/, bad: /street|athletic|sport|ripped|graphic|distressed/ },
  Party: { good: /party|dressy|statement|romantic|chic|elegant|sequin|satin/, bad: /athletic|sport/ },
  Date: { good: /romantic|chic|elegant|dressy|soft|floral|satin/, bad: /athletic|sport/ },
  Festive: { good: /festive|ethnic|kurta|classic|elegant|traditional|embroider/, bad: /athletic|sport|street/ },
  College: { good: /casual|everyday|street|minimal|denim|comfy/, bad: /sequin|gown/ },
  Casual: { good: /casual|everyday|street|minimal|denim|comfy/, bad: /sequin|gown/ },
}

function contextBonus(pieces, { occasion, style, focus }) {
  let bonus = 0
  const rule = OCCASION_RULES[occasion] || OCCASION_RULES.Casual
  const styleWord = String(style || '').toLowerCase().split(/[\s-]/)[0]
  for (const p of pieces) {
    const t = styleText(p)
    if (rule.good.test(t)) bonus += 3
    if (rule.bad.test(t)) bonus -= 5
    if (styleWord && t.includes(styleWord)) bonus += 3
    if (p.category === CATEGORY.dress && /Party|Date|Festive/.test(occasion)) bonus += 4
    const c = colorKey(p.color)
    if (focus === 'Neutrals' && NEUTRALS.test(c)) bonus += 2
    if (focus === 'Pastels' && PASTELS.test(c)) bonus += 2
    if (focus === 'Earth tones' && EARTH.test(c)) bonus += 2
    if (focus === 'Bold colours' && BOLD.test(c)) bonus += 2
  }
  if (focus === 'Monochrome' && new Set(pieces.map(p => colorKey(p.color))).size === 1) bonus += 6
  return bonus
}

const COLD = /^(Cool|Cold|Rainy)$/
const pickBest = (anchor, pool, prefs, occasion, usedCount, salt) =>
  [...pool].sort((a, b) => {
    const sa = scorePair(anchor, a, prefs, occasion) - 6 * (usedCount.get(idOf(a)) || 0)
    const sb = scorePair(anchor, b, prefs, occasion) - 6 * (usedCount.get(idOf(b)) || 0)
    return sb - sa || hash(idOf(a) + salt) - hash(idOf(b) + salt)
  })[0] || null

function colorStory(pieces) {
  const base = pieces.filter(p => p.category === CATEGORY.top || p.category === CATEGORY.bottom || p.category === CATEGORY.dress)
  const [a, b] = base
  if (!a) return 'Keep the palette to two or three main colours and let one piece lead.'
  if (!b) return `Let the ${a.color.toLowerCase()} dress be the focal point and keep everything else quiet and neutral.`
  const ca = colorKey(a.color), cb = colorKey(b.color)
  if (ca === cb) return `A tonal ${ca} look feels intentional; add texture or a contrasting accessory for interest.`
  if (colorsGoTogether(a.color, b.color)) return `${cap(ca)} and ${cb} are a reliable pairing; keep the rest of the pieces in the same calm range.`
  return `${cap(ca)} with ${cb} is a bolder contrast; keep shoes and accessories neutral so the two colours can stand out.`
}

function stylingTips(pieces, occasion) {
  const tips = []
  if (pieces.some(p => p.category === CATEGORY.top) && pieces.some(p => p.category === CATEGORY.bottom)) tips.push('Try a half-tuck to define the waist.')
  if (pieces.some(p => p.category === CATEGORY.layer)) tips.push('Wear the layer open for a longer line, or on your shoulders for a polished touch.')
  if (pieces.some(p => p.category === CATEGORY.accessory)) tips.push('Keep to one statement accessory so the outfit stays balanced.')
  if (/Formal|Office/.test(occasion)) tips.push('Make sure everything is pressed and fits cleanly for a sharper finish.')
  if (/Party|Date/.test(occasion)) tips.push('Add one detail that feels a little special, such as jewellery or a bag.')
  if (!tips.length) tips.push('Choose one focal piece and let the rest support it.')
  return tips.slice(0, 3)
}

function describeOutfit(pieces, { occasion, style }, titles) {
  const names = pieces.filter(p => p.category !== CATEGORY.accessory && p.category !== CATEGORY.layer)
  const anchor = names[0]
  const second = names[1]
  const looks = pieces.find(p => p.category === CATEGORY.dress)
    ? `${cap(String(anchor.color || '').toLowerCase())} ${occasion.toLowerCase()} dress look`
    : `${cap(String(anchor.color || '').toLowerCase())} & ${String(second?.color || '').toLowerCase()} ${occasion.toLowerCase()} look`
  let title = looks
  if (titles.has(title)) title = `${looks} · ${cap(anchor.name)}`
  titles.add(title)
  const story = second
    ? `${anchor.name} with ${second.name}`
    : `${anchor.name}`
  const explanation = `${cap(story)}${pieces.length > names.length ? ', finished with ' + pieces.filter(p => !names.includes(p)).map(p => p.name).join(' and ') : ''}. Chosen for ${occasion.toLowerCase()} in ${/^[aeiou]/i.test(style) ? 'an' : 'a'} ${style} mood, using only pieces from your wardrobe.`
  return { title, explanation }
}

function buildCandidates(usable, ctx) {
  const by = c => usable.filter(i => i.category === c)
  const tops = by(CATEGORY.top), bottoms = by(CATEGORY.bottom), dresses = by(CATEGORY.dress), shoes = by(CATEGORY.shoes)
  const foundations = []
  for (const top of tops) for (const bottom of bottoms) {
    if (!colorsGoTogether(top.color, bottom.color) || !stylesSuit(top, bottom, ctx.style)) continue
    foundations.push({ base: [top, bottom], score: scorePair(top, bottom, ctx.prefs, ctx.occasion) + contextBonus([top, bottom], ctx) })
  }
  for (const dress of dresses) {
    foundations.push({ base: [dress], score: scorePair(dress, shoes[0] || dress, ctx.prefs, ctx.occasion) + 4 + contextBonus([dress], ctx) })
  }
  const candidates = []
  for (const f of foundations) {
    const anchor = f.base[f.base.length - 1]
    const compatibleShoes = shoes.filter(shoe => colorsSuitOutfit(shoe, f.base))
    const shoeChoices = compatibleShoes.length
      ? [...compatibleShoes].sort((a, b) => scorePair(anchor, b, ctx.prefs, ctx.occasion) - scorePair(anchor, a, ctx.prefs, ctx.occasion) || hash(idOf(a) + idOf(anchor)) - hash(idOf(b) + idOf(anchor))).slice(0, 3)
      : [null]
    for (const shoe of shoeChoices) {
      const pieces = shoe ? [...f.base, shoe] : [...f.base]
      const shoeScore = shoe ? scorePair(anchor, shoe, ctx.prefs, ctx.occasion) - 62 : 0
      candidates.push({ pieces, base: f.base, shoe, score: f.score + shoeScore * 0.4 + contextBonus(shoe ? [shoe] : [], ctx) })
    }
  }
  return candidates
}

/**
 * Builds several distinct outfits from the wardrobe, best first. Returns an array
 * (possibly shorter than `count`, or empty if the wardrobe cannot make a full outfit).
 * `seed` changes on every request so the same wardrobe does not give identical looks each time.
 */
export function buildRecommendations({
  items, prefs = {}, occasion = 'Casual', style = 'chic', weather = 'Mild', focus = 'Any',
  exclude = [], history = [], count = 4, skipFoundations = [], seed = 0,
}) {
  const excluded = new Set(exclude.map(String))
  const usable = items.filter(i => !excluded.has(idOf(i)))
  if (!hasFoundation(usable)) return []
  const ctx = { prefs, occasion, style, weather, focus }
  const seenFoundations = new Set([...historyKeys(history, 'foundationKey'), ...skipFoundations])
  const candidates = buildCandidates(usable, ctx)
  const accessories = usable.filter(i => i.category === CATEGORY.accessory)
  const layers = usable.filter(i => i.category === CATEGORY.layer)

  const used = new Map()
  const bump = pieces => pieces.forEach(p => used.set(idOf(p), (used.get(idOf(p)) || 0) + 1))
  const chosenKeys = new Set()
  const chosenFoundations = new Set()
  const titles = new Set()
  const results = []
  const want = clamp(Number(count) || 4, 1, 5)
  // 0..1 value that is stable within one request but different on every new request.
  const jitter = key => (hash(String(key) + String(seed)) % 1000) / 1000

  while (results.length < want) {
    let best = null, bestScore = -Infinity
    const available = candidates.filter(c => !chosenFoundations.has(foundationOf(c.base)))
    const fresh = available.filter(c => !seenFoundations.has(foundationOf(c.base)))
    for (const c of fresh) {
      const key = comboKey(c.pieces.map(idOf))
      if (chosenKeys.has(key)) continue
      // A look that only swaps the shoes of an earlier look is not a distinct outfit.
      if (chosenFoundations.has(foundationOf(c.base))) continue
      // Prefer fresh foundations: reuse of the same top/bottom/dress/shoes is penalised.
      const reuse = c.base.reduce((n, p) => n + (used.get(idOf(p)) || 0), 0) * 14 + (c.shoe ? (used.get(idOf(c.shoe)) || 0) * 5 : 0)
      const total = c.score - reuse + jitter(key) * 10
      if (total > bestScore) { best = { ...c, key }; bestScore = total }
    }
    if (!best) break
    chosenKeys.add(best.key)
    chosenFoundations.add(foundationOf(best.base))

    const anchor = best.base[best.base.length - 1]
    let layer = null
    const compatibleLayers = layers.filter(item => colorsSuitOutfit(item, best.base))
    if (compatibleLayers.length && (COLD.test(weather) || (!/^(Hot|Warm)$/.test(weather) && hash(best.key + 'layer' + seed) % 2 === 0))) {
      layer = pickBest(anchor, compatibleLayers, prefs, occasion, used, best.key + seed)
    }
    const picked = []
    if (accessories.length && hash(best.key + occasion + seed) % 3 !== 0) {
      const wantCount = /Party|Date|Festive/.test(occasion) && accessories.length > 1 ? 2 : 1
      const pool = accessories.filter(item => colorsSuitOutfit(item, [...best.base, ...(layer ? [layer] : [])]))
      for (let n = 0; n < wantCount && pool.length; n++) {
        const a = pickBest(anchor, pool, prefs, occasion, used, best.key + n + seed)
        picked.push(a)
        pool.splice(pool.indexOf(a), 1)
      }
    }
    const pieces = [...best.pieces, ...(layer ? [layer] : []), ...picked.slice(0, MAX_ACCESSORIES)]
    const finalKey = comboKey(pieces.map(idOf))
    bump(pieces)
    const hair = HAIR[hash(best.key + style + seed) % HAIR.length]
    const { title, explanation } = describeOutfit(pieces, ctx, titles)
    const noteFor = p => {
      if (p.category === CATEGORY.accessory) return `A ${String(p.color || '').toLowerCase()} finishing touch that keeps the look considered.`
      if (p.category === CATEGORY.layer) return 'Optional: add when it is cooler or you want more dimension.'
      return ''
    }
    results.push({
      id: finalKey, key: finalKey, foundationKey: foundationOf(pieces), title,
      score: clamp(Math.round(best.score > 88 ? 88 + (best.score - 88) * 0.25 : best.score), 55, 96), scoreNote: SCORE_NOTE,
      occasion, style, source: 'fallback', sourceLabel: 'Local styling engine',
      items: sortForDisplay(pieces).map(p => publicItem(p, noteFor(p))),
      ownedItemIds: sortForDisplay(pieces).map(idOf),
      explanation, colorAdvice: colorStory(pieces), stylingTips: stylingTips(pieces, occasion),
      hairstyle: { name: hair[0], reason: hair[1] },
    })
  }
  return results
}

/**
 * Single-outfit helper kept for compatibility. Returns the best outfit, or a placeholder
 * that explains what is missing when the wardrobe cannot make one.
 */
export function buildRecommendation(args) {
  const [first] = buildRecommendations({ ...args, count: 1 })
  if (first) return first
  const { occasion = 'Casual', style = 'chic', items = [] } = args
  return {
    id: 'empty', key: 'empty', foundationKey: '', title: 'Your first signature look', score: 0, scoreNote: SCORE_NOTE, occasion, style,
    items: [], ownedItemIds: [], source: 'fallback', sourceLabel: 'Local styling engine',
    explanation: wardrobeGap(items) || 'Add at least one top and one bottom (or a dress) to unlock personalised combinations.',
    colorAdvice: 'Try a neutral base with one colour that makes you feel confident.', stylingTips: [],
    hairstyle: { name: 'Soft, natural style', reason: 'An easy everyday option that works with many outfits.' },
  }
}

/* ------------------------------- Gemini (AI) ------------------------------- */

const OUTFIT_SCHEMA = {
  type: 'object',
  properties: {
    outfits: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          itemIds: { type: 'array', items: { type: 'string' } },
          explanation: { type: 'string' },
          colorAdvice: { type: 'string' },
          stylingTips: { type: 'array', items: { type: 'string' } },
          hairstyle: { type: 'object', properties: { name: { type: 'string' }, reason: { type: 'string' } }, required: ['name', 'reason'], additionalProperties: false },
          itemNotes: { type: 'array', items: { type: 'object', properties: { itemId: { type: 'string' }, note: { type: 'string' } }, required: ['itemId', 'note'], additionalProperties: false } },
          score: { type: 'integer' },
        },
        required: ['title', 'itemIds', 'explanation', 'colorAdvice', 'stylingTips', 'hairstyle', 'itemNotes', 'score'],
        additionalProperties: false,
      },
    },
  },
  required: ['outfits'],
  additionalProperties: false,
}

const SYSTEM_PROMPT = `You are a practical, tasteful personal fashion stylist. You build outfits ONLY from the user's own wardrobe JSON.
Rules:
- Use ONLY item ids that appear in "wardrobe". Never invent items and never mention clothes that are not listed.
- Each outfit needs a foundation: one dress ("Dresses & ethnic wear") OR one top plus one bottom. Do not combine a dress with a top or bottom.
- Only pair colours that work together; avoid clashing colours. Treat white, black, grey, beige and other neutrals as versatile. If a colour is unknown, do not assume it clashes.
- Keep item styles and formality coherent with each other and the occasion. Never pair clearly athletic pieces with formal pieces unless the user asked for an experimental look.
- Add one pair of shoes when a colour-compatible pair exists. Add a "Layering" piece or up to 3 "Accessories" only when they genuinely suit the look, the weather and the occasion; do not force them.
- At most one item per category, except accessories (up to 3).
- Return the requested number of outfits when the wardrobe allows it; every outfit must have a different main-piece foundation (vary both the top and bottom when possible, not only shoes or accessories), and avoid every foundation in "avoidCombos".
- Consider colour coordination, the occasion, the style mood, the weather, the colour direction and the user's favourite colours.
Styling principles:
- Give each outfit its own colour story (for example: neutral base with one accent, tonal, or complementary contrast). Do not repeat the same colour story twice.
- Match formality to the occasion and warmth to the weather.
- Use at most one statement piece per outfit; keep everything else supportive.
- Reflect the style mood strongly. For "experimental", prefer unexpected but wearable pairings (texture, pattern or silhouette contrast). For "classic" or "minimal", keep lines clean and the palette restrained.
- Prefer using different main pieces across outfits so the user sees the range of their wardrobe.
- "score" is an integer 55-99 estimating how well the pieces go together; it is an estimate, not a measurement. Vary scores honestly rather than giving every look the same number.
- "itemNotes" explains in one short sentence why an accessory or layer was chosen (use [] if none).
- Keep every text field concise and friendly. Reply with JSON only, matching the schema.`

class AIError extends Error {
  constructor(code, message, status) { super(message); this.code = code; this.status = status }
}

function classifyHttp(status, detail) {
  if (status === 401 || status === 403) return new AIError('AI_AUTH', 'The AI provider rejected the API key. Check AI_API_KEY or GEMINI_API_KEY in server/.env.', status)
  if (status === 404) return new AIError('AI_MODEL', 'The AI model or endpoint was not found. Check AI_MODEL and AI_BASE_URL in server/.env.', status)
  if (status === 429) return new AIError('AI_RATE_LIMIT', 'The AI provider is rate-limiting requests (quota reached). Try again in a minute.', status)
  if (status === 400) return new AIError('AI_BAD_REQUEST', `The AI provider rejected the request${detail ? `: ${detail}` : '.'}`, status)
  return new AIError('AI_PROVIDER_ERROR', `The AI provider returned an error (HTTP ${status}).`, status)
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function callProvider({ apiKey, baseUrl, model, messages, mode, fetchImpl, timeoutMs }) {
  const body = { model, temperature: 1.0, messages }
  body.response_format = mode === 'schema'
    ? { type: 'json_schema', json_schema: { name: 'outfit_recommendations', strict: true, schema: OUTFIT_SCHEMA } }
    : { type: 'json_object' }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let response
  try {
    response = await fetchImpl(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw new AIError('AI_TIMEOUT', 'The AI provider took too long to respond.')
    throw new AIError('AI_NETWORK', 'Could not reach the AI provider. Check your internet connection and AI_BASE_URL.')
  } finally {
    clearTimeout(timer)
  }
  if (!response.ok) {
    let detail = ''
    try { detail = ((await response.json())?.error?.message || '').replace(apiKey, '***').slice(0, 200) } catch { /* ignore */ }
    console.warn(`[AI] provider HTTP ${response.status} (${model}) ${detail}`)
    throw classifyHttp(response.status, response.status === 400 ? detail : '')
  }
  let data
  try { data = await response.json() } catch { throw new AIError('AI_BAD_RESPONSE', 'The AI provider returned an unreadable response.') }
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) throw new AIError('AI_BAD_RESPONSE', 'The AI provider returned an empty response.')
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  try { return JSON.parse(cleaned) } catch { throw new AIError('AI_BAD_RESPONSE', 'The AI provider returned invalid JSON.') }
}

/**
 * Turns raw model output into trusted outfits. Every id is checked against the user's own
 * wardrobe, bad combinations are dropped, and nothing the model says can add an item.
 */
export function validateAIOutfits(raw, items, { occasion, style, count, seenKeys = new Set(), seenFoundations = new Set() }) {
  const byId = new Map(items.map(i => [idOf(i), i]))
  const list = Array.isArray(raw?.outfits) ? raw.outfits : []
  const out = []
  let rejected = 0
  const keys = new Set(seenKeys)
  const foundations = new Set(seenFoundations)
  const titles = new Set()
  for (const o of list) {
    if (out.length >= count) break
    const ids = [...new Set((Array.isArray(o?.itemIds) ? o.itemIds : []).map(String))]
    const picked = ids.map(id => byId.get(id)).filter(Boolean)
    if (!picked.length || picked.length !== ids.length) { rejected++; continue } // contains an unknown / foreign id
    const per = c => picked.filter(p => p.category === c)
    const dress = per(CATEGORY.dress), tops = per(CATEGORY.top), bottoms = per(CATEGORY.bottom)
    const okFoundation = dress.length === 1 ? tops.length === 0 && bottoms.length === 0 : dress.length === 0 && tops.length === 1 && bottoms.length === 1
    const okCounts = per(CATEGORY.shoes).length <= 1 && per(CATEGORY.layer).length <= 1 && per(CATEGORY.accessory).length <= MAX_ACCESSORIES
    if (!okFoundation || !okCounts) { rejected++; continue }
    if (tops.length && !stylesSuit(tops[0], bottoms[0], style)) { rejected++; continue }
    if (picked.some((piece, index) => !colorsSuitOutfit(piece, picked.slice(index + 1)))) { rejected++; continue }
    const key = comboKey(ids)
    const foundationKey = foundationOf(picked)
    if (keys.has(key) || foundations.has(foundationKey)) { rejected++; continue }
    keys.add(key)
    foundations.add(foundationKey)
    const notes = new Map((Array.isArray(o.itemNotes) ? o.itemNotes : []).map(n => [String(n?.itemId), String(n?.note || '').slice(0, 160)]))
    const ordered = sortForDisplay(picked)
    let title = String(o.title || '').trim().slice(0, 80) || `${cap(style)} ${occasion.toLowerCase()} look`
    if (titles.has(title)) title = `${title} (${out.length + 1})`
    titles.add(title)
    out.push({
      id: key, key, foundationKey, title,
      score: clamp(Math.round(Number(o.score)) || 80, 55, 99), scoreNote: SCORE_NOTE,
      occasion, style, source: 'ai', sourceLabel: 'AI stylist (Gemini)',
      items: ordered.map(p => publicItem(p, notes.get(idOf(p)) || '')),
      ownedItemIds: ordered.map(idOf),
      explanation: String(o.explanation || 'A balanced combination selected from your wardrobe.').slice(0, 600),
      colorAdvice: String(o.colorAdvice || 'Repeat one colour subtly to tie the look together.').slice(0, 400),
      stylingTips: (Array.isArray(o.stylingTips) ? o.stylingTips : []).map(t => String(t).slice(0, 200)).filter(Boolean).slice(0, 4),
      hairstyle: { name: String(o.hairstyle?.name || 'Soft waves').slice(0, 60), reason: String(o.hairstyle?.reason || 'A versatile finish.').slice(0, 200) },
    })
  }
  return { outfits: out, rejected }
}

/**
 * Asks the configured AI provider (Gemini by default) for outfits. Never throws:
 * returns { ok: true, recommendations } or { ok: false, code, message } so callers can
 * report the real reason instead of silently pretending a fallback was AI output.
 */
export async function tryAIRecommendation({
  items, prefs = {}, occasion = 'Casual', style = 'chic', weather = 'Mild', focus = 'Any', count = 4, history = [],
  apiKey, baseUrl, model, fetchImpl = globalThis.fetch, timeoutMs = 25000,
}) {
  if (!apiKey) return { ok: false, code: 'AI_NOT_CONFIGURED', message: 'AI styling is not configured. Add AI_API_KEY or GEMINI_API_KEY to server/.env to enable Gemini.' }
  const settings = { baseUrl: baseUrl || DEFAULT_AI_BASE_URL, model: model || DEFAULT_AI_MODEL }
  const seenKeys = new Set(historyKeys(history, 'key'))
  const seenFoundations = new Set(historyKeys(history, 'foundationKey'))
  const avoid = [...seenFoundations].slice(-30).map(k => k.split('|'))
  const wardrobe = items.slice(0, 200).map(i => ({
    id: idOf(i), name: i.name, category: i.category, color: i.color, style: i.style,
    ...(i.notes ? { notes: String(i.notes).slice(0, 120) } : {}),
  }))
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: JSON.stringify({
      requestedOutfits: count, occasion, styleMood: style, weather, colourDirection: focus,
      favouriteColours: prefs?.colors || [], avoidCombos: avoid, wardrobe,
    }) },
  ]
  const run = async mode => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await callProvider({ apiKey, ...settings, messages, mode, fetchImpl, timeoutMs })
      } catch (err) {
        const transient = err instanceof AIError && (err.code === 'AI_NETWORK' || (err.status >= 500 && err.status < 600))
        if (transient && attempt < 1) { await sleep(1200); continue }
        throw err
      }
    }
  }
  try {
    let raw
    try {
      raw = await run('schema')
    } catch (err) {
      // Some models/endpoints reject strict JSON-schema output; retry once in plain JSON mode.
      if (err instanceof AIError && err.code === 'AI_BAD_REQUEST') raw = await run('json')
      else throw err
    }
    const { outfits, rejected } = validateAIOutfits(raw, items, { occasion, style, count, seenKeys, seenFoundations })
    if (!outfits.length) {
      console.warn(`[AI] no valid outfits in response (rejected ${rejected})`)
      return { ok: false, code: 'AI_NO_VALID_OUTFITS', message: 'The AI response did not contain any outfits made from your wardrobe.' }
    }
    return { ok: true, recommendations: outfits, rejected }
  } catch (err) {
    if (err instanceof AIError) {
      console.warn(`[AI] ${err.code}: ${err.message}`)
      return { ok: false, code: err.code, message: err.message }
    }
    console.warn('[AI] unexpected error:', err?.message)
    return { ok: false, code: 'AI_PROVIDER_ERROR', message: 'The AI provider could not be used right now.' }
  }
}

/* ------------------------------- orchestration ------------------------------- */

/**
 * One entry point for the route: validates the wardrobe, asks Gemini first, validates the
 * result, and falls back to the local engine with an honest status.
 */
export async function generateOutfits({
  items, prefs = {}, occasion = 'Casual', style = 'chic', weather = 'Mild', focus = 'Any',
  count = 4, exclude = [], history = [], forceFallback = false, seed = Date.now(), ai = aiSettings(), fetchImpl,
}) {
  const want = clamp(Math.round(Number(count)) || 4, 1, 5)
  const excluded = new Set(exclude.map(String))
  const usable = items.filter(i => !excluded.has(idOf(i)))
  const base = { occasion, style, weather, focus }
  const status = (extra = {}) => ({ configured: ai.configured, used: false, code: '', message: '', ...extra })

  if (!usable.length) return { recommendations: [], source: 'none', aiStatus: status(), code: 'EMPTY_WARDROBE', message: wardrobeGap(items) }
  if (!hasFoundation(usable)) return { recommendations: [], source: 'none', aiStatus: status(), code: 'INCOMPLETE_WARDROBE', message: wardrobeGap(usable) }

  const local = (n, skipFoundations = []) => buildRecommendations({ items: usable, prefs, ...base, count: n, history, skipFoundations, seed })
  let recommendations = []
  let aiStatus

  if (forceFallback) {
    recommendations = local(want)
    aiStatus = status({ code: 'AI_SKIPPED', message: 'AI styling was skipped for this request.' })
  } else if (!ai.configured) {
    recommendations = local(want)
    aiStatus = status({ code: 'AI_NOT_CONFIGURED', message: 'AI styling is not configured, so the local styling engine was used. Add AI_API_KEY or GEMINI_API_KEY to server/.env to enable Gemini.' })
  } else {
    const result = await tryAIRecommendation({ items: usable, prefs, ...base, count: want, history, apiKey: ai.apiKey, baseUrl: ai.baseUrl, model: ai.model, ...(fetchImpl ? { fetchImpl } : {}) })
    if (result.ok) {
      recommendations = result.recommendations
      aiStatus = status({ used: true })
      if (recommendations.length < want) {
        const extra = local(want - recommendations.length, recommendations.map(r => r.foundationKey))
        recommendations = [...recommendations, ...extra]
        if (extra.length) aiStatus.message = `The AI suggested ${result.recommendations.length} look(s); the rest were filled in by the local styling engine and are labelled as such.`
      }
    } else {
      recommendations = local(want)
      aiStatus = status({ code: result.code, message: `${result.message} The local styling engine was used instead.` })
    }
  }

  const aiCount = recommendations.filter(r => r.source === 'ai').length
  const source = !recommendations.length ? 'none' : aiCount === recommendations.length ? 'ai' : aiCount ? 'mixed' : 'fallback'
  const message = recommendations.length < want
    ? `Only ${recommendations.length} fresh look(s) are available from your wardrobe right now. Add more tops, bottoms or dresses for more variety.`
    : ''
  return { recommendations, source, aiStatus, code: recommendations.length ? '' : 'NO_OUTFITS', message }
}