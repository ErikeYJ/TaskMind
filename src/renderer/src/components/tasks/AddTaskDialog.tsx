import { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  AlertTriangle,
  Clipboard,
  ImagePlus,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  X
} from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { getTodayString } from '@shared/date'
import { defaultViewForTask } from '@shared/status'
import type { CreateTaskInput } from '@shared/types'
import { useSettingsStore } from '../../stores/settingsStore'
import { useTaskStore } from '../../stores/taskStore'
import { toastError, toastSuccess } from '../../stores/toastStore'
import {
  filesToDataUrls,
  getErrorMessage,
  imagesFromClipboard,
  imagesFromDataTransfer
} from '../../lib/utils'
import { Button } from '../ui/Button'
import { EMPTY_TASK_FORM, TaskFields, type TaskFormValue } from './TaskFields'
import { cn } from '../../lib/utils'

interface AddImage {
  dataUrl: string
  fileName?: string
}

type AiState = 'idle' | 'loading' | 'done' | 'error'

export function AddTaskDialog(): React.JSX.Element | null {
  const addOpen = useTaskStore((state) => state.addOpen)
  const initialImages = useTaskStore((state) => state.addInitialImages)
  const closeAdd = useTaskStore((state) => state.closeAdd)
  const settings = useSettingsStore((state) => state.settings)

  const [form, setForm] = useState<TaskFormValue>(EMPTY_TASK_FORM)
  const [images, setImages] = useState<AddImage[]>([])
  const [primaryIndex, setPrimaryIndex] = useState(0)
  const [aiState, setAiState] = useState<AiState>('idle')
  const [aiError, setAiError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const didInitRef = useRef(false)

  const runAiForImage = async (dataUrl: string): Promise<void> => {
    if (!useSettingsStore.getState().settings?.hasApiKey) {
      setAiState('error')
      setAiError('还没有配置 AI Key。请先到设置里填写 Key，再回来重新识别；也可以直接手动填写。')
      return
    }
    setAiState('loading')
    setAiError(null)
    try {
      const result = await window.taskmind.ai.extract(dataUrl)
      if (!result.ok) {
        setAiState('error')
        setAiError(result.error.message)
        return
      }
      setForm((current) => ({
        ...current,
        title: result.data.title || current.title,
        client: result.data.client ?? current.client,
        content: result.data.content || current.content,
        notes: result.data.notes || current.notes,
        dueDate: result.data.dueDate ?? current.dueDate,
        dueTime: result.data.dueTime ?? current.dueTime
      }))
      setAiState('done')
    } catch (err) {
      setAiState('error')
      setAiError(getErrorMessage(err, 'AI 识别失败'))
    }
  }

  const handleFiles = async (files: File[]): Promise<void> => {
    if (files.length === 0) return
    const remaining = 12 - images.length
    if (remaining <= 0) {
      toastError('每个任务最多 12 张截图')
      return
    }
    const selected = files.slice(0, remaining)
    const dataUrls = await filesToDataUrls(selected)
    const added = dataUrls.map((dataUrl, index) => ({
      dataUrl,
      fileName: selected[index]?.name
    }))
    const hadImages = images.length > 0
    setImages((current) => [...current, ...added].slice(0, 12))
    if (!hadImages && added[0]) {
      setPrimaryIndex(0)
      void runAiForImage(added[0].dataUrl)
    } else if (aiState !== 'done' && aiState !== 'loading' && added[0]) {
      setPrimaryIndex(images.length)
      void runAiForImage(added[0].dataUrl)
    }
  }

  useEffect(() => {
    if (!addOpen) {
      didInitRef.current = false
      return
    }
    if (didInitRef.current) return
    didInitRef.current = true
    setForm(EMPTY_TASK_FORM)
    setImages([])
    setPrimaryIndex(0)
    setAiState('idle')
    setAiError(null)
    setError(null)
    setSaving(false)
    if (initialImages.length > 0) {
      const initial = initialImages.map((dataUrl) => ({ dataUrl }))
      setImages(initial)
      setPrimaryIndex(0)
      void runAiForImage(initial[0].dataUrl)
    }
  }, [addOpen, initialImages])

  useEffect(() => {
    if (!addOpen) return
    const onPaste = (event: ClipboardEvent): void => {
      const files = imagesFromClipboard(event)
      if (files.length === 0) return
      event.preventDefault()
      void handleFiles(files)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [addOpen, images, aiState])

  if (!addOpen) return null

  const primary = images[primaryIndex]

  const removeImage = (index: number): void => {
    setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))
    setPrimaryIndex((current) => {
      if (index === current) return 0
      if (index < current) return current - 1
      return current
    })
  }

  const submit = async (): Promise<void> => {
    if (!form.title.trim()) {
      setError('请先填写任务名称')
      return
    }
    setSaving(true)
    setError(null)
    const input: CreateTaskInput = {
      title: form.title.trim(),
      client: form.client.trim() || null,
      content: form.content,
      notes: form.notes,
      dueDate: form.dueDate || null,
      dueTime: form.dueTime || null,
      screenshots: images.map((image) => ({
        dataUrl: image.dataUrl,
        fileName: image.fileName
      }))
    }
    try {
      const created = await window.taskmind.tasks.create(input)
      closeAdd()
      toastSuccess('任务已添加')
      await useTaskStore.getState().setView(defaultViewForTask(created, getTodayString()))
    } catch (err) {
      const message = getErrorMessage(err, '添加任务失败')
      setError(message)
      toastError(message)
    } finally {
      setSaving(false)
    }
  }

  const aiStatus = (): React.JSX.Element => {
    if (aiState === 'loading') {
      return (
        <div className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5 text-xs text-[var(--muted)]">
          <Loader2 className="mt-0.5 h-3.5 w-3.5 animate-spin text-[var(--primary)]" />
          <span>AI 正在识别截图，你可以先检查或手动修改左侧内容。</span>
        </div>
      )
    }
    if (aiState === 'done') {
      return (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300">
          <Sparkles className="mt-0.5 h-3.5 w-3.5" />
          <span>AI 已填写标题、内容和备注，请检查后再添加。</span>
        </div>
      )
    }
    if (aiState === 'error') {
      return (
        <div className="rounded-xl border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-3 py-2.5 text-xs leading-5 text-[var(--danger)]">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">{aiError}</span>
          </div>
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1 rounded-lg bg-white/60 px-2 py-1 text-[11px] font-medium transition-colors hover:bg-white/80 dark:bg-black/20 dark:hover:bg-black/30"
            onClick={() => primary && void runAiForImage(primary.dataUrl)}
            disabled={!primary}
          >
            <RefreshCw className="h-3 w-3" />
            重试识别
          </button>
        </div>
      )
    }
    if (images.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2.5 text-xs leading-5 text-[var(--muted)]">
          先粘贴一张微信截图，AI 会尝试识别任务名称、内容、时间，并写好备注。识别不准的部分都可以手动改。
        </div>
      )
    }
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5 text-xs text-[var(--muted)]">
        已附加 {images.length} 张截图。点击缩略图切换 AI 识别图，或点「重新识别」。
      </div>
    )
  }

  return (
    <Dialog.Root
      open={addOpen}
      onOpenChange={(next) => {
        if (!next && !saving) closeAdd()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-[60] animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[70] flex max-h-[90vh] w-[960px] max-w-[calc(100vw-48px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)] animate-scale-in">
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-6 py-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-[var(--fg)]">
                添加任务
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-[var(--muted)]">
                粘贴微信截图让 AI 帮你填，或者直接手动写。
              </Dialog.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" disabled={saving} title="关闭">
                <X className="h-5 w-5" />
              </Button>
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
              <div className="min-w-0">
                <TaskFields
                  value={form}
                  onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
                  disabled={saving}
                  autoFocus
                />
              </div>

              <div className="min-w-0">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-medium text-[var(--muted)]">截图</div>
                  <span className="text-[11px] text-[var(--muted)]">{images.length} / 12</span>
                </div>

                <div
                  className={cn(
                    'flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-7 text-center transition-colors',
                    dragging
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)]/60'
                      : 'border-[var(--border-strong)] bg-[var(--surface-soft)] hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]/25'
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault()
                    setDragging(false)
                    void handleFiles(imagesFromDataTransfer(event.dataTransfer))
                  }}
                >
                  <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--primary)] shadow-sm">
                    <Clipboard className="h-5 w-5" />
                  </div>
                  <div className="text-sm font-medium text-[var(--fg)]">
                    Ctrl+V 粘贴微信截图
                  </div>
                  <div className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
                    也可以拖入图片，或点击选择文件
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--primary)]">
                    <ImagePlus className="h-3 w-3" />
                    选择图片
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []).filter((file) =>
                      file.type.startsWith('image/')
                    )
                    event.target.value = ''
                    void handleFiles(files)
                  }}
                />

                {images.length > 0 ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {images.map((image, index) => (
                      <div
                        key={`${image.dataUrl.slice(0, 48)}-${index}`}
                        className={cn(
                          'group relative aspect-[4/3] overflow-hidden rounded-xl border bg-[var(--surface-soft)]',
                          index === primaryIndex
                            ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/25'
                            : 'border-[var(--border)]'
                        )}
                      >
                        <button
                          type="button"
                          className="h-full w-full"
                          onClick={() => setPrimaryIndex(index)}
                          title="设为 AI 识别图"
                        >
                          <img src={image.dataUrl} alt="" className="h-full w-full object-cover" />
                        </button>
                        {index === primaryIndex ? (
                          <span className="absolute left-1.5 top-1.5 rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--primary-fg)]">
                            AI 识别图
                          </span>
                        ) : null}
                        <button
                          type="button"
                          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-black/45 text-white/85 opacity-0 transition-opacity hover:bg-black/65 group-hover:opacity-100"
                          onClick={() => removeImage(index)}
                          title="移除截图"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3">{aiStatus()}</div>

                {images.length > 0 ? (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-[var(--muted)]">
                      点击缩略图可切换 AI 识别图
                    </span>
                    <Button
                      size="xs"
                      variant="secondary"
                      loading={aiState === 'loading'}
                      disabled={!primary || aiState === 'loading'}
                      onClick={() => primary && void runAiForImage(primary.dataUrl)}
                    >
                      <RefreshCw className="h-3 w-3" />
                      重新识别
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4">
            {error ? (
              <p className="mb-2 rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]">
                {error}
              </p>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-[var(--muted)]">
                {settings?.hasApiKey
                  ? 'AI 结果只作为草稿，保存前请检查。'
                  : '还没有配置 AI Key，依然可以手动填写。'}
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="md" disabled={saving} onClick={closeAdd}>
                  取消
                </Button>
                <Button variant="primary" size="md" loading={saving} onClick={() => void submit()}>
                  添加任务
                </Button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
