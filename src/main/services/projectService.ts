import { randomUUID } from 'node:crypto'
import { DEFAULT_PROJECT_COLOR } from '../../shared/projects'
import type { CreateProjectInput, Project, UpdateProjectInput } from '../../shared/types'
import type { AppDatabase } from '../db/database'
import { ProjectRepository, type ProjectRow } from '../db/projectRepository'

function nowIso(): string {
  return new Date().toISOString()
}

function cleanName(name: string): string {
  const value = name.trim()
  if (!value) throw new Error('项目名称不能为空')
  if (value.length > 60) throw new Error('项目名称最多 60 个字')
  return value
}

function cleanColor(color: string | undefined): string {
  if (!color) return DEFAULT_PROJECT_COLOR
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new Error('项目颜色格式不正确')
  }
  return color.toLowerCase()
}

function isUniqueError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('UNIQUE')
}

export interface DeletedProjectSnapshot {
  project: ProjectRow
  taskIds: string[]
}

export class ProjectService {
  private readonly repository: ProjectRepository
  private readonly listeners = new Set<() => void>()

  constructor(private readonly db: AppDatabase) {
    this.repository = new ProjectRepository(db)
  }

  onChanged(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emitChanged(): void {
    for (const listener of this.listeners) {
      try {
        listener()
      } catch {
        // ignore listener errors
      }
    }
  }

  list(): Project[] {
    return this.repository.list()
  }

  create(input: CreateProjectInput): Project {
    const id = randomUUID()
    const now = nowIso()
    const row: ProjectRow = {
      id,
      name: cleanName(input.name),
      color: cleanColor(input.color),
      created_at: now,
      updated_at: now
    }
    try {
      this.repository.insert(row)
    } catch (error) {
      if (isUniqueError(error)) throw new Error('项目名称已存在')
      throw error
    }
    const project = this.repository.get(id)
    if (!project) throw new Error('创建项目失败')
    this.emitChanged()
    return project
  }

  update(id: string, patch: UpdateProjectInput): Project {
    if (!this.repository.exists(id)) throw new Error('项目不存在')
    const fields: Partial<Pick<ProjectRow, 'name' | 'color' | 'updated_at'>> = {
      updated_at: nowIso()
    }
    if (patch.name !== undefined) fields.name = cleanName(patch.name)
    if (patch.color !== undefined) fields.color = cleanColor(patch.color)
    try {
      this.repository.update(id, fields)
    } catch (error) {
      if (isUniqueError(error)) throw new Error('项目名称已存在')
      throw error
    }
    const project = this.repository.get(id)
    if (!project) throw new Error('项目不存在')
    this.emitChanged()
    return project
  }

  delete(id: string): void {
    if (!this.repository.exists(id)) return
    this.repository.delete(id)
    this.emitChanged()
  }

  deleteWithSnapshot(id: string): DeletedProjectSnapshot | null {
    const row = this.repository.getRow(id)
    if (!row) return null
    const taskIds = (
      this.db.prepare('SELECT id FROM tasks WHERE project_id = ?').all(id) as Array<{
        id: string
      }>
    ).map((task) => task.id)
    this.repository.delete(id)
    this.emitChanged()
    return { project: row, taskIds }
  }

  restoreDeleted(snapshot: DeletedProjectSnapshot): Project {
    if (this.repository.exists(snapshot.project.id)) {
      throw new Error('项目已经存在，无法撤销')
    }
    try {
      const restore = this.db.transaction(() => {
        this.repository.insert(snapshot.project)
        const update = this.db.prepare('UPDATE tasks SET project_id = ? WHERE id = ?')
        for (const taskId of snapshot.taskIds) {
          update.run(snapshot.project.id, taskId)
        }
      })
      restore()
    } catch (error) {
      if (isUniqueError(error)) throw new Error('项目名称已被占用，无法撤销')
      throw error
    }
    const project = this.repository.get(snapshot.project.id)
    if (!project) throw new Error('恢复项目失败')
    this.emitChanged()
    return project
  }

  exists(id: string): boolean {
    return this.repository.exists(id)
  }
}
