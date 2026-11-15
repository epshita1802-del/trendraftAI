import test from 'node:test'
import assert from 'node:assert/strict'
import { aiSettings, buildRecommendation, buildRecommendations, generateOutfits, tryAIRecommendation, validateAIOutfits } from './styling.js'

const mk = (n, name, category, color, style = 'casual') => ({ _id: String(n).padStart(24, '0'), name, category, color, style, imageUrl: `/uploads/${n}.jpg` })
const wardrobe = [
  mk(1, 'White tee', 'Tops', 'White', 'minimal'), mk(2, 'Black ribbed top', 'Tops', 'Black', 'chic'), mk(3, 'Blush knit', 'Tops', 'Pink', 'soft'),
  mk(4, 'Blue jeans', 'Bottoms', 'Blue'), mk(5, 'Cream trousers', 'Bottoms', 'Cream', 'elegant'), mk(6, 'Black skirt', 'Bottoms', 'Black', 'chic'),
  mk(7, 'Floral dress', 'Dresses & ethnic wear', 'Pink', 'romantic'),
  mk(8, 'White sneakers', 'Shoes', 'White'), mk(9, 'Black flats', 'Shoes', 'Black', 'chic'),
  mk(10, 'Gold hoops', 'Accessories', 'Gold', 'chic'), mk(11, 'Cream bag', 'Accessories', 'Cream', 'minimal'),
  mk(12, 'Camel cardigan', 'Layering', 'Camel', 'classic'),
]
const ids = new Set(wardrobe.map(i => String(i._id)))
const id = n => String(n).padStart(24, '0')

test('Gemini API key environment name is accepted alongside the legacy AI key', () => {
  assert.equal(aiSettings({ GEMINI_API_KEY: ' gemini-key ' }).apiKey, 'gemini-key')
  assert.equal(aiSettings({ AI_API_KEY: 'ai-key', GEMINI_API_KEY: 'gemini-key' }).apiKey, 'ai-key')
  assert.equal(aiSettings({ AI_API_KEY: '  ', GEMINI_API_KEY: 'gemini-key' }).apiKey, 'gemini-key')
})

