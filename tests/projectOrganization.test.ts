import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type AppDatabase } from '../src/main/db/database'
import { ProjectService } from '../src/main/services/projectService'
import { TaskService, type TaskMedia } from '../src/main/services/taskService'
import { UNASSIGNED_PROJECT_FILTER } from '../src/shared/projects'
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

describe('project organization', () => {
  it('pins, reorders, and persists project order', () => {
    const first = projects.create({ name: '项目 A', color: '#0d9488' })
    const second = projects.create({ name: '项目 B', color: '#2563eb' })
    const third = projects.create({ name: '项目 C', color: '#7c3aed' })

    expect(projects.list().map((project) => project.name)).toEqual([
      '项目 A',
      '项目 B',
      '项目 C'
    ])

    projects.update(third.id, { pinned: true })
    expect(projects.list().map((project) => project.name)).toEqual([
      '项目 C',
      '项目 A',
      '项目 B'
    ])

    projects.move(second.id, 'up')
    expect(projects.list().map((project) => project.name)).toEqual([
      '项目 C',
      '项目 B',
      '项目 A'
    ])
    expect(new ProjectService(db).list().map((project) => project.name)).toEqual([
      '项目 C',
      '项目 B',
      '项目 A'
    ])
    expect(projects.list().find((project) => project.id === third.id)?.pinned).toBe(true)
  })

  it('archives a project without losing task associations', async () => {
    const project = projects.create({ name: '待归档项目', color: '#0d9488' })
    const task = await tasks.create({ title: '保留关联', projectId: project.id })

    projects.setArchived(project.id, true)
    expect(projects.list().map((item) => item.id)).not.toContain(project.id)
    expect(projects.list(true).find((item) => item.id === project.id)?.archivedAt).toBeTruthy()
    expect(tasks.get(task.id)?.projectId).toBe(project.id)

    projects.setArchived(project.id, false)
    expect(projects.list().map((item) => item.id)).toContain(project.id)
  })

  it('filters and counts unassigned tasks', async () => {
    const project = projects.create({ name: '有项目', color: '#0d9488' })
    const assigned = await tasks.create({ title: '关联任务', projectId: project.id })
    const unassigned = await tasks.create({ title: '未关联任务' })

    const filtered = tasks.list('all_open', UNASSIGNED_PROJECT_FILTER)
    expect(filtered.map((task) => task.id)).toEqual([unassigned.id])
    expect(tasks.counts(UNASSIGNED_PROJECT_FILTER).all_open).toBe(1)
    expect(tasks.get(assigned.id)?.projectId).toBe(project.id)
  })
})
