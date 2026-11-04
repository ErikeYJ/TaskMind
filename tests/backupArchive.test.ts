import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from '../src/main/db/database'
import {
  extractBackupZip,
  validateBackupDatabase,
  writeBackupZip
} from '../src/main/services/backupArchive'

describe('backup archive', () => {
  it('writes and extracts a valid backup', async () => {
    const root = await mkdtemp(join(tmpdir(), 'taskmind-backup-test-'))
    try {
      const db = openDatabase(join(root, 'source.db'))
      const backupDb = join(root, 'taskmind.db')
      await db.backup(backupDb)
      db.close()

      const imagesDir = join(root, 'images')
      await mkdir(join(imagesDir, '2026', '11'), { recursive: true })
      await writeFile(join(imagesDir, '2026', '11', 'shot.png'), Buffer.from('fake-image'))

      const zipPath = join(root, 'backup.zip')
      await writeBackupZip(zipPath, backupDb, imagesDir, { theme: 'light' })
      expect(existsSync(zipPath)).toBe(true)

      const outputDir = join(root, 'output')
      await mkdir(outputDir, { recursive: true })
      await extractBackupZip(zipPath, outputDir)

      expect(existsSync(join(outputDir, 'taskmind.db'))).toBe(true)
      expect(existsSync(join(outputDir, 'settings.json'))).toBe(true)
      validateBackupDatabase(join(outputDir, 'taskmind.db'))

      const settings = JSON.parse(
        await readFile(join(outputDir, 'settings.json'), 'utf8')
      ) as { theme: string }
      expect(settings.theme).toBe('light')

      const image = await readFile(
        join(outputDir, 'images', '2026', '11', 'shot.png'),
        'utf8'
      )
      expect(image).toBe('fake-image')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects a file that is not a TaskMind database', async () => {
    const root = await mkdtemp(join(tmpdir(), 'taskmind-backup-invalid-'))
    try {
      const invalid = join(root, 'invalid.db')
      await writeFile(invalid, 'not a database', 'utf8')
      expect(() => validateBackupDatabase(invalid)).toThrow()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
