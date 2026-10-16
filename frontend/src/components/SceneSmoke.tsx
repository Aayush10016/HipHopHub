import { useId } from 'react'

/** Slow, composited stage haze; decorative and independent of page interactions. */
export default function SceneSmoke({ className = '' }: { className?: string }) {
    const id = useId().replace(/:/g, '')
    return <div className={`scene-smoke ${className}`} aria-hidden="true">
        <svg className="smoke-drift" viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid slice" focusable="false">
            <defs>
                <filter id={`haze-${id}`} x="-40%" y="-40%" width="180%" height="180%" colorInterpolationFilters="sRGB">
                    <feTurbulence type="fractalNoise" baseFrequency="0.009 0.018" numOctaves="3" seed="17" result="noise" />
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale="145" xChannelSelector="R" yChannelSelector="B" />
                    <feGaussianBlur stdDeviation="15" />
                </filter>
                <linearGradient id={`vapour-${id}`} x1="0" y1="1" x2="0.7" y2="0">
                    <stop stopColor="currentColor" stopOpacity="0" /><stop offset=".45" stopColor="currentColor" stopOpacity=".5" /><stop offset="1" stopColor="currentColor" stopOpacity=".04" />
                </linearGradient>
            </defs>
            <g filter={`url(#haze-${id})`} fill={`url(#vapour-${id})`}>
                <path d="M-200 930C-50 680 260 850 390 590S520 250 900 210C1100 190 1020 0 1360-90L1510 160C1210 220 1300 410 1000 480S760 580 610 790S170 1040-200 1100Z" />
                <path d="M-160 560C130 330 360 600 560 370S820 290 1040 80L1160 200C970 470 820 360 660 600S310 690 80 820Z" opacity=".55" />
                <path d="M780 1040C600 720 1090 760 1000 460S1430 290 1520 50L1650 710C1240 540 1230 1030 780 1040Z" opacity=".4" />
            </g>
        </svg>
    </div>
}
