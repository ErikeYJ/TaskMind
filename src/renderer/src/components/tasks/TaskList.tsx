import { useEffect, useState } from 'react'
import {
  CalendarDays,
  Check,
  CheckSquare,
  Inbox,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2
} from 'lucide-react'
import type { Task, TaskAction, TaskView } from '@shared/types'
import { VIEW_SUBTITLES } from '@shared/constants'
import { canPerformAction } from '@shared/status'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { TaskCard } from './TaskCard'
import { useTaskStore } from '../../stores/taskStore'
import { toastError, toastInfo, toastSuccess, toastUndo } from '../../stores/toastStore'
import { getErrorMessage } from '../../lib/utils'

const emptyContent: Record<
  TaskView,
  { icon: React.JSX.Element; title: string; description: string }
> = {
  today: {
    icon: <CalendarDays className="h-7 w-7" />,
    title: '今天没有要开始的任务',
    description: '添加一个任务，或者去「未完成」看看后面的安排。'
  },
  all_open: {
    icon: <Inbox className="h-7 w-7" />,
    title: '所有任务都清空了',
    description: '现在没有没做完的任务，可以休息一下。'
  },
  in_progress: {
    icon: <Play className="h-7 w-7" />,
    title: '还没有进行中的任务',
    description: '在任务上点「开始」，它就会出现在这里。'
  },
  completed: {
    icon: <Check className="h-7 w-7" />,
    title: '还没有完成记录',
    description: '完成任务后，会在这里留下记录，也可以随时还原。'
  },
  suspended: {
    icon: <Pause className="h-7 w-7" />,
    title: '没有挂起的任务',
    description: '暂时不做的任务可以挂起，不会出现在浮球和提醒里。'
  }
}

function SkeletonCard(): React.JSX.Element {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 pl-5 shadow-[var(--shadow-soft)]">
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-2/5 rounded bg-[var(--surface-hover)]" />
        <div className="h-3 w-4/5 rounded bg-[var(--surface-hover)]" />
        <div className="flex gap-2">
          <div className="h-5 w-14 rounded-full bg-[var(--surface-hover)]" />
          <div className="h-5 w-16 rounded-full bg-[var(--surface-hover)]" />
        </div>
      </div>
    </div>
  )
}

interface TaskListProps {
  tasks: Task[]
  view: TaskView
  loading: boolean
  error: string | null
  onOpen: (id: string) => void
}

