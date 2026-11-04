import { existsSync } from 'node:fs'
import {
  copyFile,
  cp,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile
} from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'

interface PendingImportMarker {
  sourceDir: string
  requestedAt: string
}

export interface PendingImportResult {
  applied: boolean
  error?: string
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await readFile(path)
    return true
  } catch {
    return false
  }
}

async function moveIfExists(source: string, destination: string): Promise<void> {
  if (!existsSync(source)) return
  await rename(source, destination)
}

/**
 * 在应用启动、数据库打开之前应用待导入备份。
 * 当前数据会先移动到 pre-import-<timestamp>/ 目录，方便失败回滚。
 */
export async function applyPendingImport(userDataDir: string): Promise<PendingImportResult> {
  const markerPath = join(userDataDir, 'pending-import.json')
  if (!existsSync(markerPath)) return { applied: false }

  let marker: PendingImportMarker
  try {
    const raw = JSON.parse(await readFile(markerPath, 'utf8')) as PendingImportMarker
    marker = raw
  } catch {
    await rm(markerPath, { force: true })
    return { applied: false, error: '导入标记损坏，已忽略' }
  }

  const importsRoot = resolve(userDataDir, 'imports')
  const sourceDir = resolve(marker.sourceDir || '')
  const rel = relative(importsRoot, sourceDir)
  if (rel.startsWith('..') || rel.startsWith(sep) || !sourceDir.startsWith(importsRoot)) {
    await rm(markerPath, { force: true })
    return { applied: false, error: '导入目录无效，已取消' }
  }

  const sourceDb = join(sourceDir, 'taskmind.db')
  const sourceSettings = join(sourceDir, 'settings.json')
  if (!existsSync(sourceDb) || !existsSync(sourceSettings)) {
    await rm(markerPath, { force: true })
    return { applied: false, error: '导入包缺少数据库或设置文件' }
  }

  let oldSettings: Record<string, unknown> = {}
  try {
    oldSettings = JSON.parse(await readFile(join(userDataDir, 'settings.json'), 'utf8')) as Record<
      string,
      unknown
    >
  } catch {
    oldSettings = {}
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = join(userDataDir, `pre-import-${stamp}`)
  await mkdir(backupDir, { recursive: true })

  const items = ['taskmind.db', 'taskmind.db-wal', 'taskmind.db-shm', 'settings.json', 'images']
  try {
    for (const item of items) {
      await moveIfExists(join(userDataDir, item), join(backupDir, item))
    }

    await copyFile(sourceDb, join(userDataDir, 'taskmind.db'))
    await copyFile(sourceSettings, join(userDataDir, 'settings.json'))

    const sourceImages = join(sourceDir, 'images')
    if (existsSync(sourceImages)) {
      await cp(sourceImages, join(userDataDir, 'images'), { recursive: true, force: true })
    } else {
      await mkdir(join(userDataDir, 'images'), { recursive: true })
    }

    // 恢复当前机器的 API Key 和开机自启偏好；备份包本身不包含 Key。
    try {
      const imported = JSON.parse(
        await readFile(join(userDataDir, 'settings.json'), 'utf8')
      ) as Record<string, unknown>
      if (
        typeof oldSettings.encryptedApiKey === 'string' &&
        oldSettings.encryptedApiKey &&
        typeof imported.encryptedApiKey !== 'string'
      ) {
        imported.encryptedApiKey = oldSettings.encryptedApiKey
      }
      if (typeof oldSettings.autostart === 'boolean') {
        imported.autostart = oldSettings.autostart
      }
      await writeFile(
        join(userDataDir, 'settings.json'),
        JSON.stringify(imported, null, 2),
        'utf8'
      )
    } catch {
      // 保留导入包里的设置即可
    }

    await rm(markerPath, { force: true })
    await rm(sourceDir, { recursive: true, force: true })
    return { applied: true }
  } catch (error) {
    // 尝试回滚
    try {
      await rm(join(userDataDir, 'taskmind.db'), { force: true })
      await rm(join(userDataDir, 'settings.json'), { force: true })
      await rm(join(userDataDir, 'images'), { recursive: true, force: true })
      for (const item of items) {
        await moveIfExists(join(backupDir, item), join(userDataDir, item))
      }
    } catch {
      // 回滚失败时保留 backupDir 供手动恢复
    }
    await rm(markerPath, { force: true })
    return {
      applied: false,
      error: error instanceof Error ? error.message : '导入应用失败'
    }
  }
}

export async function hasPendingImport(userDataDir: string): Promise<boolean> {
  return pathExists(join(userDataDir, 'pending-import.json'))
}
