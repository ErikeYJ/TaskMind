import Database from 'better-sqlite3'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import unzipper from 'unzipper'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => '' },
  dialog: {},
  shell: { openPath: async () => '' }
}))

import { createPreMigrationBackupIfNeeded } from '../src/main/services/backupService'
import type { SettingsService } from '../src/main/services/settingsService'

let tempDir: string | null = null

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true })
  tempDir = null
})

describe('pre-migration backup', () => {
  it('creates a zip before an old database is migrated', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'taskmind-pre-migration-'))
    const dbPath = join(tempDir, 'taskmind.db')
    const db = new Database(dbPath)
    db.exec('CREATE TABLE tasks (id TEXT PRIMARY KEY);')
    db.pragma('user_version = 1')
    db.close()

    const imagesDir = join(tempDir, 'images')
    mkdirSync(imagesDir, { recursive: true })
    writeFileSync(join(imagesDir, 'demo.png'), 'demo')

    const settings = {
      getDataDir: () => tempDir!,
      getImagesDir: () => imagesDir,
      getStoredForBackup: () => ({ theme: 'system' })
    } as unknown as SettingsService

    const backupPath = await createPreMigrationBackupIfNeeded(settings, dbPath)
    expect(backupPath).toBeTruthy()
    expect(existsSync(backupPath!)).toBe(true)

    const archive = await unzipper.Open.file(backupPath!)
    const names = archive.files.map((entry) => entry.path)
    expect(names).toContain('taskmind.db')
    expect(names).toContain('settings.json')
    expect(names).toContain('images/demo.png')

    const current = new Database(dbPath)
    current.pragma('user_version = 2')
    current.close()
    expect(await createPreMigrationBackupIfNeeded(settings, dbPath)).toBeNull()
  })
})
