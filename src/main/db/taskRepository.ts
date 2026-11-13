import type { AppDatabase } from './database'
import type {
  ScreenshotMeta,
  Task,
  TaskCounts,
  TaskStatus,
  TaskView
} from '../../shared/types'

export interface TaskRow {
  id: string
  title: string
  content: string
  client: string | null
  notes: string
  project_id: string | null
  due_date: string | null
  due_time: string | null
  status: TaskStatus
  status_before_suspend: TaskStatus | null
  status_before_done: TaskStatus | null
  started_at: string | null
  suspended_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface ScreenshotRow {
  id: string
  task_id: string
  file_name: string
  thumb_name: string | null
  mime_type: string
  width: number | null
  height: number | null
  created_at: string
}

const ACTIVE_ORDER = `
  ORDER BY
    CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
    due_date ASC,
    CASE WHEN due_time IS NULL THEN 1 ELSE 0 END,
    due_time ASC,
    created_at ASC
`

function screenshotUrl(id: string, thumb: boolean): string {
  return `taskmind-media://${thumb ? 'thumb' : 'screenshot'}/${id}`
}

export function mapScreenshotRow(row: ScreenshotRow): ScreenshotMeta {
  return {
    id: row.id,
    taskId: row.task_id,
    fileName: row.file_name,
    thumbName: row.thumb_name,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
    url: screenshotUrl(row.id, false),
    thumbUrl: screenshotUrl(row.id, true)
  }
}

export function mapTaskRow(row: TaskRow, screenshots: ScreenshotMeta[]): Task {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    client: row.client,
    notes: row.notes,
    projectId: row.project_id,
    dueDate: row.due_date,
    dueTime: row.due_time,
    status: row.status,
    statusBeforeSuspend: row.status_before_suspend,
    statusBeforeDone: row.status_before_done,
    startedAt: row.started_at,
    suspendedAt: row.suspended_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    screenshots
  }
}

export class TaskRepository {
  constructor(private readonly db: AppDatabase) {}

  list(view: TaskView, today: string, projectId: string | null = null): Task[] {
    const projectClause = projectId ? ' AND project_id = @projectId' : ''
    const params: Record<string, unknown> = projectId ? { today, projectId } : { today }
    let rows: TaskRow[]
    if (view === 'today') {
      rows = this.db
        .prepare(
          `SELECT * FROM tasks WHERE status = 'todo' AND due_date IS NOT NULL AND due_date <= @today${projectClause} ${ACTIVE_ORDER}`
        )
        .all(params) as TaskRow[]
    } else if (view === 'all_open') {
      rows = this.db
        .prepare(
          `SELECT * FROM tasks WHERE status IN ('todo','in_progress','suspended')${projectClause} ${ACTIVE_ORDER}`
        )
        .all(projectId ? { projectId } : {}) as TaskRow[]
    } else if (view === 'in_progress') {
      rows = this.db
        .prepare(
          `SELECT * FROM tasks WHERE status = 'in_progress'${projectClause} ${ACTIVE_ORDER}`
        )
        .all(projectId ? { projectId } : {}) as TaskRow[]
    } else if (view === 'suspended') {
      rows = this.db
        .prepare(
          `SELECT * FROM tasks WHERE status = 'suspended'${projectClause} ${ACTIVE_ORDER}`
        )
        .all(projectId ? { projectId } : {}) as TaskRow[]
    } else {
      rows = this.db
        .prepare(
          `SELECT * FROM tasks WHERE status = 'done'${projectClause} ORDER BY completed_at DESC, updated_at DESC`
        )
        .all(projectId ? { projectId } : {}) as TaskRow[]
    }

    return this.withScreenshots(rows)
  }

