import { Modal, Sizer, UploadMidi } from '@/components'
import { useSongManifest } from '@/features/data/library'
import { initialize } from '@/features/persist/persistence'
import { useEventListener } from '@/hooks'
import { Plus } from '@/icons'
import { SongMetadata } from '@/types'
import { formatTime } from '@/utils'
import clsx from 'clsx'
import { Play, Sliders } from 'lucide-react'
import * as React from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Table } from './components'
import ManageFoldersForm from './components/AddFolderForm'
import { SearchBox } from './components/Table/SearchBox'

// TODO: after an upload, scroll to the newly uploaded song / make it focused.
export default function SelectSongPage() {
  const navigate = useNavigate()
  let songs: SongMetadata[] = useSongManifest()
  const [isUploadFormOpen, setUploadForm] = useState<boolean>(false)
  const [search, setSearch] = useState('')

  useEventListener<KeyboardEvent>('keydown', (event) => {
    if (event.key === 'Escape') {
      setUploadForm(false)
    }
  })

  const handleAddNew = (e: any) => {
    setUploadForm(true)
    e.stopPropagation()
  }

  const handleCloseAddNew = () => {
    setUploadForm(false)
  }

  return (
    <>
      <title>Library</title>
      <Modal show={isUploadFormOpen} onClose={handleCloseAddNew}>
        <ManageFoldersForm onClose={handleCloseAddNew} />
      </Modal>
      <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-[#16182c] text-[#e5e2e1] selection:bg-[#6c79f0]/30">
        {/* Volumetric Expanded Ambient Lighting Glows */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* Main expanded periwinkle glow */}
          <div className="absolute top-[-100px] left-1/2 h-[900px] w-[1400px] -translate-x-1/2 rounded-full bg-[#6c79f0]/12 blur-[180px]" />
          {/* Inner soft secondary indigo glow */}
          <div className="absolute top-[50px] left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-[#9ba4ff]/8 blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-(--breakpoint-lg) grow flex-col p-6 pt-32">
          <div className="flex flex-col items-center text-center">
            <h2 className="bg-gradient-to-r from-white via-[#e5e2e1] to-[#6c79f0] bg-clip-text text-4xl leading-[1.1] font-black tracking-tight text-transparent md:text-5xl">
              Library
            </h2>
            <Sizer height={8} />
            <h3 className="max-w-2xl text-base font-light text-[#cbc3d5] md:text-lg">
              Select a sample song from loomo’s library
            </h3>
          </div>
          <Sizer height={32} />
          <Table
            columns={[
              { label: 'Name', id: 'title', keep: true },
              {
                label: 'Length',
                id: 'duration',
                format: (n) => formatTime(Number(n)),
              },
              {
                label: 'Play',
                id: 'id',
                keep: true,
                format: (id, row) => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/play?id=${id}&source=${row.source || 'local'}`)
                    }}
                    className="cursor-pointer rounded-xl border border-white/10 bg-white/5 p-2 text-[#d0bcff] transition-all hover:bg-[#a078ff]/20 hover:text-white active:scale-95"
                    title="Play Song"
                  >
                    <Play className="h-4 w-4 fill-current" />
                  </button>
                ),
              },
              {
                label: 'Studio',
                id: 'id',
                keep: true,
                format: (id, row) => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/studio?id=${id}&source=${row.source || 'local'}`)
                    }}
                    className="cursor-pointer rounded-xl border border-white/10 bg-white/5 p-2 text-[#d0bcff] transition-all hover:bg-[#a078ff]/20 hover:text-white active:scale-95"
                    title="Open in Studio"
                  >
                    <Sliders className="h-4 w-4" />
                  </button>
                ),
              },
            ]}
            getId={(s: SongMetadata) => s.id}
            rows={songs}
            filter={['title']}
            onSelectRow={(id: string) => {
              const song = songs.find((s) => s.id === id)
              if (song) {
                navigate(`/studio?id=${id}&source=${song.source || 'local'}`)
              }
            }}
            search={search}
          />
        </div>
        <Sizer height={32} />
      </div>
    </>
  )
}
