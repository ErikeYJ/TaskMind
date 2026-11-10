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
import {
  AI_FIELD_LABELS,
  AI_FORM_FIELDS,
  applyAiOverride,
  isAiFormField,
  mergeAiIntoForm,
  type AiEditedFields,
  type AiFormField
} from '@shared/aiDraft'
import { getTodayString } from '@shared/date'
import { defaultViewForTask } from '@shared/status'
import type { AiTaskExtraction, CreateTaskInput } from '@shared/types'
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
  const [aiState, setAiState] = useState<AiState>('idle')
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiSkippedFields, setAiSkippedFields] = useState<AiFormField[]>([])
  const [pendingAi, setPendingAi] = useState<AiTaskExtraction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const didInitRef = useRef(false)
  const imagesRef = useRef<AddImage[]>([])
  const userEditedFields = useRef<AiEditedFields>({})
  const aiTimer = useRef<number | null>(null)
  const aiGeneration = useRef(0)

  useEffect(() => {
    imagesRef.current = images
  }, [images])

  const clearAiTimer = (): void => {
    if (aiTimer.current !== null) {
      window.clearTimeout(aiTimer.current)
      aiTimer.current = null
    }
  }

  const runAiForImages = async (
    nextImages: AddImage[],
    generation: number
  ): Promise<void> => {
    if (generation !== aiGeneration.current) return
    if (nextImages.length === 0) {
      setAiState('idle')
      setAiError(null)
      setAiSkippedFields([])
      setPendingAi(null)
      return
    }

    setAiSkippedFields([])
    setPendingAi(null)

    if (!useSettingsStore.getState().settings?.hasApiKey) {
      setAiState('error')
      setAiError('还没有配置 AI Key。请先到设置里填写 Key，再回来重新识别；也可以直接手动填写。')
      return
    }

    setAiState('loading')
    setAiError(null)
    try {
      const result = await window.taskmind.ai.extract(
        nextImages.map((image) => image.dataUrl)
      )
      if (generation !== aiGeneration.current) return
      if (!result.ok) {
        setAiState('error')
        setAiError(result.error.message)
        return
      }

      const editedSnapshot = { ...userEditedFields.current }
      setForm((current) => mergeAiIntoForm(current, result.data, editedSnapshot).next)
      setAiSkippedFields(AI_FORM_FIELDS.filter((field) => Boolean(editedSnapshot[field])))
      setPendingAi(result.data)
      setAiState('done')
    } catch (err) {
      if (generation !== aiGeneration.current) return
      setAiState('error')
      setAiError(getErrorMessage(err, 'AI 识别失败'))
    }
  }

  const scheduleAi = (nextImages: AddImage[], delay = 450): void => {
    clearAiTimer()
    aiGeneration.current += 1
    const generation = aiGeneration.current
    if (nextImages.length === 0) {
      setAiState('idle')
      setAiError(null)
      setAiSkippedFields([])
      setPendingAi(null)
      return
    }
    aiTimer.current = window.setTimeout(() => {
      aiTimer.current = null
      void runAiForImages(nextImages, generation)
    }, delay)
  }

  const handleFormChange = (patch: Partial<TaskFormValue>): void => {
    const edited = Object.keys(patch).filter(isAiFormField)
    if (edited.length > 0) {
      const next = { ...userEditedFields.current }
      for (const field of edited) next[field] = true
      userEditedFields.current = next
    }
    setForm((current) => ({ ...current, ...patch }))
  }

  const applyPendingAi = (): void => {
    if (!pendingAi) return
    const data = pendingAi
    setForm((current) => applyAiOverride(current, data))
    userEditedFields.current = {}
    setAiSkippedFields([])
    setPendingAi(null)
  }

  const replaceImages = (nextImages: AddImage[]): void => {
    imagesRef.current = nextImages
    setImages(nextImages)
    scheduleAi(nextImages)
  }

  const handleFiles = async (files: File[]): Promise<void> => {
    if (files.length === 0) return
    const currentImages = imagesRef.current
    const remaining = 12 - currentImages.length
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
    replaceImages([...currentImages, ...added].slice(0, 12))
  }

  useEffect(() => {
    if (!addOpen) {
      didInitRef.current = false
      clearAiTimer()
      aiGeneration.current += 1
      return
    }
    if (didInitRef.current) return
    didInitRef.current = true
    clearAiTimer()
    aiGeneration.current += 1
    setForm({
      ...EMPTY_TASK_FORM,
      projectId: useTaskStore.getState().projectFilterId ?? ''
    })
    setImages([])
    imagesRef.current = []
    userEditedFields.current = {}
    setAiState('idle')
    setAiError(null)
    setAiSkippedFields([])
    setPendingAi(null)
    setError(null)
    setSaving(false)
    if (initialImages.length > 0) {
      const initial = initialImages.map((dataUrl) => ({ dataUrl }))
      imagesRef.current = initial
      setImages(initial)
      scheduleAi(initial)
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

  useEffect(() => {
    return () => {
      clearAiTimer()
      aiGeneration.current += 1
    }
  }, [])

  if (!addOpen) return null

  const removeImage = (index: number): void => {
    const next = imagesRef.current.filter((_, itemIndex) => itemIndex !== index)
    replaceImages(next)
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
      projectId: form.projectId || null,
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

  const retryAi = (): void => {
    if (images.length === 0) return
    clearAiTimer()
    aiGeneration.current += 1
    const generation = aiGeneration.current
    void runAiForImages(images, generation)
  }

  const aiStatus = (): React.JSX.Element => {
    if (aiState === 'loading') {
      return (
        <div className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5 text-xs text-[var(--muted)]">
          <Loader2 className="mt-0.5 h-3.5 w-3.5 animate-spin text-[var(--primary)]" />
          <span>
            AI 正在综合分析 {images.length} 张截图；你手动改过的字段会保留。
          </span>
        </div>
      )
    }
    if (aiState === 'done') {
      return (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <span>
              AI 已结合 {images.length} 张截图填写，请检查后再添加。
            </span>
            {aiSkippedFields.length > 0 && pendingAi ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                  已保留手改字段：{aiSkippedFields.map((field) => AI_FIELD_LABELS[field]).join('、')}
                </span>
                <button
                  type="button"
                  className="rounded-md bg-white/70 px-2 py-0.5 text-[11px] font-medium underline-offset-2 transition-colors hover:bg-white hover:underline dark:bg-black/20 dark:hover:bg-black/30"
                  onClick={applyPendingAi}
                  title="用本次 AI 结果覆盖你手动修改的字段"
                >
                  覆盖手改字段
                </button>
              </div>
            ) : null}
          </div>
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
            onClick={retryAi}
            disabled={images.length === 0}
          >
            <RefreshCw className="h-3 w-3" />
            重试识别全部
          </button>
        </div>
      )
    }
    if (images.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2.5 text-xs leading-5 text-[var(--muted)]">
          先粘贴一张或多张微信截图。AI 会综合所有截图识别任务名称、内容、时间，并写好备注；你手动修改过的字段不会被后续识别覆盖。
        </div>
      )
    }
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5 text-xs text-[var(--muted)]">
        已附加 {images.length} 张截图，AI 会综合识别全部内容，并保留你的手动修改。
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
                粘贴一张或多张微信截图让 AI 帮你填，也可以直接手动写。
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
                  onChange={handleFormChange}
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
                    可一次粘贴多张，也可以拖入图片或点击选择文件
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
                        className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]"
                      >
                        <img src={image.dataUrl} alt="" className="h-full w-full object-cover" />
                        <span className="absolute left-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-black/50 px-1 text-[9px] font-semibold text-white">
                          {index + 1}
                        </span>
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
                      新增或删除截图后，会自动重新综合识别
                    </span>
                    <Button
                      size="xs"
                      variant="secondary"
                      loading={aiState === 'loading'}
                      disabled={images.length === 0 || aiState === 'loading'}
                      onClick={retryAi}
                    >
                      <RefreshCw className="h-3 w-3" />
                      重新识别全部
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
                  ? 'AI 会综合所有截图，结果只作为草稿，保存前请检查。'
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
