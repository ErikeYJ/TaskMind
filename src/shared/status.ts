import { getTodayString } from './date'
import type { BallTopTask, Task, TaskAction, TaskStatus, TaskView } from './types'

export function isOpenStatus(status: TaskStatus): boolean {
  return status === 'todo' || status === 'in_progress' || status === 'suspended'
}

export function isActiveStatus(status: TaskStatus): boolean {
  return status === 'todo' || status === 'in_progress'
}

export function canPerformAction(status: TaskStatus, action: TaskAction): boolean {
  switch (action) {
    case 'start':
      return status === 'todo'
    case 'suspend':
      return status === 'todo' || status === 'in_progress'
    case 'resume':
      return status === 'suspended'
    case 'complete':
      return isOpenStatus(status)
    case 'restore':
      return status === 'done'
    default:
      return false
  }
}

export function nextStatusForAction(
  current: TaskStatus,
  action: TaskAction,
  statusBeforeSuspend: TaskStatus | null,
  statusBeforeDone: TaskStatus | null
): TaskStatus | null {
  if (!canPerformAction(current, action)) return null
  switch (action) {
    case 'start':
      return 'in_progress'
    case 'suspend':
      return 'suspended'
    case 'resume':
      return statusBeforeSuspend && statusBeforeSuspend !== 'done' ? statusBeforeSuspend : 'todo'
    case 'complete':
      return 'done'
    case 'restore':
      return statusBeforeDone && statusBeforeDone !== 'done' ? statusBeforeDone : 'todo'
    default:
      return null
  }
}

export function taskBelongsToView(task: Task, view: TaskView, today = getTodayString()): boolean {
  switch (view) {
    case 'today':
      return task.status === 'todo' && Boolean(task.dueDate && task.dueDate <= today)
    case 'all_open':
      return isOpenStatus(task.status)
    case 'in_progress':
      return task.status === 'in_progress'
    case 'completed':
      return task.status === 'done'
    case 'suspended':
      return task.status === 'suspended'
    default:
      return false
  }
}

export function defaultViewForTask(task: Task, today = getTodayString()): TaskView {
  if (task.status === 'done') return 'completed'
  if (task.status === 'suspended') return 'suspended'
  if (task.status === 'in_progress') return 'in_progress'
  if (task.dueDate && task.dueDate <= today) return 'today'
  return 'all_open'
}

function compareActiveTasks(a: Task, b: Task): number {
  const aDate = a.dueDate ?? '9999-12-31'
  const bDate = b.dueDate ?? '9999-12-31'
  if (aDate !== bDate) return aDate < bDate ? -1 : 1

  const aTime = a.dueTime ?? '23:59'
  const bTime = b.dueTime ?? '23:59'
  if (aTime !== bTime) return aTime < bTime ? -1 : 1

  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0
}

export function sortTasksForDisplay(tasks: Task[], view: TaskView): Task[] {
  const copy = [...tasks]
  if (view === 'completed') {
    copy.sort((a, b) => {
      const aAt = a.completedAt ?? a.updatedAt
      const bAt = b.completedAt ?? b.updatedAt
      return aAt < bAt ? 1 : aAt > bAt ? -1 : 0
    })
    return copy
  }
  copy.sort(compareActiveTasks)
  return copy
}

export function selectTopTasks(
  tasks: Task[],
  limit = 3
): BallTopTask[] {
  return tasks
    .filter(
      (task) =>
        isActiveStatus(task.status) &&
        Boolean(task.dueDate) &&
        task.status !== 'suspended' &&
        task.status !== 'done'
    )
    .sort(compareActiveTasks)
    .slice(0, limit)
    .map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      dueDate: task.dueDate,
      dueTime: task.dueTime
    }))
}
