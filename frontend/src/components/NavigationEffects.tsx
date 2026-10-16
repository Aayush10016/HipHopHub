import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function NavigationEffects() {
    const { pathname } = useLocation()
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' })
    }, [pathname])
    return null
}
