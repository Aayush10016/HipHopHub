/** A playback indicator, driven by the audio element's play/pause state. */
export default function PlaybackMeter({ active }: { active: boolean }) {
    return <span className={`playback-meter ${active ? 'is-playing' : ''}`} role="img" aria-label={active ? 'Preview playing' : 'Preview paused'}><i/><i/><i/><i/><i/></span>
}
