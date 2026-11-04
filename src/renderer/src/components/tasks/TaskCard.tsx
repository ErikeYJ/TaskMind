import { useState } from 'react'
import {
  Check,
  Image as ImageIcon,
  Pause,
  Play,
  RotateCcw,
  UserRound
} from 'lucide-react'
import type { Task, TaskAction, TaskStatus } from '@shared/types'
import { formatShortDateTime } from '@shared/date'
import { DueBadge, StatusBadge } from '../ui/Badges'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'
import { runTaskAction } from '../../lib/taskActions'

const statusAccent: Record<TaskStatus, string> = {
  todo: 'bg-slate-300 dark:bg-slate-600',
  in_progress: 'bg-amber-400',
  suspended: 'bg-violet-400',
  done: 'bg-emerald-400'
}

interface CardAction {
  action: TaskAction
  label: string
  icon: React.JSX.Element
  primary?: boolean
}

function actionsForStatus(status: TaskStatus): CardAction[] {
  if (status === 'todo') {
    return [
      { action: 'start', label: '开始', icon: <Play className="h-3 w-3" />, primary: true },
      { action: 'suspend', label: '挂起', icon: <Pause className="h-3 w-3" /> },
      { action: 'complete', label: '完成', icon: <Check className="h-3 w-3" /> }
    ]
  }
  if (status === 'in_progress') {
    return [
      { action: 'complete', label: '完成', icon: <Check className="h-3 w-3" />, primary: true },
      { action: 'suspend', label: '挂起', icon: <Pause className="h-3 w-3" /> }
    ]
  }
  if (status === 'suspended') {
    return [
      { action: 'resume', label: '恢复', icon: <RotateCcw className="h-3 w-3" />, primary: true },
      { action: 'complete', label: '完成', icon: <Check className="h-3 w-3" /> }
    ]
  }
  return [
    { action: 'restore', label: '还原', icon: <RotateCcw className="h-3 w-3" />, primary: true }
  ]
}

interface TaskCardProps {
  task: Task
  onOpen: (id: string) => void
}

export function TaskCard({ task, onOpen }: TaskCardProps): React.JSX.Element {
  const [busyAction, setBusyAction] = useState<TaskAction | null>(null)
  const actions = actionsForStatus(task.status)

  const run = async (action: TaskAction): Promise<void> => {
    setBusyAction(action)
    await runTaskAction(task.id, action)
    setBusyAction(null)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(task.id)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(task.id)
        }
      }}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 pl-5 shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow)]',
        task.status === 'done' && 'opacity-80'
      )}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', statusAccent[task.status])} />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={cn(
                'min-w-0 truncate text-[15px] font-semibold leading-6 text-[var(--fg)]',
                task.status === 'done' && 'text-[var(--muted)] line-through'
              )}
            >
              {task.title}
            </h3>
            {task.client ? (
              <span className="inline-flex max-w-[220px] items-center gap-1 rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[11px] text-[var(--muted)]">
                <UserRound className="h-3 w-3 shrink-0" />
                <span className="truncate">{task.client}</span>
              </span>
            ) : null}
          </div>

          {task.content ? (
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-[var(--muted)]">
              {task.content}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} />
            <DueBadge task={task} />
            {task.screenshots.length > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--muted)]">
                <ImageIcon className="h-3 w-3" />
                {task.screenshots.length}
              </span>
            ) : null}
            {task.status === 'done' && task.completedAt ? (
              <span className="text-[11px] text-[var(--muted)]">
                完成于 {formatShortDateTime(task.completedAt)}
              </span>
            ) : null}
            {task.status === 'suspended' && task.suspendedAt ? (
              <span className="text-[11px] text-[var(--muted)]">
                挂起于 {formatShortDateTime(task.suspendedAt)}
              </span>
            ) : null}
          </div>
        </div>

        <div
          className="flex shrink-0 flex-wrap items-center justify-end gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          {actions.map((item) => (
            <Button
              key={item.action}
              size="sm"
              variant={item.primary ? 'soft' : 'ghost'}
              loading={busyAction === item.action}
              disabled={Boolean(busyAction)}
              onClick={() => void run(item.action)}
              title={item.label}
            >
              {item.icon}
              <span className="hidden sm:inline">{item.label}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
