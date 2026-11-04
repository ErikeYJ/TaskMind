import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export type AppDatabase = Database.Database

const SCHEMA_V1 = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tasks (
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

CREATE INDEX IF NOT EXISTS idx_tasks_status_due ON tasks(status, due_date, due_time);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date, due_time);

CREATE TABLE IF NOT EXISTS screenshots (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  thumb_name TEXT,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_screenshots_task ON screenshots(task_id);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_log (
  key TEXT PRIMARY KEY,
  fired_at TEXT NOT NULL
);
`

function migrate(db: AppDatabase): void {
  const version = db.pragma('user_version', { simple: true }) as number
  if (version < 1) {
    db.exec(SCHEMA_V1)
    db.pragma('user_version = 1')
  }
}

export function openDatabase(filePath: string): AppDatabase {
  mkdirSync(dirname(filePath), { recursive: true })
  const db = new Database(filePath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  migrate(db)
  return db
}
