import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase, type AppDatabase } from '../src/main/db/database'
import { ProjectService } from '../src/main/services/projectService'
import { TaskService, type TaskMedia } from '../src/main/services/taskService'
import type { SavedImage } from '../src/main/services/mediaService'

const LEGACY_SCHEMA = `
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  client TEXT,
  notes TEXT NOT NULL DEFAULT '',
  due_date TEXT,
  due_time TEXT,
  status TEXT NOT NULL CHECK (status IN ('todo','in_progress','suspended','done')),
  status_before_suspend TEXT,
  status_before_done TEXT,
  started_at TEXT,
  suspended_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE screenshots (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  thumb_name TEXT,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at TEXT NOT NULL
);
`

const noMedia: TaskMedia = {
  async saveImage(_dataUrl: string): Promise<SavedImage> {
    throw new Error('not used')
  },
  async deleteFiles(_fileName: string, _thumbName: string | null): Promise<void> {
    // no-op
  }
}

let tempDir: string | null = null
let db: AppDatabase | null = null

afterEach(() => {
  db?.close()
  db = null
  if (tempDir) rmSync(tempDir, { recursive: true, force: true })
  tempDir = null
})

describe('database migrations', () => {
  it('upgrades a v1 database with tasks to projects and nullable project_id', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'taskmind-migrate-'))
    const file = join(tempDir, 'taskmind.db')
    const legacy = new Database(file)
    legacy.exec(LEGACY_SCHEMA)
    legacy
      .prepare(
        `INSERT INTO tasks (
          id, title, content, client, notes, due_date, due_time, status,
          status_before_suspend, status_before_done, started_at, suspended_at,
          completed_at, created_at, updated_at
        ) VALUES (?, ?, '', NULL, '', NULL, NULL, 'todo', NULL, NULL, NULL, NULL, NULL, ?, ?)`
      )
      .run('legacy-task', '旧版任务', '2026-11-04T00:00:00.000Z', '2026-11-04T00:00:00.000Z')
    legacy.pragma('user_version = 1')
    legacy.close()

    db = openDatabase(file)
    expect(db.pragma('user_version', { simple: true })).toBe(2)
    const columns = db.prepare('PRAGMA table_info(tasks)').all() as Array<{ name: string }>
    expect(columns.some((column) => column.name === 'project_id')).toBe(true)

    const tasks = new TaskService(db, noMedia)
    const legacyTask = tasks.get('legacy-task')
    expect(legacyTask?.title).toBe('旧版任务')
    expect(legacyTask?.projectId).toBeNull()

    const projects = new ProjectService(db)
    const project = projects.create({ name: '升级后项目', color: '#2563eb' })
    const updated = tasks.update('legacy-task', { projectId: project.id })
    expect(updated.projectId).toBe(project.id)
    expect(tasks.list('all_open', project.id).map((task) => task.id)).toEqual(['legacy-task'])
  })
})
