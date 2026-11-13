import { readdir, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'

export function localDayKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isAutoBackupDue(lastBackupAt: string | null, now = new Date()): boolean {
  if (!lastBackupAt) return true
  const last = new Date(lastBackupAt)
  if (Number.isNaN(last.getTime())) return true
  return localDayKey(last) !== localDayKey(now)
}

export async function pruneBackupFiles(
  directory: string,
  prefix: string,
  keepCount: number
): Promise<string[]> {
  const keep = Math.min(100, Math.max(1, Math.trunc(keepCount)))
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch {
    return []
  }

  const files = entries.filter(
    (entry) => entry.isFile() && entry.name.startsWith(prefix) && entry.name.endsWith('.zip')
  )
  const withTimes = await Promise.all(
    files.map(async (entry) => {
      const path = join(directory, entry.name)
      try {
        const info = await stat(path)
        return { name: entry.name, path, mtimeMs: info.mtimeMs }
      } catch {
        return null
      }
    })
  )

  const ordered = withTimes
    .filter((item): item is { name: string; path: string; mtimeMs: number } => item !== null)
    .sort((a, b) => b.mtimeMs - a.mtimeMs || b.name.localeCompare(a.name))

  const deleted: string[] = []
  for (const item of ordered.slice(keep)) {
    try {
      await unlink(item.path)
      deleted.push(item.name)
    } catch {
      // A failed cleanup should not fail the backup that was just created.
    }
  }
  return deleted
}
