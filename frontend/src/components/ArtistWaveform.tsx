/**
 * ArtistWaveform — ambient waveform visualizer.
 *
 * Draws gentle, color-matched sine waves on a canvas behind
 * the hero content.  Purely decorative — adds depth and motion.
 */

import { useEffect, useRef, memo } from 'react'

interface Props {
    color: string
    opacity?: number
    className?: string
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

function ArtistWaveform({ color, opacity = 0.08, className = '' }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const rafRef = useRef<number>(0)
    const phaseRef = useRef(0)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d', { alpha: true })
        if (!ctx) return

        const [r, g, b] = hexToRgb(color)

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            const rect = canvas.parentElement?.getBoundingClientRect()
            if (!rect) return
            canvas.width = rect.width * dpr
            canvas.height = rect.height * dpr
            canvas.style.width = `${rect.width}px`
            canvas.style.height = `${rect.height}px`
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        }

        resize()

        const drawWave = (
            w: number,
            h: number,
            amplitude: number,
            frequency: number,
            phase: number,
            yOffset: number,
            waveOpacity: number,
        ) => {
            ctx.beginPath()
            ctx.moveTo(0, yOffset)

            for (let x = 0; x <= w; x += 2) {
                const y =
                    yOffset +
                    Math.sin((x * frequency) / w + phase) * amplitude +
                    Math.sin((x * frequency * 0.5) / w + phase * 1.3) * (amplitude * 0.4)
                ctx.lineTo(x, y)
            }

            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${waveOpacity})`
            ctx.lineWidth = 1.5
            ctx.stroke()
        }

        const animate = () => {
            const parentRect = canvas.parentElement?.getBoundingClientRect()
            const w = parentRect?.width ?? 800
            const h = parentRect?.height ?? 400

            ctx.clearRect(0, 0, w, h)

            phaseRef.current += 0.008

            // 3 overlapping waves at different depths
            drawWave(w, h, 18, 4, phaseRef.current, h * 0.6, opacity * 0.7)
            drawWave(w, h, 12, 6, phaseRef.current * 1.3, h * 0.65, opacity * 0.5)
            drawWave(w, h, 8, 8, phaseRef.current * 0.7, h * 0.7, opacity * 0.3)

            rafRef.current = requestAnimationFrame(animate)
        }

        rafRef.current = requestAnimationFrame(animate)

        const resizeObserver = new ResizeObserver(() => resize())
        if (canvas.parentElement) resizeObserver.observe(canvas.parentElement)

        return () => {
            cancelAnimationFrame(rafRef.current)
            resizeObserver.disconnect()
        }
    }, [color, opacity])

    return (
        <canvas
            ref={canvasRef}
            className={`artist-waveform ${className}`}
            aria-hidden="true"
            style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 2,
            }}
        />
    )
}

export default memo(ArtistWaveform)
