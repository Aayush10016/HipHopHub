import portraits from '../artistPortraits.json'
/** Only identity-matched artist portraits; unverified catalog images are never used. */
export const artistPortrait = (id?: number) => id ? (portraits as Record<string, string | null>)[String(id)] || undefined : undefined
