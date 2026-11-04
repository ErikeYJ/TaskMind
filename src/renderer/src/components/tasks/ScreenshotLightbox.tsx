import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ChevronLeft, ChevronRight, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react'
import type { ScreenshotMeta } from '@shared/types'

interface ScreenshotLightboxProps {
  images: ScreenshotMeta[]
  index: number
  onClose: () => void
  onIndexChange: (index: number) => void
}

export function ScreenshotLightbox({
  images,
  index,
  onClose,
  onIndexChange
}: ScreenshotLightboxProps): React.JSX.Element | null {
  const [zoom, setZoom] = useState(1)
  const current = images[index]

  useEffect(() => {
    setZoom(1)
  }, [index])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'ArrowLeft') {
        onIndexChange((index - 1 + images.length) % images.length)
      }
      if (event.key === 'ArrowRight') {
        onIndexChange((index + 1) % images.length)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [images.length, index, onIndexChange])

  if (!current) return null

  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[180] animate-fade-in bg-black/90 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed inset-0 z-[190] flex flex-col outline-none"
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
        >
          <Dialog.Title className="sr-only">截图预览</Dialog.Title>
          <Dialog.Description className="sr-only">
            使用左右方向键切换截图，按 Esc 关闭。
          </Dialog.Description>

          <div
            className="flex h-14 shrink-0 items-center justify-between px-5 text-white/90"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-xs text-white/60">
              <span className="rounded-full bg-white/10 px-2 py-0.5">
                {index + 1} / {images.length}
              </span>
              <span>截图预览</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                onClick={() => setZoom((value) => Math.max(1, value - 0.5))}
                title="缩小"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="w-10 text-center text-xs tabular-nums text-white/60">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                onClick={() => setZoom((value) => Math.min(3, value + 0.5))}
                title="放大"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                onClick={() => setZoom(1)}
                title="重置缩放"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="ml-1 flex h-9 w-9 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                onClick={onClose}
                title="关闭"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-6"
            onClick={(event) => {
              if (event.target === event.currentTarget) onClose()
            }}
          >
            <div
              className="m-auto flex min-h-full min-w-full items-center justify-center"
              onClick={(event) => event.stopPropagation()}
            >
              <img
                src={current.url}
                alt=""
                className="block rounded-lg object-contain shadow-2xl"
                style={{
                  maxWidth: `${zoom * 88}vw`,
                  maxHeight: `${zoom * 78}vh`,
                  transition: 'max-width 150ms ease, max-height 150ms ease'
                }}
                onError={(event) => {
                  if (event.currentTarget.dataset.fallback !== '1') {
                    event.currentTarget.dataset.fallback = '1'
                    event.currentTarget.src = current.thumbUrl
                  }
                }}
              />
            </div>

            {images.length > 1 ? (
              <>
                <button
                  type="button"
                  className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white/80 transition hover:bg-black/55 hover:text-white"
                  onClick={(event) => {
                    event.stopPropagation()
                    onIndexChange((index - 1 + images.length) % images.length)
                  }}
                  title="上一张"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white/80 transition hover:bg-black/55 hover:text-white"
                  onClick={(event) => {
                    event.stopPropagation()
                    onIndexChange((index + 1) % images.length)
                  }}
                  title="下一张"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
