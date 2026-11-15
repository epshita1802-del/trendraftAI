import { useEffect, useState } from 'react'
import { Shirt } from 'lucide-react'
import { assetUrl } from '../services/api'

/** The item's own photo, or a tidy placeholder (category + colour) if there is none or it fails to load. */
export default function ItemImage({ item, className = '' }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [item.imageUrl])
  const src = assetUrl(item.imageUrl)
  if (src && !failed) return <img className={className} src={src} alt={item.name} loading="lazy" onError={() => setFailed(true)} />
  const shade = (item.color || 'neutral').toLowerCase().replace(/[^a-z]/g, '')
  return <div className={`cloth-placeholder shade-${shade}`} role="img" aria-label={`${item.name} (no photo)`}><Shirt size={36} /><span>{item.category}</span>{item.color ? <small>{item.color}</small> : null}</div>
}
