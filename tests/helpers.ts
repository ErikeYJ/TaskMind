import type { Task, TaskStatus } from '../src/shared/types'

let counter = 0

export function makeTask(partial: Partial<Task> = {}): Task {
  counter += 1
  const now = new Date(Date.UTC(2026, 10, 4, 2, 0, 0)).toISOString()
  const status: TaskStatus = partial.status ?? 'todo'
  return {
    id: `task-${counter}`,
    title: `任务 ${counter}`,
    content: '',
    client: null,
    notes: '',
    projectId: null,
    dueDate: null,
    dueTime: null,
    status,
    statusBeforeSuspend: null,
    statusBeforeDone: null,
    startedAt: null,
    suspendedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    screenshots: [],
    ...partial
  }
}
