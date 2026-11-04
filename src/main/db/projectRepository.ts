import type { AppDatabase } from './database'
import type { Project } from '../../shared/types'

export interface ProjectRow {
  id: string
  name: string
  color: string
  created_at: string
  updated_at: string
}

interface ProjectWithCountsRow extends ProjectRow {
  open_count: number
  total_count: number
}

function mapProject(row: ProjectWithCountsRow): Project {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    openTaskCount: Number(row.open_count ?? 0),
    totalTaskCount: Number(row.total_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class ProjectRepository {
  constructor(private readonly db: AppDatabase) {}

  list(): Project[] {
    const rows = this.db
      .prepare(
        `SELECT
          p.id, p.name, p.color, p.created_at, p.updated_at,
          COALESCE(SUM(CASE WHEN t.status != 'done' THEN 1 ELSE 0 END), 0) AS open_count,
          COUNT(t.id) AS total_count
        FROM projects p
        LEFT JOIN tasks t ON t.project_id = p.id
        GROUP BY p.id
        ORDER BY p.name COLLATE NOCASE ASC`
      )
      .all() as ProjectWithCountsRow[]
    return rows.map(mapProject)
  }

  get(id: string): Project | null {
    const row = this.db
      .prepare(
        `SELECT
          p.id, p.name, p.color, p.created_at, p.updated_at,
          COALESCE(SUM(CASE WHEN t.status != 'done' THEN 1 ELSE 0 END), 0) AS open_count,
          COUNT(t.id) AS total_count
        FROM projects p
        LEFT JOIN tasks t ON t.project_id = p.id
        WHERE p.id = ?
        GROUP BY p.id`
      )
      .get(id) as ProjectWithCountsRow | undefined
    return row ? mapProject(row) : null
  }

  exists(id: string): boolean {
    const row = this.db.prepare('SELECT 1 AS found FROM projects WHERE id = ?').get(id) as
      | { found: number }
      | undefined
    return Boolean(row)
  }

  insert(row: ProjectRow): void {
    this.db
      .prepare(
        `INSERT INTO projects (id, name, color, created_at, updated_at)
         VALUES (@id, @name, @color, @created_at, @updated_at)`
      )
      .run(row)
  }

  update(
    id: string,
    fields: Partial<Pick<ProjectRow, 'name' | 'color' | 'updated_at'>>
  ): void {
    const entries = Object.entries(fields)
    if (entries.length === 0) return
    const setters = entries.map(([key]) => `${key} = @${key}`).join(', ')
    this.db.prepare(`UPDATE projects SET ${setters} WHERE id = @id`).run({
      ...Object.fromEntries(entries),
      id
    })
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM projects WHERE id = ?').run(id)
  }
}