  search(query: string, limit = 50): Task[] {
    const escaped = query.replace(/[!%_]/g, (match) => `!${match}`)
    const pattern = `%${escaped}%`
    const prefix = `${escaped}%`
    const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit)))
    const rows = this.db
      .prepare(
        `SELECT t.* FROM tasks t
         LEFT JOIN projects p ON p.id = t.project_id
         WHERE t.title LIKE @pattern ESCAPE '!'
            OR t.client LIKE @pattern ESCAPE '!'
            OR t.content LIKE @pattern ESCAPE '!'
            OR t.notes LIKE @pattern ESCAPE '!'
            OR p.name LIKE @pattern ESCAPE '!'
         ORDER BY
           CASE
             WHEN t.title = @query COLLATE NOCASE THEN 0
             WHEN t.title LIKE @prefix ESCAPE '!' THEN 1
             WHEN t.title LIKE @pattern ESCAPE '!' THEN 2
             WHEN p.name LIKE @pattern ESCAPE '!' THEN 3
             WHEN t.client LIKE @pattern ESCAPE '!' THEN 4
             ELSE 5
           END,
           CASE WHEN t.status = 'done' THEN 1 ELSE 0 END,
           t.updated_at DESC
         LIMIT @limit`
      )
      .all({ pattern, prefix, query, limit: safeLimit }) as TaskRow[]
    return this.withScreenshots(rows)
  }

  counts(today: string, projectId: string | null = null): TaskCounts {
    const projectClause = projectId ? ' WHERE project_id = @projectId' : ''
    const params: Record<string, unknown> = projectId ? { today, projectId } : { today }
    const row = this.db
      .prepare(
        `SELECT
          COALESCE(SUM(CASE WHEN status = 'todo' AND due_date IS NOT NULL AND due_date <= @today THEN 1 ELSE 0 END), 0) AS today,
          COALESCE(SUM(CASE WHEN status IN ('todo','in_progress','suspended') THEN 1 ELSE 0 END), 0) AS all_open,
          COALESCE(SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END), 0) AS in_progress,
          COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) AS completed,
          COALESCE(SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END), 0) AS suspended
        FROM tasks${projectClause}`
      )
      .get(params) as TaskCounts
    return row
  }

  get(id: string): Task | null {
    const row = this.getRow(id)
    if (!row) return null
    return this.withScreenshots([row])[0] ?? null
  }

  getRow(id: string): TaskRow | null {
    return (
      (this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined) ??
      null
    )
  }

  insert(row: TaskRow): void {
    this.db
      .prepare(
        `INSERT INTO tasks (
          id, title, content, client, notes, project_id, due_date, due_time, status,
          status_before_suspend, status_before_done, started_at, suspended_at,
          completed_at, created_at, updated_at
        ) VALUES (
          @id, @title, @content, @client, @notes, @project_id, @due_date, @due_time, @status,
          @status_before_suspend, @status_before_done, @started_at, @suspended_at,
          @completed_at, @created_at, @updated_at
        )`
      )
      .run(row)
  }

  update(
    id: string,
    fields: Partial<Omit<TaskRow, 'id' | 'created_at'>> & { updated_at: string }
  ): void {
    const allowed = new Set<keyof TaskRow>([
      'title',
      'content',
      'client',
      'notes',
      'project_id',
      'due_date',
      'due_time',
      'status',
      'status_before_suspend',
      'status_before_done',
      'started_at',
      'suspended_at',
      'completed_at',
      'updated_at'
    ])
    const entries = Object.entries(fields).filter(([key]) => allowed.has(key as keyof TaskRow))
    if (entries.length === 0) return
    const setters = entries.map(([key]) => `${key} = @${key}`).join(', ')
    this.db
      .prepare(`UPDATE tasks SET ${setters} WHERE id = @id`)
      .run({ ...Object.fromEntries(entries), id })
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  }

  listScreenshots(taskId: string): ScreenshotMeta[] {
    const rows = this.db
      .prepare('SELECT * FROM screenshots WHERE task_id = ? ORDER BY created_at ASC')
      .all(taskId) as ScreenshotRow[]
    return rows.map(mapScreenshotRow)
  }

  insertScreenshot(row: ScreenshotRow): ScreenshotMeta {
    this.db
      .prepare(
        `INSERT INTO screenshots (id, task_id, file_name, thumb_name, mime_type, width, height, created_at)
         VALUES (@id, @task_id, @file_name, @thumb_name, @mime_type, @width, @height, @created_at)`
      )
      .run(row)
    return mapScreenshotRow(row)
  }

  getScreenshot(id: string): ScreenshotRow | null {
    return (
      (this.db.prepare('SELECT * FROM screenshots WHERE id = ?').get(id) as
        | ScreenshotRow
        | undefined) ?? null
    )
  }

  listScreenshotsForTask(taskId: string): ScreenshotRow[] {
    return this.db
      .prepare('SELECT * FROM screenshots WHERE task_id = ? ORDER BY created_at ASC')
      .all(taskId) as ScreenshotRow[]
  }

  deleteScreenshot(id: string): void {
    this.db.prepare('DELETE FROM screenshots WHERE id = ?').run(id)
  }

  listDueSummary(today: string): TaskRow[] {
    return this.db
      .prepare(
        `SELECT * FROM tasks
         WHERE status IN ('todo','in_progress')
           AND due_date IS NOT NULL
           AND due_date <= ?
         ${ACTIVE_ORDER}`
      )
      .all(today) as TaskRow[]
  }

  listDueTimeCandidates(today: string, time: string): TaskRow[] {
    return this.db
      .prepare(
        `SELECT * FROM tasks
         WHERE status IN ('todo','in_progress')
           AND due_date = ?
           AND due_time IS NOT NULL
           AND due_time <= ?
         ORDER BY due_time ASC`
      )
      .all(today, time) as TaskRow[]
  }

  listBallTop(limit = 3): TaskRow[] {
    return this.db
      .prepare(
        `SELECT * FROM tasks
         WHERE status IN ('todo','in_progress')
           AND due_date IS NOT NULL
         ${ACTIVE_ORDER}
         LIMIT ?`
      )
      .all(limit) as TaskRow[]
  }

  hasNotification(key: string): boolean {
    const row = this.db
      .prepare('SELECT 1 AS found FROM notification_log WHERE key = ?')
      .get(key) as { found: number } | undefined
    return Boolean(row)
  }

  markNotification(key: string, firedAt: string): void {
    this.db
      .prepare(
        'INSERT INTO notification_log (key, fired_at) VALUES (?, ?) ON CONFLICT(key) DO NOTHING'
      )
      .run(key, firedAt)
  }

  private withScreenshots(rows: TaskRow[]): Task[] {
    if (rows.length === 0) return []
    const taskIds = rows.map((row) => row.id)
    const placeholders = taskIds.map(() => '?').join(',')
    const screenshotRows = this.db
      .prepare(
        `SELECT * FROM screenshots WHERE task_id IN (${placeholders}) ORDER BY created_at ASC`
      )
      .all(...taskIds) as ScreenshotRow[]
    const byTask = new Map<string, ScreenshotMeta[]>()
    for (const shot of screenshotRows) {
      const list = byTask.get(shot.task_id) ?? []
      list.push(mapScreenshotRow(shot))
      byTask.set(shot.task_id, list)
    }
    return rows.map((row) => mapTaskRow(row, byTask.get(row.id) ?? []))
  }
}
