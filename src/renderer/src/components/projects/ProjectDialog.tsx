import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Check, FolderPlus, Trash2, X } from 'lucide-react'
import { DEFAULT_PROJECT_COLOR, PROJECT_COLORS } from '@shared/projects'
import { useTaskStore } from '../../stores/taskStore'
import { toastError, toastSuccess } from '../../stores/toastStore'
import { getErrorMessage } from '../../lib/utils'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { cn } from '../../lib/utils'

export function ProjectDialog(): React.JSX.Element {
  const open = useTaskStore((state) => state.projectEditorOpen)
  const editing = useTaskStore((state) => state.editingProject)
  const closeProjectEditor = useTaskStore((state) => state.closeProjectEditor)
  const loadProjects = useTaskStore((state) => state.loadProjects)
  const refreshAfterChange = useTaskStore((state) => state.refreshAfterChange)

  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(DEFAULT_PROJECT_COLOR)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(editing?.name ?? '')
    setColor(editing?.color ?? DEFAULT_PROJECT_COLOR)
    setError(null)
    setSaving(false)
    setDeleting(false)
    setConfirmDelete(false)
  }, [open, editing?.id])

  const save = async (): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('项目名称不能为空')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (editing) {
        await window.taskmind.projects.update(editing.id, { name: trimmed, color })
      } else {
        await window.taskmind.projects.create({ name: trimmed, color })
      }
      await loadProjects()
      closeProjectEditor()
      toastSuccess(editing ? '项目已保存' : '项目已创建')
    } catch (err) {
      setError(getErrorMessage(err, '保存项目失败'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (): Promise<void> => {
    if (!editing) return
    setDeleting(true)
    setError(null)
    try {
      await window.taskmind.projects.delete(editing.id)
      setConfirmDelete(false)
      closeProjectEditor()
      await loadProjects()
      await refreshAfterChange()
      toastSuccess('项目已删除，任务已保留')
    } catch (err) {
      setError(getErrorMessage(err, '删除项目失败'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          if (!next && !saving && !deleting) closeProjectEditor()
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay fixed inset-0 z-[130] animate-fade-in" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[135] w-[460px] max-w-[calc(100vw-48px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)] animate-scale-in">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                  <FolderPlus className="h-5 w-5" />
                </div>
                <div>
                  <Dialog.Title className="text-base font-semibold text-[var(--fg)]">
                    {editing ? '编辑项目' : '新建项目'}
                  </Dialog.Title>
                  <Dialog.Description className="mt-0.5 text-xs text-[var(--muted)]">
                    {editing ? '修改项目名称或颜色，不会影响任务内容。' : '用项目把相关任务归类。'}
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" title="关闭" disabled={saving || deleting}>
                  <X className="h-5 w-5" />
                </Button>
              </Dialog.Close>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div>
                <label
                  className="mb-1.5 block text-xs font-medium text-[var(--muted)]"
                  htmlFor="project-name"
                >
                  项目名称 <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  id="project-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void save()
                    }
                  }}
                  placeholder="例如：金色花园安装项目"
                  maxLength={60}
                  disabled={saving || deleting}
                  autoFocus
                  className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--fg)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-teal-500/15 disabled:opacity-50"
                />
              </div>

              <div>
                <div className="mb-2 text-xs font-medium text-[var(--muted)]">项目颜色</div>
                <div className="flex flex-wrap gap-2">
                  {PROJECT_COLORS.map((item) => {
                    const selected = color.toLowerCase() === item.toLowerCase()
                    return (
                      <button
                        key={item}
                        type="button"
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform hover:scale-105',
                          selected
                            ? 'border-[var(--fg)] shadow-sm'
                            : 'border-transparent'
                        )}
                        style={{ backgroundColor: item }}
                        onClick={() => setColor(item)}
                        title={`使用颜色 ${item}`}
                        aria-label={`使用颜色 ${item}`}
                        aria-pressed={selected}
                        disabled={saving || deleting}
                      >
                        {selected ? <Check className="h-4 w-4 text-white" /> : null}
                      </button>
                    )
                  })}
                </div>
              </div>

              {error ? (
                <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]">
                  {error}
                </p>
              ) : null}

              {editing ? (
                <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5">
                  <div className="text-[11px] leading-5 text-[var(--muted)]">
                    该项目下有 {editing.openTaskCount} 个未完成任务，共 {editing.totalTaskCount} 个。
                  </div>
                  <Button
                    size="xs"
                    variant="ghost"
                    className="shrink-0 text-[var(--danger)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                    onClick={() => setConfirmDelete(true)}
                    disabled={saving || deleting}
                  >
                    <Trash2 className="h-3 w-3" />
                    删除
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--border)] px-6 py-4">
              <Button variant="ghost" size="md" onClick={closeProjectEditor} disabled={saving || deleting}>
                取消
              </Button>
              <Button
                variant="primary"
                size="md"
                loading={saving}
                onClick={() => void save()}
                disabled={deleting}
              >
                {editing ? '保存项目' : '创建项目'}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ConfirmDialog
        open={confirmDelete}
        title="删除这个项目？"
        description={
          editing
            ? `项目「${editing.name}」下的 ${editing.totalTaskCount} 个任务会保留，但不再关联这个项目。此操作无法撤销。`
            : '项目下的任务会保留，但不再关联这个项目。'
        }
        confirmLabel="删除项目"
        danger
        loading={deleting}
        onOpenChange={(next) => {
          if (!next) setConfirmDelete(false)
        }}
        onConfirm={() => void remove()}
      />
    </>
  )
}
