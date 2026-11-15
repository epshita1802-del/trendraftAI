import { Heart, Check, Sparkles, Cpu } from 'lucide-react'
import ItemImage from './ItemImage'

const OPTIONAL = ['Layering', 'Accessories']

/** The outfit's real wardrobe photos in a clean grid. Main pieces first, optional extras after. */
export function OutfitCollage({ items = [], compact = false }) {
  const main = items.filter(i => !OPTIONAL.includes(i.category))
  const extras = items.filter(i => OPTIONAL.includes(i.category))
  const tile = (item, optional) => (
    <figure className={`collage-tile ${optional ? 'optional' : ''}`} key={item.id} data-item-id={item.id}>
      <div className="collage-photo"><ItemImage item={item} /></div>
      <figcaption>
        <strong>{item.name}</strong>
        <span>{optional ? 'Optional · ' : ''}{item.category}{item.color ? ` · ${item.color}` : ''}</span>
        {!compact && item.note ? <em>{item.note}</em> : null}
      </figcaption>
    </figure>
  )
  return (
    <div className={`outfit-collage ${compact ? 'compact' : ''}`}>
      <div className="collage-main" style={{ '--cols': Math.min(Math.max(main.length, 1), 3) }}>{main.map(i => tile(i, false))}</div>
      {extras.length > 0 && <div className="collage-extras">{extras.map(i => tile(i, true))}</div>}
    </div>
  )
}

export function SourceBadge({ source }) {
  return source === 'ai'
    ? <span className="source-badge ai"><Sparkles size={11} /> AI stylist · Gemini</span>
    : <span className="source-badge local"><Cpu size={11} /> Local styling engine</span>
}

/** One outfit suggestion. Uses the user's own item photos; there is no mannequin or avatar. */
export default function OutfitCard({ outfit, saved = false, saving = false, onSave }) {
  return (
    <article className="outfit-card">
      <header className="outfit-card-head">
        <div>
          <div className="outfit-badges">
            <SourceBadge source={outfit.source} />
            <span className="meta-chip">{outfit.occasion}</span>
            <span className="meta-chip">{outfit.style}</span>
          </div>
          <h3>{outfit.title}</h3>
        </div>
        <span className="score-ring" title={outfit.scoreNote}><strong>{outfit.score}</strong><small>EST. MATCH</small></span>
      </header>
      <OutfitCollage items={outfit.items} />
      <div className="outfit-notes">
        <p className="outfit-explain">{outfit.explanation}</p>
        {outfit.colorAdvice && <div className="colour-note"><span>✿</span><div><strong>Colour advice</strong><p>{outfit.colorAdvice}</p></div></div>}
        {outfit.stylingTips?.length > 0 && <div className="colour-note"><span>✧</span><div><strong>Styling tips</strong><ul className="tip-list">{outfit.stylingTips.map((t, i) => <li key={i}>{t}</li>)}</ul></div></div>}
        {outfit.hairstyle?.name && <div className="colour-note"><span>〰</span><div><strong>Hair idea · {outfit.hairstyle.name}</strong><p>{outfit.hairstyle.reason}</p></div></div>}
      </div>
      <footer className="outfit-card-foot">
        <p className="score-note">{outfit.scoreNote}</p>
        {onSave && (
          <button className={`button ${saved ? 'button-light' : 'button-dark'}`} onClick={() => onSave(outfit)} disabled={saved || saving}>
            {saved ? <><Check size={15} /> Saved</> : <><Heart size={15} /> {saving ? 'Saving…' : 'Save this look'}</>}
          </button>
        )}
      </footer>
    </article>
  )
}
