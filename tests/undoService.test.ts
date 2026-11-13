import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type AppDatabase } from '../src/main/db/database'
import { ProjectService } from '../src/main/services/projectService'
import { TaskService, type TaskMedia } from '../src/main/services/taskService'
import { UndoService } from '../src/main/services/undoService'
import type { SavedImage } from '../src/main/services/mediaService'

class StubMedia implements TaskMedia {
  readonly deleted: string[] = []

  async saveImage(_dataUrl: string): Promise<SavedImage> {
    const id = randomUUID()
    return {
      id,
      fileName: `2026/11/${id}.png`,
      thumbName: `2026/11/${id}.thumb.jpg`,
      mimeType: 'image/png',
      width: 800,
      height: 600
    }
  }

  async deleteFiles(fileName: string, thumbName: string | null): Promise<void> {
    this.deleted.push(fileName)
    if (thumbName) this.deleted.push(thumbName)
  }
}

let db: AppDatabase
let media: StubMedia
let tasks: TaskService
let projects: ProjectService

beforeEach(() => {
  db = openDatabase(':memory:')
  media = new StubMedia()
  tasks = new TaskService(db, media)
  projects = new ProjectService(db)
})

afterEach(() => {
  db.close()
})

describe('UndoService', () => {
  it('restores a deleted task with its project and screenshots', async () => {
    const project = projects.create({ name: '撤销测试项目', color: '#0d9488' })
    const task = await tasks.create({
      title: '需要撤销的任务',
      content: '门禁密码 2468',
      projectId: project.id,
      screenshots: [{ dataUrl: 'data:image/png;base64,AAAA' }]
    })
    expect(task.screenshots).toHaveLength(1)

    const undoService = new UndoService(tasks, projects)
    const deleted = undoService.deleteTask(task.id)
    expect(deleted.undoToken).toBeTruthy()
    expect(tasks.get(task.id)).toBeNull()
    expect(media.deleted).toEqual([])

    const result = undoService.undo(deleted.undoToken!)
    expect(result).toEqual({ ok: true, message: '任务已恢复' })
    const restored = tasks.get(task.id)
    expect(restored?.projectId).toBe(project.id)
    expect(restored?.title).toBe('需要撤销的任务')
    expect(restored?.screenshots).toHaveLength(1)
  })

  it('restores project associations after undoing a project deletion', async () => {
    const project = projects.create({ name: '撤销项目', color: '#2563eb' })
    const task = await tasks.create({ title: '原项目任务', projectId: project.id })
    const undoService = new UndoService(tasks, projects)

    const deleted = undoService.deleteProject(project.id)
    expect(tasks.get(task.id)?.projectId).toBeNull()
    expect(projects.list()).toHaveLength(0)

    const result = undoService.undo(deleted.undoToken!)
    expect(result.ok).toBe(true)
    expect(projects.list().map((item) => item.id)).toEqual([project.id])
    expect(tasks.get(task.id)?.projectId).toBe(project.id)
  })

  it('expires undo and cleans up screenshot files at the deadline', async () => {
    const task = await tasks.create({
      title: '过期任务',
      screenshots: [{ dataUrl: 'data:image/png;base64,AAAA' }]
    })
    const undoService = new UndoService(tasks, projects, 30)
    const deleted = undoService.deleteTask(task.id)

    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(tasks.get(task.id)).toBeNull()
    expect(media.deleted).toHaveLength(2)
    const result = undoService.undo(deleted.undoToken!)
    expect(result).toEqual({ ok: false, message: '撤销已过期' })
  })

  it('cleans up pending task files on dispose', async () => {
    const task = await tasks.create({
      title: '退出前删除的任务',
      screenshots: [{ dataUrl: 'data:image/png;base64,AAAA' }]
    })
    const undoService = new UndoService(tasks, projects)
    undoService.deleteTask(task.id)
    await undoService.dispose()
    expect(tasks.get(task.id)).toBeNull()
    expect(media.deleted).toHaveLength(2)
  })
})
