import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type AppDatabase } from '../src/main/db/database'
import { TaskService, type TaskMedia } from '../src/main/services/taskService'
import type { SavedImage } from '../src/main/services/mediaService'
import { getTodayString } from '../src/shared/date'

class StubMedia implements TaskMedia {
  saved: SavedImage[] = []
  deleted: string[] = []

  async saveImage(_dataUrl: string): Promise<SavedImage> {
    const id = randomUUID()
    const image: SavedImage = {
      id,
      fileName: `2026/11/${id}.png`,
      thumbName: `2026/11/${id}.thumb.jpg`,
      mimeType: 'image/png',
      width: 800,
      height: 600
    }
    this.saved.push(image)
    return image
  }

  async deleteFiles(fileName: string, thumbName: string | null): Promise<void> {
    this.deleted.push(fileName)
    if (thumbName) this.deleted.push(thumbName)
  }
}

let db: AppDatabase
let media: StubMedia
let service: TaskService

beforeEach(() => {
  db = openDatabase(':memory:')
  media = new StubMedia()
  service = new TaskService(db, media)
})

afterEach(() => {
  db.close()
})

describe('TaskService', () => {
  it('creates tasks with screenshots and lists them in the right views', async () => {
    const today = getTodayString()
    const task = await service.create({
      title: '明天安装窗帘',
      dueDate: today,
      screenshots: [{ dataUrl: 'data:image/png;base64,abc' }]
    })

    expect(task.status).toBe('todo')
    expect(task.screenshots).toHaveLength(1)
    expect(media.saved).toHaveLength(1)
    expect(service.list('today').map((item) => item.id)).toContain(task.id)
    expect(service.list('all_open').map((item) => item.id)).toContain(task.id)
    expect(service.counts().today).toBe(1)
    expect(service.counts().all_open).toBe(1)
  })

  it('allows multiple tasks in progress at the same time', async () => {
    const first = await service.create({ title: '任务一' })
    const second = await service.create({ title: '任务二' })
    service.transition(first.id, 'start')
    service.transition(second.id, 'start')
    expect(service.list('in_progress')).toHaveLength(2)
  })

  it('handles suspend, resume, complete and restore transitions', async () => {
    const task = await service.create({ title: '状态测试' })

    const started = service.transition(task.id, 'start')
    expect(started.status).toBe('in_progress')
    expect(started.startedAt).toBeTruthy()

    const suspended = service.transition(task.id, 'suspend')
    expect(suspended.status).toBe('suspended')
    expect(suspended.statusBeforeSuspend).toBe('in_progress')

    const resumed = service.transition(task.id, 'resume')
    expect(resumed.status).toBe('in_progress')

    const completed = service.transition(task.id, 'complete')
    expect(completed.status).toBe('done')
    expect(completed.statusBeforeDone).toBe('in_progress')
    expect(service.list('completed')).toHaveLength(1)

    const restored = service.transition(task.id, 'restore')
    expect(restored.status).toBe('in_progress')
    expect(service.list('completed')).toHaveLength(0)
  })

  it('restores a completed suspended task back to suspended', async () => {
    const task = await service.create({ title: '挂起后完成' })
    service.transition(task.id, 'suspend')
    service.transition(task.id, 'complete')
    const restored = service.transition(task.id, 'restore')
    expect(restored.status).toBe('suspended')
    expect(service.list('suspended')).toHaveLength(1)
  })

  it('adds and removes screenshots and deletes their files', async () => {
    const task = await service.create({ title: '截图测试' })
    const shot = await service.addScreenshot(task.id, 'data:image/png;base64,abc')
    expect(service.get(task.id)?.screenshots).toHaveLength(1)

    await service.deleteScreenshot(shot.id)
    expect(service.get(task.id)?.screenshots).toHaveLength(0)
    expect(media.deleted.length).toBeGreaterThan(0)
  })

  it('deletes tasks and cleanup screenshot files', async () => {
    const task = await service.create({
      title: '删除测试',
      screenshots: [{ dataUrl: 'data:image/png;base64,abc' }]
    })
    await service.delete(task.id)
    expect(service.get(task.id)).toBeNull()
    expect(media.deleted.length).toBeGreaterThan(0)
  })

  it('updates content and clears time when date is removed', async () => {
    const task = await service.create({
      title: '编辑测试',
      dueDate: getTodayString(),
      dueTime: '15:00'
    })
    const updated = service.update(task.id, {
      title: '改过的标题',
      dueDate: null,
      dueTime: null
    })
    expect(updated.title).toBe('改过的标题')
    expect(updated.dueDate).toBeNull()
    expect(updated.dueTime).toBeNull()
  })

  it('rejects invalid transitions', async () => {
    const task = await service.create({ title: '非法操作' })
    expect(() => service.transition(task.id, 'resume')).toThrow()
    service.transition(task.id, 'complete')
    expect(() => service.transition(task.id, 'start')).toThrow()
  })
})
