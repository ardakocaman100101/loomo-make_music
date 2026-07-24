import { addUploadedSongs } from '@/features/persist/persistence'
import { Upload, FileMusic, FolderOpen, X } from 'lucide-react'
import { useRef, useState, useCallback } from 'react'
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

    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    }, [onUpload])

    const handleSingleClick = useCallback(() => {
        singleInputRef.current?.click()
    }, [])

    const handleFolderClick = useCallback(() => {
        folderInputRef.current?.click()
    }, [])

    const modal = showModal ? createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowModal(false)}
        >
            <div
                className="bg-[#1e1e1e] border border-[#3a3a3a] rounded-2xl shadow-2xl p-6 w-80 max-w-[90vw]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-[#e5e2e1]">Upload MIDI</h3>
                    <button
                        type="button"
                        onClick={() => setShowModal(false)}
                        className="text-[#e5e2e1]/50 hover:text-[#e5e2e1] transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        type="button"
                        onClick={handleSingleClick}
                        className="flex items-center gap-4 w-full text-left px-5 py-4 rounded-xl bg-[#292929] hover:bg-[#a078ff]/20 border border-[#3a3a3a] hover:border-[#a078ff]/40 transition-all text-[#e5e2e1] cursor-pointer"
                    >
                        <FileMusic className="w-6 h-6 text-[#d0bcff] flex-shrink-0" />
                        <div>
                            <div className="font-medium">Single MIDI File</div>
                            <div className="text-xs text-[#cbc3d7]/60 mt-0.5">Upload one .mid file</div>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={handleFolderClick}
                        className="flex items-center gap-4 w-full text-left px-5 py-4 rounded-xl bg-[#292929] hover:bg-[#a078ff]/20 border border-[#3a3a3a] hover:border-[#a078ff]/40 transition-all text-[#e5e2e1] cursor-pointer"
                    >
                        <FolderOpen className="w-6 h-6 text-[#d0bcff] flex-shrink-0" />
                        <div>
                            <div className="font-medium">MIDI Folder</div>
                            <div className="text-xs text-[#cbc3d7]/60 mt-0.5">Upload a folder of .mid files</div>
                        </div>
                    </button>
                </div>
            </div>
        </div>,
        document.body
    ) : null

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
                {children ? children : (
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
