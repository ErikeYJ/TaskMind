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

describe('task search', () => {
  it('searches title, client, content, notes and project name', async () => {
    const project = projects.create({ name: '金色花园', color: '#0d9488' })
    const task = await tasks.create({
      title: '安装门窗',
      client: '李姐',
      content: '门禁密码 2468',
      notes: '记得带玻璃胶',
      projectId: project.id
    })

    for (const query of ['门窗', '李姐', '2468', '玻璃胶', '金色花园', '金色']) {
      expect(tasks.search(query).map((item) => item.id)).toEqual([task.id])
    }
  })

  it('includes completed tasks and orders title matches first', async () => {
    const completed = await tasks.create({ title: '安装门窗', content: '旧任务' })
    tasks.transition(completed.id, 'complete')
    const contentMatch = await tasks.create({ title: '客户回访', content: '安装门窗后回访' })

    const results = tasks.search('安装门窗')
    expect(results.map((task) => task.id)).toEqual([completed.id, contentMatch.id])
    expect(results[0]?.status).toBe('done')
  })

  it('treats SQL LIKE wildcards as literal characters', async () => {
    const percent = await tasks.create({ title: '100% 完成' })
    const underscore = await tasks.create({ title: 'A_B 测试' })
    await tasks.create({ title: '普通任务' })

    expect(tasks.search('%').map((task) => task.id)).toEqual([percent.id])
    expect(tasks.search('100%').map((task) => task.id)).toEqual([percent.id])
    expect(tasks.search('_').map((task) => task.id)).toEqual([underscore.id])
  })

  it('returns no results for empty queries', () => {
    expect(tasks.search('')).toEqual([])
    expect(tasks.search('   ')).toEqual([])
  })
})
