import type { AppDatabase } from './database'
import type { Project } from '../../shared/types'

export interface ProjectRow {
  id: string
  name: string
  color: string
  pinned: number
  sort_order: number
  archived_at: string | null
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
    pinned: Boolean(row.pinned),
    sortOrder: Number(row.sort_order ?? 0),
    archivedAt: row.archived_at,
    openTaskCount: Number(row.open_count ?? 0),
    totalTaskCount: Number(row.total_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class ProjectRepository {
  constructor(private readonly db: AppDatabase) {}

  list(includeArchived = false): Project[] {
    const where = includeArchived ? '' : 'WHERE p.archived_at IS NULL'
    const rows = this.db
      .prepare(
        `SELECT
          p.id, p.name, p.color, p.pinned, p.sort_order, p.archived_at,
          p.created_at, p.updated_at,
          COALESCE(SUM(CASE WHEN t.status != 'done' THEN 1 ELSE 0 END), 0) AS open_count,
          COUNT(t.id) AS total_count
        FROM projects p
        LEFT JOIN tasks t ON t.project_id = p.id
        ${where}
        GROUP BY p.id
        ORDER BY
          CASE WHEN p.archived_at IS NULL THEN 0 ELSE 1 END,
          p.pinned DESC,
          p.sort_order ASC,
          p.name COLLATE NOCASE ASC`
      )
      .all() as ProjectWithCountsRow[]
    return rows.map(mapProject)
  }

  get(id: string): Project | null {
    const row = this.db
      .prepare(
        `SELECT
          p.id, p.name, p.color, p.pinned, p.sort_order, p.archived_at,
          p.created_at, p.updated_at,
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

  getRow(id: string): ProjectRow | null {
    return (
      (this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as
        | ProjectRow
        | undefined) ?? null
    )
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
        `INSERT INTO projects (
          id, name, color, pinned, sort_order, archived_at, created_at, updated_at
        ) VALUES (
          @id, @name, @color, @pinned, @sort_order, @archived_at, @created_at, @updated_at
        )`
      )
      .run(row)
  }

  update(
    id: string,
    fields: Partial<
      Pick<ProjectRow, 'name' | 'color' | 'pinned' | 'sort_order' | 'archived_at' | 'updated_at'>
    >
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
