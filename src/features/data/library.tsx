import builtinSongManifest from '@/manifest.json'
import { SongMetadata, SongSource } from '@/types'
import { getKey } from '@/utils'
import { atom, useAtomValue } from 'jotai'
import { localSongsAtom, uploadedSongsAtom } from '../persist'

const builtinMetadata: Array<[string, SongMetadata]> = Object.values(builtinSongManifest).map(
  (metadata) => {
    const key = getKey(metadata.id, metadata.source as SongSource)
    return [key, metadata as SongMetadata]
  },
)

const builtinIds = new Set(builtinMetadata.map(([_, s]) => s.id.toLowerCase()))

const builtinMetadataAtom = atom(builtinMetadata)
const storageMetadataAtom = atom((get) => {
  const localSongs = Array.from(get(localSongsAtom).values()).flatMap((x) => x)
  const uploadedSongs = get(uploadedSongsAtom)
  const allSongs = [...localSongs, ...uploadedSongs].filter((x) => {
    if (!x || !x.title || x.title.toLowerCase().includes('untitled')) return false
    // Only exclude exact duplicate IDs that collide with built-in IDs
    if (x.source !== 'builtin' && builtinIds.has((x.id || '').toLowerCase())) {
      return false
    }
    return true
  })

  const seenKeys = new Set<string>()
  const uniqueStorageSongs: [string, SongMetadata][] = []
  for (const song of allSongs) {
    const key = getKey(song.id, song.source)
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      uniqueStorageSongs.push([key, song])
    }
  }

  return uniqueStorageSongs
})

export const songManifestAtom = atom<Map<string, SongMetadata>>((get) => {
  const builtinMetadata = get(builtinMetadataAtom)
  const storageMetadata = get(storageMetadataAtom)
  return new Map([...builtinMetadata, ...storageMetadata])
})

const songManifestAsListAtom = atom<Array<SongMetadata>>((get) => {
  const songManifest = get(songManifestAtom)
  return Array.from(songManifest.values())
})

export function useSongManifest(): SongMetadata[] {
  const songManifestAsList = useAtomValue(songManifestAsListAtom)
  return songManifestAsList
}

export function useSongMetadata(id: string, source: SongSource): SongMetadata | undefined {
  const key = getKey(id, source)
  const songManifest = useAtomValue(songManifestAtom)
  return songManifest.get(key)
}
