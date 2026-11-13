import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type AppDatabase } from '../src/main/db/database'
import { ProjectService } from '../src/main/services/projectService'
import { TaskService, type TaskMedia } from '../src/main/services/taskService'
import type { SavedImage } from '../src/main/services/mediaService'

class StubMedia implements TaskMedia {
  async saveImage(_dataUrl: string): Promise<SavedImage> {
    const id = randomUUID()
    return {
      id,
      fileName: `${id}.png`,
      thumbName: null,
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

describe('project suggestions', () => {
  it('prefers the project from the client most recent task', async () => {
    const first = projects.create({ name: '项目 A', color: '#0d9488' })
    const second = projects.create({ name: '项目 B', color: '#2563eb' })
    await tasks.create({ title: '第一次上门', client: '李姐', projectId: first.id })
    await new Promise((resolve) => setTimeout(resolve, 5))
    await tasks.create({ title: '第二次上门', client: '李姐', projectId: second.id })

    expect(tasks.suggestProject({ client: '李姐' })).toEqual({
      projectId: second.id,
      reason: 'client'
    })
    expect(tasks.suggestProject({ client: '李姐', title: '随便写的' })).toEqual({
      projectId: second.id,
      reason: 'client'
    })
  })

  it('fuzzy matches a project name from task text without history', () => {
    const installation = projects.create({ name: '金色花园安装', color: '#0d9488' })
    const store = projects.create({ name: '门店维护', color: '#2563eb' })

    expect(
      tasks.suggestProject({
        title: '去金色花园 5 栋 101 安装门窗',
        content: '门禁密码 2468',
        client: '新客户'
      })
    ).toEqual({ projectId: installation.id, reason: 'content' })

    expect(
      tasks.suggestProject({
        title: '更换 3 号店门锁',
        content: '门店维护的活',
        client: '另一位客户'
      })
    ).toEqual({ projectId: store.id, reason: 'content' })
  })

  it('returns null when there is no usable match', () => {
    projects.create({ name: '金色花园安装', color: '#0d9488' })
    const store = projects.create({ name: '门店维护', color: '#2563eb' })
    expect(tasks.suggestProject({ title: '买杯咖啡', content: '顺便取快递' })).toBeNull()
    expect(tasks.suggestProject({ client: '没有历史' })).toBeNull()
  })
})
