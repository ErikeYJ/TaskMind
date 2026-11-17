import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type AppDatabase } from '../src/main/db/database'
import { ProjectService } from '../src/main/services/projectService'
import { TaskService, type TaskMedia } from '../src/main/services/taskService'
import { UndoService } from '../src/main/services/undoService'
import type { SavedImage } from '../src/main/services/mediaService'

class StubMedia implements TaskMedia {
  async saveImage(_dataUrl: string): Promise<SavedImage> {
    const id = randomUUID()
    return {
      id,
      fileName: `${id}.png`,
      thumbName: `${id}.thumb.jpg`,
      mimeType: 'image/png',
      width: 800,
      height: 600
    }
  }

  async deleteFiles(_fileName: string, _thumbName: string | null): Promise<void> {
    // no-op
  }
}

let db: AppDatabase
let tasks: TaskService
let projects: ProjectService

beforeEach(() => {
  db = openDatabase(':memory:')
  tasks = new TaskService(db, new StubMedia())
  projects = new ProjectService(db)
})

afterEach(() => {
  db.close()
})

describe('batch task operations', () => {
  it('completes, suspends and resumes eligible tasks in one operation', async () => {
    const first = await tasks.create({ title: '任务 1' })
    const second = await tasks.create({ title: '任务 2' })
    const done = await tasks.create({ title: '已完成任务' })
    tasks.transition(done.id, 'complete')

    expect(tasks.batchTransition([first.id, second.id, done.id], 'complete')).toEqual({
      updated: 2,
      skipped: 1
    })
    expect(tasks.get(first.id)?.status).toBe('done')
    expect(tasks.get(second.id)?.status).toBe('done')

    const suspended = await tasks.create({ title: '待挂起' })
    expect(tasks.batchTransition([suspended.id], 'suspend')).toEqual({
      updated: 1,
      skipped: 0
    })
    expect(tasks.get(suspended.id)?.status).toBe('suspended')
    expect(tasks.batchTransition([suspended.id], 'resume')).toEqual({
      updated: 1,
      skipped: 0
    })
    expect(tasks.get(suspended.id)?.status).toBe('todo')
  })

  it('moves tasks between projects and unassigns them', async () => {
    const project = projects.create({ name: '批量项目', color: '#0d9488' })
    const first = await tasks.create({ title: '任务 1' })
    const second = await tasks.create({ title: '任务 2' })

    expect(tasks.batchSetProject([first.id, second.id], project.id)).toEqual({
      updated: 2,
      skipped: 0
    })
    expect(tasks.list('all_open', project.id)).toHaveLength(2)

    expect(tasks.batchSetProject([first.id, second.id], null)).toEqual({
      updated: 2,
      skipped: 0
    })
    expect(tasks.list('all_open', project.id)).toHaveLength(0)
  })

  it('deletes multiple tasks and restores every undo token', async () => {
    const first = await tasks.create({
      title: '任务 1',
      screenshots: [{ dataUrl: 'data:image/png;base64,AAAA' }]
    })
    const second = await tasks.create({ title: '任务 2' })
    const undo = new UndoService(tasks, projects)

    const deleted = undo.deleteTasks([first.id, second.id])
    expect(deleted.deleted).toBe(2)
    expect(deleted.undoTokens).toHaveLength(2)
    expect(tasks.get(first.id)).toBeNull()
    expect(tasks.get(second.id)).toBeNull()

    const outcomes = deleted.undoTokens.map((token) => undo.undo(token))
    expect(outcomes.every((outcome) => outcome.ok)).toBe(true)
    expect(tasks.get(first.id)?.screenshots).toHaveLength(1)
    expect(tasks.get(second.id)?.title).toBe('任务 2')
  })
})
