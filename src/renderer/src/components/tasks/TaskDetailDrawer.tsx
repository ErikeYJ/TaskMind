import { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  CalendarDays,
  Check,
  Image as ImageIcon,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  UserRound,
  X
} from 'lucide-react'
import { ACTION_LABELS } from '@shared/constants'
import { formatTimestamp } from '@shared/date'
import type { ScreenshotMeta, TaskAction, TaskStatus } from '@shared/types'
import { useTaskStore } from '../../stores/taskStore'
import { toastError } from '../../stores/toastStore'
import { filesToDataUrls, getErrorMessage, imagesFromDataTransfer } from '../../lib/utils'
import {
  addScreenshot,
  deleteScreenshot,
  deleteTask,
  runTaskAction,
  updateTask
} from '../../lib/taskActions'
import {
  EMPTY_TASK_FORM,
  TaskFields,
  taskToForm,
  type TaskFormValue
} from './TaskFields'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { DueBadge, StatusBadge } from '../ui/Badges'
import { ScreenshotLightbox } from './ScreenshotLightbox'

interface ActionSpec {
  action: TaskAction
  label: string
  icon: React.JSX.Element
  variant: 'primary' | 'secondary' | 'soft'
}

function actionsForStatus(status: TaskStatus): ActionSpec[] {
  if (status === 'todo') {
    return [
      { action: 'start', label: ACTION_LABELS.start, icon: <Play className="h-3.5 w-3.5" />, variant: 'primary' },
      { action: 'suspend', label: ACTION_LABELS.suspend, icon: <Pause className="h-3.5 w-3.5" />, variant: 'secondary' },
      { action: 'complete', label: ACTION_LABELS.complete, icon: <Check className="h-3.5 w-3.5" />, variant: 'secondary' }
    ]
  }
  if (status === 'in_progress') {
    return [
      { action: 'complete', label: ACTION_LABELS.complete, icon: <Check className="h-3.5 w-3.5" />, variant: 'primary' },
      { action: 'suspend', label: ACTION_LABELS.suspend, icon: <Pause className="h-3.5 w-3.5" />, variant: 'secondary' }
    ]
  }
  if (status === 'suspended') {
    return [
      { action: 'resume', label: ACTION_LABELS.resume, icon: <RotateCcw className="h-3.5 w-3.5" />, variant: 'primary' },
      { action: 'complete', label: ACTION_LABELS.complete, icon: <Check className="h-3.5 w-3.5" />, variant: 'secondary' }
    ]
  }
  return [
    { action: 'restore', label: ACTION_LABELS.restore, icon: <RotateCcw className="h-3.5 w-3.5" />, variant: 'primary' }
  ]
}

function Field({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-1 text-[13px] leading-5 text-[var(--fg)]">{children}</div>
    </div>
  )
}

