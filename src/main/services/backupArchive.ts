import * as archiverModule from 'archiver'
import type { Archiver } from 'archiver'
import Database from 'better-sqlite3'
import unzipper from 'unzipper'
import { createWriteStream, existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { pipeline } from 'node:stream/promises'

type ArchiverFactory = (format: string, options?: Record<string, unknown>) => Archiver

const moduleWithDefault = archiverModule as unknown as { default?: ArchiverFactory }
const createArchiver: ArchiverFactory =
  typeof moduleWithDefault.default === 'function'
    ? moduleWithDefault.default
    : (archiverModule as unknown as ArchiverFactory)

const MAX_IMPORT_BYTES = 2 * 1024 * 1024 * 1024 // 2GB

export async function writeBackupZip(
  destination: string,
  tempDbPath: string,
  imagesDir: string,
  settings: Record<string, unknown>
): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const output = createWriteStream(destination)
    const archive = createArchiver('zip', { zlib: { level: 9 } })
    let settled = false

    const finish = (error?: Error): void => {
      if (settled) return
      settled = true
      if (error) reject(error)
      else resolvePromise()
    }

    output.on('close', () => finish())
    output.on('error', (error: Error) => finish(error))
    archive.on('error', (error: Error) => finish(error))

    archive.pipe(output)
    archive.file(tempDbPath, { name: 'taskmind.db' })
    if (existsSync(imagesDir)) {
      archive.directory(imagesDir, 'images')
    }
    archive.append(JSON.stringify(settings, null, 2), { name: 'settings.json' })
    void archive.finalize().catch((error) => finish(error))
  })
}

function validateZipPath(entryPath: string): string {
  const normalized = entryPath.replace(/\\/g, '/').replace(/^\.\/+/, '')
  if (!normalized || normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
    throw new Error('备份包包含非法路径')
  }
  if (normalized.split('/').includes('..')) {
    throw new Error('备份包包含非法路径')
  }
  if (
    normalized !== 'taskmind.db' &&
    normalized !== 'settings.json' &&
    normalized !== 'images' &&
    !normalized.startsWith('images/')
  ) {
    throw new Error(`备份包包含不支持的文件：${normalized}`)
  }
  return normalized
}

export async function extractBackupZip(zipPath: string, destination: string): Promise<void> {
  const directory = await unzipper.Open.file(zipPath)
  const root = resolve(destination)
  let totalBytes = 0

  for (const entry of directory.files) {
    const normalized = validateZipPath(entry.path)
    if (entry.type !== 'File') continue
    const uncompressed =
      typeof entry.uncompressedSize === 'number' ? entry.uncompressedSize : 0
    totalBytes += uncompressed
    if (totalBytes > MAX_IMPORT_BYTES) {
      throw new Error('备份包过大，无法导入')
    }

    const target = resolve(root, normalized)
    if (target !== root && !target.startsWith(`${root}${sep}`)) {
      throw new Error('备份包包含非法路径')
    }
    await mkdir(dirname(target), { recursive: true })
    await pipeline(entry.stream(), createWriteStream(target))
  }
}

export function validateBackupDatabase(dbPath: string): void {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true })
  try {
    const version = db.pragma('user_version', { simple: true }) as number
    if (version < 1) throw new Error('备份数据库版本不受支持')
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tasks'")
      .get()
    if (!table) throw new Error('备份数据库缺少任务表')
  } finally {
    db.close()
  }
}
