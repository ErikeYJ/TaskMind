import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  isAutoBackupDue,
  localDayKey,
  pruneBackupFiles
} from '../src/main/services/backupPolicy'

let tempDir: string | null = null

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true })
  tempDir = null
})

describe('backup policy', () => {
  it('treats a day without a backup as due', () => {
    const now = new Date(2026, 10, 10, 9, 30)
    expect(isAutoBackupDue(null, now)).toBe(true)
    expect(isAutoBackupDue(new Date(2026, 10, 10, 8, 0).toISOString(), now)).toBe(false)
    expect(isAutoBackupDue(new Date(2026, 10, 9, 23, 59).toISOString(), now)).toBe(true)
    expect(localDayKey(now)).toBe('2026-11-10')
  })

  it('prunes only matching backups beyond the retention count', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'taskmind-backup-policy-'))
    const names = ['TaskMind-auto-3.zip', 'TaskMind-auto-2.zip', 'TaskMind-auto-1.zip']
    for (let i = 0; i < names.length; i += 1) {
      const path = join(tempDir, names[i])
      writeFileSync(path, `backup-${i}`)
      const time = new Date(2026, 10, 10, 9, i)
      utimesSync(path, time, time)
    }
    writeFileSync(join(tempDir, 'TaskMind-pre-migration-v1.zip'), 'keep me')
    writeFileSync(join(tempDir, 'other.zip'), 'keep me too')

    const deleted = await pruneBackupFiles(tempDir, 'TaskMind-auto-', 2)
    expect(deleted).toEqual(['TaskMind-auto-3.zip'])
    const remaining = await import('node:fs/promises').then((fs) => fs.readdir(tempDir!))
    expect(remaining.sort()).toEqual([
      'TaskMind-auto-1.zip',
      'TaskMind-auto-2.zip',
      'TaskMind-pre-migration-v1.zip',
      'other.zip'
    ])
  })
})
