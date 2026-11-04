import { describe, expect, it } from 'vitest'
import { readdir, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { applyPendingImport } from '../src/main/services/pendingImport'

describe('pending import', () => {
  it('replaces data, preserves the API key, and keeps a rollback copy', async () => {
    const root = await mkdtemp(join(tmpdir(), 'taskmind-pending-import-'))
    try {
      await writeFile(
        join(root, 'settings.json'),
        JSON.stringify({
          theme: 'light',
          autostart: true,
          encryptedApiKey: 'encrypted-key'
        }),
        'utf8'
      )
      await writeFile(join(root, 'taskmind.db'), 'old-db', 'utf8')
      await mkdir(join(root, 'images'), { recursive: true })
      await writeFile(join(root, 'images', 'old.png'), 'old-image', 'utf8')

      const sourceDir = join(root, 'imports', 'incoming')
      await mkdir(join(sourceDir, 'images'), { recursive: true })
      await writeFile(join(sourceDir, 'taskmind.db'), 'new-db', 'utf8')
      await writeFile(
        join(sourceDir, 'settings.json'),
        JSON.stringify({ theme: 'dark', autostart: false }),
        'utf8'
      )
      await writeFile(join(sourceDir, 'images', 'new.png'), 'new-image', 'utf8')
      await writeFile(
        join(root, 'pending-import.json'),
        JSON.stringify({ sourceDir, requestedAt: new Date().toISOString() }),
        'utf8'
      )

      const result = await applyPendingImport(root)
      expect(result.applied).toBe(true)

      expect(await readFile(join(root, 'taskmind.db'), 'utf8')).toBe('new-db')
      expect(await readFile(join(root, 'images', 'new.png'), 'utf8')).toBe('new-image')
      const settings = JSON.parse(await readFile(join(root, 'settings.json'), 'utf8')) as {
        theme: string
        autostart: boolean
        encryptedApiKey: string
      }
      expect(settings.theme).toBe('dark')
      expect(settings.autostart).toBe(true)
      expect(settings.encryptedApiKey).toBe('encrypted-key')

      const entries = await readdir(root)
      expect(entries.some((name) => name.startsWith('pre-import-'))).toBe(true)
      expect(entries.includes('pending-import.json')).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
