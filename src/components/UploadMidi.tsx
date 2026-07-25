import { addUploadedSongs } from '@/features/persist/persistence'
import { FileMusic, FolderOpen, Upload, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function UploadMidi({
  onUpload,
  className,
  children,
}: {
  onUpload?: (id: string) => void
  className?: string
  children?: React.ReactNode
}) {
  const singleInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || [])
      if (selectedFiles.length === 0) return

      try {
        setIsUploading(true)
        setShowModal(false)
        const id = await addUploadedSongs(selectedFiles)
        if (onUpload) {
          onUpload(id)
        }
      } catch (error) {
        console.error('Failed to upload MIDI:', error)
        alert('Failed to upload MIDI files')
      } finally {
        setIsUploading(false)
        e.target.value = ''
      }
    },
    [onUpload],
  )

  const handleSingleClick = useCallback(() => {
    singleInputRef.current?.click()
  }, [])

  const handleFolderClick = useCallback(() => {
    folderInputRef.current?.click()
  }, [])

  const modal = showModal
    ? createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-80 max-w-[90vw] rounded-2xl border border-[#3a3a3a] bg-[#1e1e1e] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#e5e2e1]">Upload MIDI</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-[#e5e2e1]/50 transition-colors hover:text-[#e5e2e1]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleSingleClick}
                className="flex w-full cursor-pointer items-center gap-4 rounded-xl border border-[#3a3a3a] bg-[#292929] px-5 py-4 text-left text-[#e5e2e1] transition-all hover:border-[#a078ff]/40 hover:bg-[#a078ff]/20"
              >
                <FileMusic className="h-6 w-6 flex-shrink-0 text-[#d0bcff]" />
                <div>
                  <div className="font-medium">Single MIDI File</div>
                  <div className="mt-0.5 text-xs text-[#cbc3d7]/60">Upload one .mid file</div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleFolderClick}
                className="flex w-full cursor-pointer items-center gap-4 rounded-xl border border-[#3a3a3a] bg-[#292929] px-5 py-4 text-left text-[#e5e2e1] transition-all hover:border-[#a078ff]/40 hover:bg-[#a078ff]/20"
              >
                <FolderOpen className="h-6 w-6 flex-shrink-0 text-[#d0bcff]" />
                <div>
                  <div className="font-medium">MIDI Folder</div>
                  <div className="mt-0.5 text-xs text-[#cbc3d7]/60">
                    Upload a folder of .mid files
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      {/* Hidden file inputs — always in DOM, never removed */}
      <input
        type="file"
        accept=".mid,.midi,audio/midi,audio/x-midi"
        ref={singleInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <input
        type="file"
        accept=".mid,.midi,audio/midi,audio/x-midi"
        multiple
        ref={folderInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Main upload button */}
      <button
        type="button"
        onClick={() => setShowModal(true)}
        disabled={isUploading}
        className={className}
      >
        {children ? (
          children
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            {isUploading ? 'Uploading...' : 'Upload MIDI'}
          </>
        )}
      </button>

      {/* Portal modal */}
      {modal}
    </>
  )
}
