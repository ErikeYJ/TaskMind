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

describe('ProjectService', () => {
  it('creates, lists and updates projects with unique case-insensitive names', () => {
    const project = projects.create({ name: '  门店安装  ', color: '#2563eb' })
    expect(project.name).toBe('门店安装')
    expect(project.color).toBe('#2563eb')
    expect(project.openTaskCount).toBe(0)
    expect(project.totalTaskCount).toBe(0)

    const updated = projects.update(project.id, { name: 'Showroom 2', color: '#DC2626' })
    expect(updated.name).toBe('Showroom 2')
    expect(updated.color).toBe('#dc2626')
    expect(projects.list()).toHaveLength(1)

    expect(() => projects.create({ name: 'Showroom 2', color: '#0d9488' })).toThrow('项目名称已存在')
    expect(() => projects.create({ name: 'SHOWROOM 2', color: '#0d9488' })).toThrow(
      '项目名称已存在'
    )
  })

  it('associates tasks with projects and filters task lists and counts', async () => {
    const first = projects.create({ name: '项目 A', color: '#0d9488' })
    const second = projects.create({ name: '项目 B', color: '#2563eb' })
    const firstTask = await tasks.create({ title: 'A 的任务', projectId: first.id })
    const secondTask = await tasks.create({ title: 'B 的任务', projectId: second.id })
    const unassigned = await tasks.create({ title: '未关联任务' })

    expect(tasks.get(firstTask.id)?.projectId).toBe(first.id)
    expect(tasks.list('all_open', first.id).map((task) => task.id)).toEqual([firstTask.id])
    expect(tasks.list('all_open', second.id).map((task) => task.id)).toEqual([secondTask.id])
    expect(tasks.counts(first.id).all_open).toBe(1)
    expect(tasks.counts(null).all_open).toBe(3)

    expectOpenCount(projects, first.id, 1)
    expectOpenCount(projects, second.id, 1)

    tasks.transition(firstTask.id, 'complete')
    expectOpenCount(projects, first.id, 0)
    expect(projects.list().find((project) => project.id === first.id)?.totalTaskCount).toBe(1)

    const moved = tasks.update(secondTask.id, { projectId: first.id })
    expect(moved.projectId).toBe(first.id)
    expectOpenCount(projects, second.id, 0)
    expectOpenCount(projects, first.id, 1)

    const cleared = tasks.update(secondTask.id, { projectId: null })
    expect(cleared.projectId).toBeNull()
    expectOpenCount(projects, first.id, 0)
    expect(tasks.get(unassigned.id)?.projectId).toBeNull()
    expect(tasks.list('all_open', first.id)).toHaveLength(0)
  })

  it('deletes a project without deleting its tasks', async () => {
    const project = projects.create({ name: '待删除项目', color: '#7c3aed' })
    const task = await tasks.create({ title: '保留任务', projectId: project.id })

    projects.delete(project.id)

    expect(projects.list()).toHaveLength(0)
    expect(tasks.get(task.id)?.projectId).toBeNull()
    expect(tasks.list('all_open')).toHaveLength(1)
  })

  it('rejects tasks pointing at unknown projects', async () => {
    await expect(tasks.create({ title: '坏关联', projectId: randomUUID() })).rejects.toThrow(
      '项目不存在'
    )
    const task = await tasks.create({ title: '正常任务' })
    expect(() => tasks.update(task.id, { projectId: randomUUID() })).toThrow('项目不存在')
  })
})

function expectOpenCount(service: ProjectService, projectId: string, expected: number): void {
  const project = service.list().find((item) => item.id === projectId)
  expect(project?.openTaskCount).toBe(expected)
}