// ---------- local engine ----------
test('single-outfit helper still returns a structured outfit made of owned items', () => {
  const r = buildRecommendation({ items: wardrobe.slice(0, 3).concat([mk(4, 'Blue jeans', 'Bottoms', 'Blue')]), occasion: 'College', style: 'casual' })
  assert.ok(r.items.length >= 2)
  assert.ok(r.explanation)
  assert.ok(r.score >= 55 && r.score <= 99)
  assert.equal(r.source, 'fallback')
})
test('empty wardrobe explains what to add', () => {
  const r = buildRecommendation({ items: [] })
  assert.equal(r.items.length, 0)
  assert.match(r.explanation, /empty|Add at least one/)
})
test('local engine returns several distinct outfits using only real item ids', () => {
  const recs = buildRecommendations({ items: wardrobe, occasion: 'Party', style: 'chic', count: 5 })
  assert.equal(recs.length, 5)
  assert.equal(new Set(recs.map(r => r.key)).size, 5)
  assert.equal(new Set(recs.map(r => r.foundationKey)).size, 5, 'main pieces should differ between looks')
  for (const r of recs) {
    assert.ok(r.ownedItemIds.every(x => ids.has(x)))
    assert.deepEqual(r.items.map(i => i.id), r.ownedItemIds)
    assert.ok(r.items.every(i => i.imageUrl.startsWith('/uploads/')), 'images come from the wardrobe items')
    const cats = r.items.map(i => i.category)
    assert.ok(cats.includes('Dresses & ethnic wear') || (cats.includes('Tops') && cats.includes('Bottoms')))
    assert.ok(!(cats.includes('Dresses & ethnic wear') && cats.includes('Tops')))
    assert.ok(cats.filter(c => c === 'Shoes').length <= 1)
    assert.equal(r.source, 'fallback')
  }
})
test('regenerating with history gives a different first look', () => {
  const first = buildRecommendations({ items: wardrobe, count: 3 })
  const next = buildRecommendations({ items: wardrobe, count: 3, history: first.map(r => ({ key: r.key, foundationKey: r.foundationKey })) })
  assert.notEqual(next[0].foundationKey, first[0].foundationKey)
  assert.ok(!first.some(r => r.foundationKey === next[0].foundationKey))
})
test('regeneration returns fewer looks rather than repeating an exhausted foundation', () => {
  const history = []
  for (;;) {
    const batch = buildRecommendations({ items: wardrobe, count: 5, history })
    if (!batch.length) break
    history.push(...batch.map(r => ({ key: r.key, foundationKey: r.foundationKey })))
  }
  const exhausted = buildRecommendations({
    items: wardrobe,
    count: 3,
    history,
  })
  assert.equal(exhausted.length, 0)
})
test('excluded items are never used', () => {
  const recs = buildRecommendations({ items: wardrobe, count: 5, exclude: [id(1), id(7)] })
  assert.ok(recs.length > 0)
  assert.ok(recs.every(r => !r.ownedItemIds.includes(id(1)) && !r.ownedItemIds.includes(id(7))))
})
test('limited wardrobes degrade gracefully', () => {
  assert.equal(buildRecommendations({ items: [mk(1, 'Tee', 'Tops', 'White')] }).length, 0)
  const dressOnly = buildRecommendations({ items: [mk(1, 'Dress', 'Dresses & ethnic wear', 'Pink')], count: 4 })
  assert.equal(dressOnly.length, 1)
  const oneEach = buildRecommendations({ items: [mk(1, 'Tee', 'Tops', 'White'), mk(2, 'Jeans', 'Bottoms', 'Blue')], count: 4 })
  assert.equal(oneEach.length, 1)
  const withShoes = buildRecommendations({ items: [mk(1, 'Tee', 'Tops', 'White'), mk(2, 'Jeans', 'Bottoms', 'Blue'), mk(3, 'A', 'Shoes', 'White'), mk(4, 'B', 'Shoes', 'Black')], count: 4 })
  assert.equal(withShoes.length, 1, 'shoe swaps alone are not distinct outfits')
})
test('local styling skips clashing colours and clearly mismatched formality', () => {
  const clashingColors = [mk(20, 'Red top', 'Tops', 'Red'), mk(21, 'Green trousers', 'Bottoms', 'Green')]
  const mismatchedStyles = [mk(22, 'Sports jersey', 'Tops', 'White', 'athletic'), mk(23, 'Formal trousers', 'Bottoms', 'Black', 'formal')]
  assert.equal(buildRecommendations({ items: clashingColors, count: 1 }).length, 0)
  assert.equal(buildRecommendations({ items: mismatchedStyles, count: 1, style: 'chic' }).length, 0)
  assert.equal(buildRecommendations({ items: mismatchedStyles, count: 1, style: 'experimental' }).length, 1)
})
test('cold weather adds the layering piece when one exists', () => {
  const recs = buildRecommendations({ items: wardrobe, count: 3, weather: 'Cold' })
  assert.ok(recs.every(r => r.items.some(i => i.category === 'Layering')))
})

// ---------- AI path (fetch is mocked; no network, no real key) ----------
const ai = { configured: true, apiKey: 'test-key-123', baseUrl: 'https://example.test/v1beta/openai/', model: 'test-model' }
const okResponse = outfits => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ outfits }) } }] }) })
const errResponse = (status, message = 'nope') => ({ ok: false, status, json: async () => ({ error: { message } }) })
const outfit = (itemIds, extra = {}) => ({ title: 'AI look', itemIds, explanation: 'Because.', colorAdvice: 'Keep it tonal.', stylingTips: ['Tuck.'], hairstyle: { name: 'Bun', reason: 'Neat.' }, itemNotes: [], score: 88, ...extra })
const run = (fetchImpl, over = {}) => generateOutfits({ items: wardrobe, occasion: 'Date', style: 'elegant', count: 3, ai, fetchImpl, ...over })