export function TaskDetailDrawer(): React.JSX.Element {
  const open = useTaskStore((state) => state.detailOpen)
  const task = useTaskStore((state) => state.detailTask)
  const closeDetail = useTaskStore((state) => state.closeDetail)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<TaskFormValue>(EMPTY_TASK_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyAction, setBusyAction] = useState<TaskAction | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmScreenshot, setConfirmScreenshot] = useState<ScreenshotMeta | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (task) {
      setForm(taskToForm(task))
      setFormError(null)
    }
    setEditing(false)
  }, [task?.id])

  useEffect(() => {
    if (!open) {
      setEditing(false)
      setLightboxIndex(null)
      setConfirmDelete(false)
      setConfirmScreenshot(null)
    }
  }, [open])

  if (!task) return <></>

  const startEditing = (): void => {
    setForm(taskToForm(task))
    setFormError(null)
    setEditing(true)
  }

  const cancelEditing = (): void => {
    setForm(taskToForm(task))
    setFormError(null)
    setEditing(false)
  }

  const save = async (): Promise<void> => {
    if (!form.title.trim()) {
      setFormError('任务名称不能为空')
      return
    }
    setSaving(true)
    setFormError(null)
    const updated = await updateTask(task.id, {
      title: form.title.trim(),
      client: form.client.trim() || null,
      content: form.content,
      notes: form.notes,
      dueDate: form.dueDate || null,
      dueTime: form.dueTime || null
    })
    setSaving(false)
    if (updated) {
      setForm(taskToForm(updated))
      setEditing(false)
    }
  }

  const handleAction = async (action: TaskAction): Promise<void> => {
    setBusyAction(action)
    await runTaskAction(task.id, action)
    setBusyAction(null)
  }

  const handleFiles = async (files: File[]): Promise<void> => {
    if (files.length === 0) return
    const remaining = 12 - task.screenshots.length
    if (remaining <= 0) {
      toastError('每个任务最多 12 张截图')
      return
    }
    const dataUrls = await filesToDataUrls(files.slice(0, remaining))
    setUploading(true)
    for (const dataUrl of dataUrls) {
      const ok = await addScreenshot(task.id, dataUrl)
      if (!ok) break
    }
    setUploading(false)
  }

  const handleDrop = (event: React.DragEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    void handleFiles(imagesFromDataTransfer(event.dataTransfer))
  }

  const removeScreenshot = async (): Promise<void> => {
    if (!confirmScreenshot) return
    await deleteScreenshot(confirmScreenshot.id)
    setConfirmScreenshot(null)
  }

  const confirmDeleteTask = async (): Promise<void> => {
    const ok = await deleteTask(task.id)
    if (ok) {
      setConfirmDelete(false)
      closeDetail()
    }
  }

  const actions = actionsForStatus(task.status)
  const canEdit = !editing

  return (
    <>
      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          if (!next) closeDetail()
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay fixed inset-0 z-40 animate-fade-in" />
          <Dialog.Content
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[600px] flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-2xl animate-slide-in"
            onDrop={handleDrop}
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes('Files')) event.preventDefault()
            }}
          >
            <Dialog.Title className="sr-only">{task.title}</Dialog.Title>
            <Dialog.Description className="sr-only">任务详情</Dialog.Description>

            <div className="shrink-0 border-b border-[var(--border)] px-6 pb-4 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={task.status} />
                    <DueBadge task={task} />
                    {task.client ? (
                      <span className="inline-flex max-w-[260px] items-center gap-1 rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[11px] text-[var(--muted)]">
                        <UserRound className="h-3 w-3 shrink-0" />
                        <span className="truncate">{task.client}</span>
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-2 break-words pr-2 text-[20px] font-semibold leading-8 tracking-tight text-[var(--fg)]">
                    {task.title}
                  </h2>
                </div>
                <Dialog.Close asChild>
                  <Button variant="ghost" size="icon" title="关闭">
                    <X className="h-5 w-5" />
                  </Button>
                </Dialog.Close>
              </div>

              {!editing ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {actions.map((item) => (
                    <Button
                      key={item.action}
                      size="sm"
                      variant={item.variant}
                      loading={busyAction === item.action}
                      disabled={Boolean(busyAction)}
                      onClick={() => void handleAction(item.action)}
                    >
                      {item.icon}
                      {item.label}
                    </Button>
                  ))}
                  <span className="mx-1 h-5 w-px bg-[var(--border)]" />
                  <Button size="sm" variant="ghost" onClick={startEditing} disabled={!canEdit}>
                    <Pencil className="h-3.5 w-3.5" />
                    编辑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-[var(--danger)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {editing ? (
                <div className="space-y-4">
                  <TaskFields
                    value={form}
                    onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
                    disabled={saving}
                    autoFocus
                    compact
                  />
                  {formError ? (
                    <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]">
                      {formError}
                    </p>
                  ) : null}
                  <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
                    <Button variant="ghost" size="md" onClick={cancelEditing} disabled={saving}>
                      取消
                    </Button>
                    <Button variant="primary" size="md" loading={saving} onClick={() => void save()}>
                      保存修改
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                    <Field label="客户 / 来源">{task.client || '—'}</Field>
                    <Field label="截止">
                      <DueBadge task={task} showIcon={false} />
                    </Field>
                    <Field label="创建时间">{formatTimestamp(task.createdAt) || '—'}</Field>
                    <Field label="开始时间">{formatTimestamp(task.startedAt) || '—'}</Field>
                    <Field label="挂起时间">{formatTimestamp(task.suspendedAt) || '—'}</Field>
                    <Field label="完成时间">{formatTimestamp(task.completedAt) || '—'}</Field>
                  </div>

                  <section>
                    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      任务内容
                    </h3>
                    <div className="whitespace-pre-wrap break-words rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-6 text-[var(--fg)]">
                      {task.content || '没有填写任务内容'}
                    </div>
                  </section>

                  {task.notes ? (
                    <section>
                      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                        备注
                      </h3>
                      <div className="whitespace-pre-wrap break-words rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 text-sm leading-6 text-[var(--fg)]">
                        {task.notes}
                      </div>
                    </section>
                  ) : null}

                  <section>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                        <ImageIcon className="h-3.5 w-3.5" />
                        截图 {task.screenshots.length > 0 ? `(${task.screenshots.length})` : ''}
                      </h3>
                      <Button
                        size="xs"
                        variant="secondary"
                        loading={uploading}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Plus className="h-3 w-3" />
                        添加截图
                      </Button>
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
                    </div>

                    {task.screenshots.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {task.screenshots.map((shot, index) => (
                          <div
                            key={shot.id}
                            className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]"
                          >
                            <button
                              type="button"
                              className="h-full w-full"
                              onClick={() => setLightboxIndex(index)}
                              title="查看大图"
                            >
                              <img
                                src={shot.thumbUrl}
                                alt=""
                                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                                onError={(event) => {
                                  if (event.currentTarget.dataset.fallback !== '1') {
                                    event.currentTarget.dataset.fallback = '1'
                                    event.currentTarget.src = shot.url
                                  }
                                }}
                              />
                            </button>
                            <button
                              type="button"
                              className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-black/45 text-white/85 opacity-0 transition-opacity hover:bg-black/65 group-hover:opacity-100"
                              onClick={() => setConfirmScreenshot(shot)}
                              title="删除截图"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-8 text-center transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]/30"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <ImageIcon className="mb-2 h-6 w-6 text-[var(--muted)]" />
                        <span className="text-xs font-medium text-[var(--fg)]">
                          点击添加截图
                        </span>
                        <span className="mt-1 text-[11px] text-[var(--muted)]">
                          也可以直接 Ctrl+V 粘贴微信截图
                        </span>
                      </button>
                    )}
                    {task.screenshots.length > 0 ? (
                      <p className="mt-2 text-[11px] text-[var(--muted)]">
                        按 Ctrl+V 可以继续追加截图。
                      </p>
                    ) : null}
                  </section>

                  <section>
                    <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      <CalendarDays className="h-3.5 w-3.5" />
                      时间记录
                    </h3>
                    <div className="space-y-1.5 rounded-xl border border-[var(--border)] p-4 text-xs text-[var(--muted)]">
                      <div>创建：{formatTimestamp(task.createdAt) || '—'}</div>
                      {task.startedAt ? <div>开始：{formatTimestamp(task.startedAt)}</div> : null}
                      {task.suspendedAt ? (
                        <div>挂起：{formatTimestamp(task.suspendedAt)}</div>
                      ) : null}
                      {task.completedAt ? (
                        <div>完成：{formatTimestamp(task.completedAt)}</div>
                      ) : null}
                    </div>
                  </section>
                </div>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ConfirmDialog
        open={confirmDelete}
        title="删除这个任务？"
        description="任务内容和所有截图会一起删除，且无法恢复。"
        confirmLabel="删除"
        danger
        onOpenChange={setConfirmDelete}
        onConfirm={() => void confirmDeleteTask()}
      />

      <ConfirmDialog
        open={Boolean(confirmScreenshot)}
        title="删除这张截图？"
        description="截图文件会从本地删除，无法恢复。"
        confirmLabel="删除"
        danger
        onOpenChange={(next) => {
          if (!next) setConfirmScreenshot(null)
        }}
        onConfirm={() => void removeScreenshot()}
      />

      {lightboxIndex !== null && task.screenshots[lightboxIndex] ? (
        <ScreenshotLightbox
          images={task.screenshots}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      ) : null}
    </>
  )
}
