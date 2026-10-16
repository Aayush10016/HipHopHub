interface Props { title: string; artist?: string; youtubeUrl?: string; spotifyUrl?: string }
export default function ListeningLinks({ title, artist = '', youtubeUrl, spotifyUrl }: Props) {
    const query = `${artist} ${title}`.trim()
    const directYouTube = youtubeUrl && /^https:\/\/(www\.)?(youtube\.com\/(watch\?|playlist\?)|youtu\.be\/)/.test(youtubeUrl)
    const directSpotify = spotifyUrl && /^https:\/\/open\.spotify\.com\/(track|album)\//.test(spotifyUrl)
    return <div className="listening-links" aria-label={`Listen to ${title}`}>
        <a href={directYouTube ? youtubeUrl : `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' official audio')}`} target="_blank" rel="noopener noreferrer">{directYouTube ? 'Play on YouTube' : 'Find on YouTube'} <span aria-hidden="true">↗</span></a>
        <a href={directSpotify ? spotifyUrl : `https://open.spotify.com/search/${encodeURIComponent(query)}`} target="_blank" rel="noopener noreferrer">{directSpotify ? 'Play on Spotify' : 'Find on Spotify'} <span aria-hidden="true">↗</span></a>
    </div>
}
