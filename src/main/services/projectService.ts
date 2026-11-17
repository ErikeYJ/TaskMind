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

  list(includeArchived = false): Project[] {
    return this.repository.list(includeArchived)
  }

  create(input: CreateProjectInput): Project {
    const id = randomUUID()
    const now = nowIso()
    const maxSort = this.db
      .prepare('SELECT COALESCE(MAX(sort_order), -1) AS value FROM projects WHERE archived_at IS NULL')
      .get() as { value: number }
    const row: ProjectRow = {
      id,
      name: cleanName(input.name),
      color: cleanColor(input.color),
      pinned: 0,
      sort_order: Number(maxSort.value ?? -1) + 1,
      archived_at: null,
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
    const fields: Partial<
      Pick<ProjectRow, 'name' | 'color' | 'pinned' | 'updated_at'>
    > = {
      updated_at: nowIso()
    }
    if (patch.name !== undefined) fields.name = cleanName(patch.name)
    if (patch.color !== undefined) fields.color = cleanColor(patch.color)
    if (typeof patch.pinned === 'boolean') fields.pinned = patch.pinned ? 1 : 0
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

  setArchived(id: string, archived: boolean): Project {
    if (!this.repository.exists(id)) throw new Error('项目不存在')
    this.repository.update(id, {
      archived_at: archived ? nowIso() : null,
      updated_at: nowIso()
    })
    const project = this.repository.get(id)
    if (!project) throw new Error('项目不存在')
    this.emitChanged()
    return project
  }

  move(id: string, direction: 'up' | 'down'): void {
    const ordered = this.repository.list(false)
    const current = ordered.find((project) => project.id === id)
    if (!current) throw new Error('项目不存在')
    if (current.archivedAt) throw new Error('归档项目不能排序')
    const group = ordered.filter((project) => project.pinned === current.pinned)
    const index = group.findIndex((project) => project.id === id)
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= group.length) return

    const reordered = [...ordered]
    const firstIndex = reordered.findIndex((project) => project.id === group[index].id)
    const secondIndex = reordered.findIndex((project) => project.id === group[target].id)
    ;[reordered[firstIndex], reordered[secondIndex]] = [
      reordered[secondIndex],
      reordered[firstIndex]
    ]
    const reorder = this.db.transaction(() => {
      reordered.forEach((project, position) => {
        this.repository.update(project.id, {
          sort_order: position,
          updated_at: nowIso()
        })
      })
    })
    reorder()
    this.emitChanged()
  }

  exists(id: string): boolean {
    return this.repository.exists(id)
  }
}
