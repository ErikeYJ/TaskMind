import { AlertTriangle, CalendarDays, Clock } from 'lucide-react'
import { STATUS_LABELS } from '@shared/constants'
import { formatDueLabel } from '@shared/date'
import type { Task, TaskStatus } from '@shared/types'
import { cn } from '../../lib/utils'

const statusClasses: Record<TaskStatus, string> = {
  todo: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/20',
  in_progress:
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-400/10 dark:text-amber-300 dark:border-amber-400/20',
  suspended:
    'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-400/10 dark:text-violet-300 dark:border-violet-400/20',
  done: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-300 dark:border-emerald-400/20'
}

const statusDots: Record<TaskStatus, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-amber-500',
  suspended: 'bg-violet-500',
  done: 'bg-emerald-500'
}

export function StatusDot({ status }: { status: TaskStatus }): React.JSX.Element {
  return <span className={cn('block h-2 w-2 rounded-full', statusDots[status])} />
}

export function StatusBadge({
  status,
  className
}: {
  status: TaskStatus
  className?: string
}): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        statusClasses[status],
        className
      )}
    >
      <StatusDot status={status} />
      {STATUS_LABELS[status]}
    </span>
  )
}

const toneClasses = {
  overdue:
    'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20',
  today:
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-400/10 dark:text-amber-300 dark:border-amber-400/20',
  soon: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-400/10 dark:text-sky-300 dark:border-sky-400/20',
  normal:
    'bg-[var(--surface-soft)] text-[var(--muted)] border-[var(--border)]',
  none: 'bg-transparent text-[var(--muted)] border-transparent'
}

export function DueBadge({
  task,
  className,
  showIcon = true
}: {
  task: Pick<Task, 'dueDate' | 'dueTime'>
  className?: string
  showIcon?: boolean
}): React.JSX.Element {
  const label = formatDueLabel(task)
  const Icon = label.tone === 'overdue' ? AlertTriangle : label.tone === 'none' ? Clock : CalendarDays
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        toneClasses[label.tone],
        className
      )}
    >
      {showIcon ? <Icon className="h-3 w-3" /> : null}
      {label.text}
    </span>
  )
}

export function CountBadge({
  count,
  active = false
}: {
  count: number
  active?: boolean
}): React.JSX.Element {
  return (
    <span
      className={cn(
        'min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums',
        active
          ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
          : 'bg-[var(--surface-hover)] text-[var(--muted)]'
      )}
    >
      {count}
    </span>
  )
}
