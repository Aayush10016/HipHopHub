import SceneSmoke from './SceneSmoke'
interface Props { name: string; theme: string; images: string[] }

/** Build scenery from the artist's own records. */
export default function ArtistAtmosphere({ name, theme, images }: Props) {
    return <div className="artist-atmosphere" data-world={theme} aria-hidden="true">
        <div className="world-type">{name}</div><div className="world-grid" /><div className="world-orbit" />
        <div className="world-posters">{images.slice(0, 3).map((image, i) => <img key={`${image}-${i}`} src={image} alt="" decoding="async" />)}</div>
        <div className="world-wash" /><SceneSmoke className="artist-smoke" />
    </div>
}
