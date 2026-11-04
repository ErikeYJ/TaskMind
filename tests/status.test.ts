import { describe, expect, it } from 'vitest'
import {
  canPerformAction,
  defaultViewForTask,
  nextStatusForAction,
  selectTopTasks,
  sortTasksForDisplay,
  taskBelongsToView
} from '../src/shared/status'
import { makeTask } from './helpers'

const today = '2026-11-04'

describe('list membership', () => {
  it('puts due-today todo tasks in today and all_open', () => {
    const task = makeTask({ status: 'todo', dueDate: today })
    expect(taskBelongsToView(task, 'today', today)).toBe(true)
    expect(taskBelongsToView(task, 'all_open', today)).toBe(true)
    expect(taskBelongsToView(task, 'in_progress', today)).toBe(false)
  })

  it('puts in-progress tasks in all_open and in_progress, not today', () => {
    const task = makeTask({ status: 'in_progress', dueDate: today })
    expect(taskBelongsToView(task, 'today', today)).toBe(false)
    expect(taskBelongsToView(task, 'all_open', today)).toBe(true)
    expect(taskBelongsToView(task, 'in_progress', today)).toBe(true)
  })

  it('puts suspended tasks only in all_open and suspended', () => {
    const task = makeTask({ status: 'suspended', dueDate: today })
    expect(taskBelongsToView(task, 'today', today)).toBe(false)
    expect(taskBelongsToView(task, 'all_open', today)).toBe(true)
    expect(taskBelongsToView(task, 'suspended', today)).toBe(true)
  })

  it('puts done tasks only in completed', () => {
    const task = makeTask({ status: 'done', dueDate: today })
    expect(taskBelongsToView(task, 'completed', today)).toBe(true)
    expect(taskBelongsToView(task, 'all_open', today)).toBe(false)
    expect(taskBelongsToView(task, 'today', today)).toBe(false)
  })
})

describe('status transitions', () => {
  it('allows start only from todo', () => {
    expect(canPerformAction('todo', 'start')).toBe(true)
    expect(canPerformAction('in_progress', 'start')).toBe(false)
    expect(nextStatusForAction('todo', 'start', null, null)).toBe('in_progress')
  })

  it('suspends and resumes to previous status', () => {
    expect(nextStatusForAction('in_progress', 'suspend', null, null)).toBe('suspended')
    expect(nextStatusForAction('suspended', 'resume', 'in_progress', null)).toBe('in_progress')
    expect(nextStatusForAction('suspended', 'resume', 'todo', null)).toBe('todo')
    expect(nextStatusForAction('suspended', 'resume', null, null)).toBe('todo')
  })

  it('completes from any open status and restores previous status', () => {
    expect(nextStatusForAction('todo', 'complete', null, null)).toBe('done')
    expect(nextStatusForAction('suspended', 'complete', null, null)).toBe('done')
    expect(nextStatusForAction('done', 'restore', null, 'suspended')).toBe('suspended')
    expect(nextStatusForAction('done', 'restore', null, 'in_progress')).toBe('in_progress')
    expect(nextStatusForAction('done', 'restore', null, null)).toBe('todo')
    expect(nextStatusForAction('done', 'complete', null, null)).toBeNull()
  })
})

describe('defaultViewForTask', () => {
  it('routes each state to a sensible tab', () => {
    expect(defaultViewForTask(makeTask({ status: 'todo', dueDate: today }), today)).toBe('today')
    expect(defaultViewForTask(makeTask({ status: 'todo', dueDate: '2026-11-09' }), today)).toBe(
      'all_open'
    )
    expect(defaultViewForTask(makeTask({ status: 'in_progress' }), today)).toBe('in_progress')
    expect(defaultViewForTask(makeTask({ status: 'suspended' }), today)).toBe('suspended')
    expect(defaultViewForTask(makeTask({ status: 'done' }), today)).toBe('completed')
  })
})

describe('sorting and ball top 3', () => {
  it('sorts active tasks by due date and time, with undated last', () => {
    const tasks = [
      makeTask({ title: 'no date', dueDate: null, createdAt: '2026-11-01T00:00:00.000Z' }),
      makeTask({ title: 'later', dueDate: '2026-11-09' }),
      makeTask({ title: 'tomorrow', dueDate: '2026-11-05' }),
      makeTask({ title: 'today late', dueDate: today, dueTime: '18:00' }),
      makeTask({ title: 'today early', dueDate: today, dueTime: '09:00' })
    ]
    expect(sortTasksForDisplay(tasks, 'all_open').map((task) => task.title)).toEqual([
      'today early',
      'today late',
      'tomorrow',
      'later',
      'no date'
    ])
  })

  it('sorts completed by completion time descending', () => {
    const tasks = [
      makeTask({ status: 'done', completedAt: '2026-11-01T00:00:00.000Z' }),
      makeTask({ status: 'done', completedAt: '2026-11-03T00:00:00.000Z' })
    ]
    expect(sortTasksForDisplay(tasks, 'completed')[0].completedAt).toBe(
      '2026-11-03T00:00:00.000Z'
    )
  })

  it('selects top 3 active due tasks and excludes suspended, done, and undated', () => {
    const tasks = [
      makeTask({ title: 'overdue', status: 'todo', dueDate: '2026-11-03' }),
      makeTask({ title: 'today', status: 'in_progress', dueDate: today, dueTime: '09:00' }),
      makeTask({ title: 'tomorrow', status: 'todo', dueDate: '2026-11-05' }),
      makeTask({ title: 'suspended', status: 'suspended', dueDate: '2026-11-01' }),
      makeTask({ title: 'done', status: 'done', dueDate: '2026-11-01' }),
      makeTask({ title: 'undated', status: 'todo', dueDate: null })
    ]
    expect(selectTopTasks(tasks).map((task) => task.title)).toEqual([
      'overdue',
      'today',
      'tomorrow'
    ])
  })
})