test('valid AI outfits are returned and labelled as AI', async () => {
  let call
  const res = await run(async (url, init) => { call = { url, init }; return okResponse([outfit([id(1), id(5), id(8)]), outfit([id(7), id(9), id(10)]), outfit([id(2), id(4), id(8), id(12)])]) })
  assert.equal(res.source, 'ai')
  assert.equal(res.aiStatus.used, true)
  assert.equal(res.recommendations.length, 3)
  assert.ok(res.recommendations.every(r => r.source === 'ai'))
  assert.equal(call.url, 'https://example.test/v1beta/openai/chat/completions')
  assert.equal(call.init.headers.Authorization, 'Bearer test-key-123')
  const sent = JSON.parse(JSON.parse(call.init.body).messages[1].content)
  assert.deepEqual(sent.wardrobe.map(w => w.id).sort(), [...ids].sort())
  assert.equal(JSON.parse(call.init.body).model, 'test-model')
})
test('invented, foreign or malformed AI outfits are rejected', async () => {
  const bad = [
    outfit([id(1), id(5), '999999999999999999999999']),       // unknown id
    outfit([id(1), id(2), id(5)]),                              // two tops
    outfit([id(7), id(1)]),                                     // dress + top
    outfit([id(8), id(9)]),                                     // no foundation
    outfit([id(1), id(5), id(8)]),                              // valid
    outfit([id(5), id(1), id(8)]),                              // duplicate of the valid one
  ]
  const { outfits, rejected } = validateAIOutfits({ outfits: bad }, wardrobe, { occasion: 'Date', style: 'chic', count: 5 })
  assert.equal(outfits.length, 1)
  assert.equal(rejected, 5)
  assert.deepEqual(outfits[0].ownedItemIds.sort(), [id(1), id(5), id(8)].sort())
})
test('AI outfits cannot repeat a foundation by changing only shoes or accessories', () => {
  const { outfits, rejected } = validateAIOutfits(
    { outfits: [outfit([id(1), id(5), id(8)]), outfit([id(1), id(5), id(9), id(10)])] },
    wardrobe,
    { occasion: 'Date', style: 'chic', count: 3 },
  )
  assert.equal(outfits.length, 1)
  assert.equal(rejected, 1)
})
test('AI outfits with clashing colours or incompatible styles are rejected', () => {
  const wardrobeWithClash = [
    mk(20, 'Red top', 'Tops', 'Red'),
    mk(21, 'Green trousers', 'Bottoms', 'Green'),
    mk(22, 'Sports jersey', 'Tops', 'White', 'athletic'),
    mk(23, 'Formal trousers', 'Bottoms', 'Black', 'formal'),
  ]
  const { outfits, rejected } = validateAIOutfits(
    { outfits: [outfit([id(20), id(21)]), outfit([id(22), id(23)])] },
    wardrobeWithClash,
    { occasion: 'Office', style: 'chic', count: 3 },
  )
  assert.equal(outfits.length, 0)
  assert.equal(rejected, 2)
})
test('AI outfits avoid foundations already shown in generation history', () => {
  const { outfits, rejected } = validateAIOutfits(
    { outfits: [outfit([id(1), id(5), id(8)]), outfit([id(7), id(9)])] },
    wardrobe,
    { occasion: 'Date', style: 'chic', count: 3, seenFoundations: new Set([`${id(1)}|${id(5)}`]) },
  )
  assert.equal(outfits.length, 1)
  assert.equal(outfits[0].foundationKey, id(7))
  assert.equal(rejected, 1)
})
test('partial AI result is topped up by the local engine and labelled per look', async () => {
  const res = await run(async () => okResponse([outfit([id(1), id(5), id(8)])]))
  assert.equal(res.source, 'mixed')
  assert.equal(res.recommendations.length, 3)
  assert.equal(res.recommendations[0].source, 'ai')
  assert.ok(res.recommendations.slice(1).every(r => r.source === 'fallback'))
  assert.equal(new Set(res.recommendations.map(r => r.foundationKey)).size, 3)
})
for (const [status, code] of [[401, 'AI_AUTH'], [403, 'AI_AUTH'], [404, 'AI_MODEL'], [429, 'AI_RATE_LIMIT']]) {
  test(`provider HTTP ${status} falls back and reports ${code}, never calling the result AI`, async () => {
    const res = await run(async () => errResponse(status, 'bad key test-key-123'))
    assert.equal(res.source, 'fallback')
    assert.equal(res.aiStatus.used, false)
    assert.equal(res.aiStatus.code, code)
    assert.ok(res.recommendations.length >= 3 && res.recommendations.every(r => r.source === 'fallback'))
    assert.ok(!JSON.stringify(res).includes('test-key-123'), 'api key must never appear in output')
  })
}
test('strict schema rejection retries in plain JSON mode', async () => {
  const modes = []
  const res = await run(async (_u, init) => {
    const fmt = JSON.parse(init.body).response_format.type
    modes.push(fmt)
    return fmt === 'json_schema' ? errResponse(400, 'schema unsupported') : okResponse([outfit([id(1), id(5), id(8)]), outfit([id(7), id(9)]), outfit([id(2), id(4), id(8)])])
  })
  assert.deepEqual(modes, ['json_schema', 'json_object'])
  assert.equal(res.source, 'ai')
})
test('invalid JSON, network failure and empty results all fall back honestly', async () => {
  const badJson = await run(async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'not json' } }] }) }))
  assert.equal(badJson.aiStatus.code, 'AI_BAD_RESPONSE')
  const network = await tryAIRecommendation({ items: wardrobe, apiKey: 'k', fetchImpl: async () => { throw new TypeError('fetch failed') } })
  assert.equal(network.code, 'AI_NETWORK')
  const empty = await run(async () => okResponse([]))
  assert.equal(empty.aiStatus.code, 'AI_NO_VALID_OUTFITS')
  for (const r of [badJson, empty]) assert.ok(r.recommendations.every(x => x.source === 'fallback'))
})
test('a hung provider times out', async () => {
  const r = await tryAIRecommendation({ items: wardrobe, apiKey: 'k', timeoutMs: 30, fetchImpl: (_u, init) => new Promise((_res, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))) })
  assert.equal(r.code, 'AI_TIMEOUT')
})
test('missing API key uses the local engine and says so', async () => {
  let called = false
  const res = await generateOutfits({ items: wardrobe, count: 3, ai: { configured: false, apiKey: '' }, fetchImpl: async () => { called = true } })
  assert.equal(called, false)
  assert.equal(res.aiStatus.configured, false)
  assert.equal(res.aiStatus.code, 'AI_NOT_CONFIGURED')
  assert.equal(res.source, 'fallback')
})
test('when the wardrobe has no unseen foundations, generation explains why it returned fewer looks', async () => {
  const history = []
  for (;;) {
    const batch = buildRecommendations({ items: wardrobe, count: 5, history })
    if (!batch.length) break
    history.push(...batch.map(r => ({ key: r.key, foundationKey: r.foundationKey })))
  }
  const res = await generateOutfits({ items: wardrobe, count: 3, history, ai: { configured: false, apiKey: '' } })
  assert.equal(res.recommendations.length, 0)
  assert.match(res.message, /Only 0 fresh look/)
})
test('empty and incomplete wardrobes return no outfits and never call the AI', async () => {
  let called = false
  const fetchImpl = async () => { called = true }
  const empty = await generateOutfits({ items: [], ai, fetchImpl })
  assert.equal(empty.code, 'EMPTY_WARDROBE')
  const partial = await generateOutfits({ items: [mk(1, 'Tee', 'Tops', 'White'), mk(2, 'Flats', 'Shoes', 'Black')], ai, fetchImpl })
  assert.equal(partial.code, 'INCOMPLETE_WARDROBE')
  assert.match(partial.message, /bottom/)
  assert.equal(called, false)
})