export function TaskList({
  tasks,
  view,
  loading,
  error,
  onOpen
}: TaskListProps): React.JSX.Element {
  const openAdd = useTaskStore((state) => state.openAdd)
  const load = useTaskStore((state) => state.load)
  const projects = useTaskStore((state) => state.projects)

  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchBusy, setBatchBusy] = useState(false)
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false)

  useEffect(() => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }, [view])

  useEffect(() => {
    setSelectedIds((current) => {
      if (current.size === 0) return current
      const available = new Set(tasks.map((task) => task.id))
      const next = new Set(Array.from(current).filter((id) => available.has(id)))
      return next.size === current.size ? current : next
    })
  }, [tasks])

  if (loading) {
    return (
      <div className="space-y-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-8 py-16 text-center">
        <p className="text-sm font-medium text-[var(--fg)]">读取任务失败</p>
        <p className="mt-1 max-w-md text-xs leading-5 text-[var(--muted)]">{error}</p>
        <Button className="mt-4" size="sm" onClick={() => void load()}>
          重新加载
        </Button>
      </div>
    )
  }

  if (tasks.length === 0) {
    const empty = emptyContent[view]
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-8 py-20 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
          {empty.icon}
        </div>
        <h2 className="text-base font-semibold text-[var(--fg)]">{empty.title}</h2>
        <p className="mt-1.5 max-w-md text-sm leading-6 text-[var(--muted)]">
          {empty.description}
        </p>
        <Button className="mt-5" variant="soft" onClick={() => openAdd()}>
          <Plus className="h-4 w-4" />
          添加任务
        </Button>
        <p className="mt-3 text-[11px] text-[var(--muted)]">{VIEW_SUBTITLES[view]}</p>
      </div>
    )
  }

  const selectedTasks = tasks.filter((task) => selectedIds.has(task.id))
  const selectedCount = selectedTasks.length
  const canComplete = selectedTasks.some((task) => canPerformAction(task.status, 'complete'))
  const canSuspend = selectedTasks.some((task) => canPerformAction(task.status, 'suspend'))
  const canResume = selectedTasks.some((task) => canPerformAction(task.status, 'resume'))

  const toggleSelectionMode = (): void => {
    setSelectionMode((current) => {
      if (current) setSelectedIds(new Set())
      return !current
    })
  }

  const toggleSelect = (id: string): void => {
    setSelectionMode(true)
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const clearSelection = (): void => {
    setSelectedIds(new Set())
    setSelectionMode(false)
  }

  const runBatchAction = async (action: TaskAction): Promise<void> => {
    if (selectedIds.size === 0 || batchBusy) return
    setBatchBusy(true)
    try {
      const result = await window.taskmind.tasks.batchTransition(
        Array.from(selectedIds),
        action
      )
      if (result.updated > 0) {
        toastSuccess(
          result.skipped > 0
            ? `已更新 ${result.updated} 个任务，跳过 ${result.skipped} 个`
            : `已更新 ${result.updated} 个任务`
        )
      } else {
        toastInfo('没有符合条件、可以更新的任务')
      }
      clearSelection()
    } catch (err) {
      toastError(getErrorMessage(err, '批量操作失败'))
    } finally {
      setBatchBusy(false)
    }
  }

  const moveSelected = async (value: string): Promise<void> => {
    if (!value || selectedIds.size === 0 || batchBusy) return
    setBatchBusy(true)
    try {
      const projectId = value === '__none__' ? null : value
      const result = await window.taskmind.tasks.batchSetProject(
        Array.from(selectedIds),
        projectId
      )
      toastSuccess(
        result.skipped > 0
          ? `已移动 ${result.updated} 个任务，跳过 ${result.skipped} 个`
          : `已移动 ${result.updated} 个任务`
      )
      clearSelection()
    } catch (err) {
      toastError(getErrorMessage(err, '批量移动失败'))
    } finally {
      setBatchBusy(false)
    }
  }

  const deleteSelected = async (): Promise<void> => {
    if (selectedIds.size === 0 || batchBusy) return
    setBatchBusy(true)
    try {
      const result = await window.taskmind.tasks.batchDelete(Array.from(selectedIds))
      setConfirmBatchDelete(false)
      clearSelection()
      if (result.deleted === 0) {
        toastInfo('没有可删除的任务')
        return
      }
      if (result.undoTokens.length === 0) {
        toastSuccess(`已删除 ${result.deleted} 个任务`)
        return
      }
      toastUndo(`已删除 ${result.deleted} 个任务`, async () => {
        try {
          const outcomes = await Promise.all(
            result.undoTokens.map((token) => window.taskmind.undo.restore(token))
          )
          await useTaskStore.getState().refreshAfterChange()
          if (outcomes.every((outcome) => outcome.ok)) {
            toastSuccess(`已恢复 ${result.deleted} 个任务`)
          } else {
            toastError('部分任务恢复失败，可能已超过撤销时间')
          }
        } catch (err) {
          toastError(getErrorMessage(err, '撤销批量删除失败'))
        }
      })
    } catch (err) {
      toastError(getErrorMessage(err, '批量删除失败'))
    } finally {
      setBatchBusy(false)
    }
  }

  return (
    <>
      <div className="mb-2 flex items-center justify-end gap-2">
        {selectionMode ? (
          <>
            <span className="text-[11px] text-[var(--muted)]">已选 {selectedCount} 项</span>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setSelectedIds(new Set(tasks.map((task) => task.id)))}
              disabled={batchBusy}
            >
              全选
            </Button>
          </>
        ) : null}
        <Button
          size="xs"
          variant={selectionMode ? 'secondary' : 'ghost'}
          onClick={toggleSelectionMode}
          disabled={batchBusy}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          {selectionMode ? '退出多选' : '多选'}
        </Button>
      </div>

      {selectionMode && selectedCount > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--primary)]/25 bg-[var(--primary-soft)]/35 px-3 py-2">
          <span className="mr-1 text-xs font-medium text-[var(--fg)]">
            已选 {selectedCount} 项
          </span>
          <Button
            size="xs"
            variant="soft"
            disabled={batchBusy || !canComplete}
            onClick={() => void runBatchAction('complete')}
          >
            <Check className="h-3 w-3" />
            完成
          </Button>
          <Button
            size="xs"
            variant="secondary"
            disabled={batchBusy || !canSuspend}
            onClick={() => void runBatchAction('suspend')}
          >
            <Pause className="h-3 w-3" />
            挂起
          </Button>
          <Button
            size="xs"
            variant="secondary"
            disabled={batchBusy || !canResume}
            onClick={() => void runBatchAction('resume')}
          >
            <RotateCcw className="h-3 w-3" />
            恢复
          </Button>
          <select
            className="h-7 max-w-[150px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-[11px] text-[var(--fg)] outline-none focus:border-[var(--primary)] disabled:opacity-50"
            value=""
            onChange={(event) => void moveSelected(event.target.value)}
            disabled={batchBusy}
            aria-label="批量移动到项目"
          >
            <option value="">移动到项目…</option>
            <option value="__none__">不关联项目</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <Button
            size="xs"
            variant="ghost"
            className="text-[var(--danger)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
            disabled={batchBusy}
            onClick={() => setConfirmBatchDelete(true)}
          >
            <Trash2 className="h-3 w-3" />
            删除
          </Button>
          <Button size="xs" variant="ghost" disabled={batchBusy} onClick={clearSelection}>
            取消选择
          </Button>
        </div>
      ) : null}

      <div className="space-y-3">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onOpen={onOpen}
            selectionMode={selectionMode}
            selected={selectedIds.has(task.id)}
            onToggleSelect={toggleSelect}
          />
        ))}
      </div>

      <ConfirmDialog
        open={confirmBatchDelete}
        title={`删除选中的 ${selectedCount} 个任务？`}
        description="任务和所有截图会一起删除，可在 10 秒内撤销。"
        confirmLabel="删除任务"
        danger
        loading={batchBusy}
        onOpenChange={(next) => {
          if (!next) setConfirmBatchDelete(false)
        }}
        onConfirm={() => void deleteSelected()}
      />
    </>
  )
}
