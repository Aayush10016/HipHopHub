import { useEffect, useState } from 'react'
import type { ImgHTMLAttributes } from 'react'

/** An unavailable sleeve keeps its space without a browser broken-image icon. */
export default function Artwork({ src, alt = '', onError, className = '', ...props }: ImgHTMLAttributes<HTMLImageElement>) {
    const [failed, setFailed] = useState(false)
    useEffect(() => setFailed(false), [src])
    if (!src || failed) return <span className={`artwork-fallback ${className}`} role={alt ? 'img' : undefined} aria-label={alt ? `${alt} — artwork unavailable` : undefined} aria-hidden={alt ? undefined : true}><span aria-hidden="true">{alt ? alt.charAt(0).toUpperCase() : '↗'}</span></span>
    return <img {...props} className={className} src={src} alt={alt} decoding="async" onError={event => { setFailed(true); onError?.(event) }} />
}
