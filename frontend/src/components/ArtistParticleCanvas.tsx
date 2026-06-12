/**
 * ArtistParticleCanvas — GPU-accelerated canvas particle system.
 *
 * Renders configurable particles (circle, square, geometric, abstract)
 * on a single offscreen canvas using requestAnimationFrame.
 * Particles drift, pulse, and glow based on the flagship theme.
 *
 * Performance: < 100 particles, single canvas, will-change: transform.
 * Auto-disposes RAF and canvas on unmount.
 */

import { useEffect, useRef, memo } from 'react'
import type { FlagshipParticles } from '../utils/flagshipThemes'

interface Props {
    config: FlagshipParticles
    className?: string
}

interface Particle {
    x: number
    y: number
    size: number
    speedX: number
    speedY: number
    opacity: number
    opacityDir: number
    rotation: number
    rotationSpeed: number
}

function hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (!result) return [255, 255, 255]
    return [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
    ]
}

function ArtistParticleCanvas({ config, className = '' }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const rafRef = useRef<number>(0)
    const particlesRef = useRef<Particle[]>([])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d', { alpha: true })
        if (!ctx) return

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            const rect = canvas.parentElement?.getBoundingClientRect()
            if (!rect) return
            canvas.width = rect.width * dpr
            canvas.height = rect.height * dpr
            canvas.style.width = `${rect.width}px`
            canvas.style.height = `${rect.height}px`
            ctx.scale(dpr, dpr)
        }

        resize()

        const [r, g, b] = hexToRgb(config.color)
        const [gr, gg, gb] = hexToRgb(config.glowColor.replace(/rgba?\(.*\)/, config.color))

        // Initialize particles
        const rect = canvas.parentElement?.getBoundingClientRect()
        const w = rect?.width ?? 800
        const h = rect?.height ?? 600

        particlesRef.current = Array.from({ length: config.count }, () => {
            const size = config.sizeRange[0] + Math.random() * (config.sizeRange[1] - config.sizeRange[0])
            return {
                x: Math.random() * w,
                y: Math.random() * h,
                size,
                speedX: (Math.random() - 0.5) * config.speed,
                speedY: (Math.random() - 0.5) * config.speed * 0.6,
                opacity: 0.2 + Math.random() * 0.5,
                opacityDir: Math.random() > 0.5 ? 0.003 : -0.003,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.02,
            }
        })

        const drawParticle = (p: Particle) => {
            ctx.save()
            ctx.globalAlpha = p.opacity
            ctx.translate(p.x, p.y)
            ctx.rotate(p.rotation)

            if (config.glow) {
                ctx.shadowBlur = p.size * 4
                ctx.shadowColor = `rgba(${gr}, ${gg}, ${gb}, ${p.opacity * 0.6})`
            }

            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.opacity})`

            switch (config.shape) {
                case 'square':
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
                    break
                case 'geometric': {
                    ctx.beginPath()
                    const sides = 6
                    for (let j = 0; j < sides; j++) {
                        const angle = (j / sides) * Math.PI * 2 - Math.PI / 2
                        const px = Math.cos(angle) * p.size
                        const py = Math.sin(angle) * p.size
                        j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
                    }
                    ctx.closePath()
                    ctx.fill()
                    break
                }
                case 'abstract': {
                    ctx.beginPath()
                    const points = 5
                    for (let j = 0; j < points; j++) {
                        const angle = (j / points) * Math.PI * 2
                        const rad = p.size * (0.5 + Math.random() * 0.5)
                        const px = Math.cos(angle) * rad
                        const py = Math.sin(angle) * rad
                        j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
                    }
                    ctx.closePath()
                    ctx.fill()
                    break
                }
                default:
                    ctx.beginPath()
                    ctx.arc(0, 0, p.size, 0, Math.PI * 2)
                    ctx.fill()
            }

            ctx.restore()
        }

        const animate = () => {
            const parentRect = canvas.parentElement?.getBoundingClientRect()
            const cw = parentRect?.width ?? 800
            const ch = parentRect?.height ?? 600

            ctx.clearRect(0, 0, cw, ch)

            for (const p of particlesRef.current) {
                p.x += p.speedX
                p.y += p.speedY
                p.rotation += p.rotationSpeed
                p.opacity += p.opacityDir

                if (p.opacity >= 0.7 || p.opacity <= 0.1) {
                    p.opacityDir *= -1
                }

                // Wrap around edges
                if (p.x < -10) p.x = cw + 10
                if (p.x > cw + 10) p.x = -10
                if (p.y < -10) p.y = ch + 10
                if (p.y > ch + 10) p.y = -10

                drawParticle(p)
            }

            rafRef.current = requestAnimationFrame(animate)
        }

        rafRef.current = requestAnimationFrame(animate)

        const resizeObserver = new ResizeObserver(() => {
            resize()
        })
        if (canvas.parentElement) {
            resizeObserver.observe(canvas.parentElement)
        }

        return () => {
            cancelAnimationFrame(rafRef.current)
            resizeObserver.disconnect()
        }
    }, [config])

    return (
        <canvas
            ref={canvasRef}
            className={`artist-particle-canvas ${className}`}
            aria-hidden="true"
            style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 4,
                willChange: 'transform',
            }}
        />
    )
}

export default memo(ArtistParticleCanvas)
