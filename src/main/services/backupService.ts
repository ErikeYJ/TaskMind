import { app, dialog } from 'electron'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { AppDatabase } from '../db/database'
import type { MainWindowManager } from '../windows/mainWindow'
import type { MediaService } from './mediaService'
import type { SettingsService } from './settingsService'
import type { BackupResult, ImportResult } from '../../shared/types'
import {
  extractBackupZip,
  validateBackupDatabase,
  writeBackupZip
} from './backupArchive'

function timestampForFile(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
}

export class BackupService {
  constructor(
    private readonly db: AppDatabase,
    private readonly settings: SettingsService,
    private readonly media: MediaService,
    private readonly mainWindow: MainWindowManager
  ) {}

  async exportBackup(): Promise<BackupResult> {
    const parent = this.mainWindow.getWindow() ?? undefined
    const defaultName = `TaskMind-backup-${timestampForFile()}.zip`
    let defaultPath: string
    try {
      defaultPath = join(app.getPath('documents'), defaultName)
    } catch {
      defaultPath = join(this.settings.getDataDir(), defaultName)
    }

    const result = parent
      ? await dialog.showSaveDialog(parent, {
          title: '导出 TaskMind 备份',
          defaultPath,
          filters: [{ name: 'Zip 备份', extensions: ['zip'] }]
        })
      : await dialog.showSaveDialog({
          title: '导出 TaskMind 备份',
          defaultPath,
          filters: [{ name: 'Zip 备份', extensions: ['zip'] }]
        })

    if (result.canceled || !result.filePath) {
      return { ok: false, message: '已取消导出' }
    }

    const tempDbPath = join(this.settings.getDataDir(), `backup-${randomUUID()}.db`)
    try {
      await this.db.backup(tempDbPath)
      await writeBackupZip(
        result.filePath,
        tempDbPath,
        this.media.imagesDir,
        this.settings.getStoredForBackup()
      )
      return { ok: true, path: result.filePath, message: '备份已导出' }
    } catch (error) {
      return {
        ok: false,
        message: `导出失败：${error instanceof Error ? error.message : '未知错误'}`
      }
    } finally {
      await rm(tempDbPath, { force: true })
      await rm(`${tempDbPath}-wal`, { force: true })
      await rm(`${tempDbPath}-shm`, { force: true })
    }
  }

  async importBackup(): Promise<ImportResult> {
    const parent = this.mainWindow.getWindow() ?? undefined
    const result = parent
      ? await dialog.showOpenDialog(parent, {
          title: '选择 TaskMind 备份',
          properties: ['openFile'],
          filters: [{ name: 'Zip 备份', extensions: ['zip'] }]
        })
      : await dialog.showOpenDialog({
          title: '选择 TaskMind 备份',
          properties: ['openFile'],
          filters: [{ name: 'Zip 备份', extensions: ['zip'] }]
        })

    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, message: '已取消导入' }
    }

    const zipPath = result.filePaths[0]
    const stagingDir = join(this.settings.getDataDir(), 'imports', randomUUID())
    await mkdir(stagingDir, { recursive: true })

    try {
      await extractBackupZip(zipPath, stagingDir)
      const dbPath = join(stagingDir, 'taskmind.db')
      const settingsPath = join(stagingDir, 'settings.json')
      if (!existsSync(dbPath) || !existsSync(settingsPath)) {
        throw new Error('备份包缺少 taskmind.db 或 settings.json')
      }
      validateBackupDatabase(dbPath)
      const rawSettings = JSON.parse(await readFile(settingsPath, 'utf8'))
      if (!rawSettings || typeof rawSettings !== 'object') {
        throw new Error('备份设置文件无效')
      }
      const imagesDir = join(stagingDir, 'images')
      if (existsSync(imagesDir)) {
        const info = await stat(imagesDir)
        if (!info.isDirectory()) throw new Error('备份图片目录无效')
      }

      const confirmation = parent
        ? await dialog.showMessageBox(parent, {
            type: 'warning',
            title: '导入备份',
            message: '导入会替换当前任务、项目和截图数据。',
            detail:
              '当前数据会先自动备份到数据目录下的 pre-import-* 文件夹。API Key 不会从备份恢复，本机已保存的 Key 会保留。',
            buttons: ['取消', '导入并重启'],
            defaultId: 0,
            cancelId: 0,
            noLink: true
          })
        : await dialog.showMessageBox({
            type: 'warning',
            title: '导入备份',
            message: '导入会替换当前任务、项目和截图数据。',
            detail:
              '当前数据会先自动备份到数据目录下的 pre-import-* 文件夹。API Key 不会从备份恢复，本机已保存的 Key 会保留。',
            buttons: ['取消', '导入并重启'],
            defaultId: 0,
            cancelId: 0,
            noLink: true
          })

      if (confirmation.response !== 1) {
        await rm(stagingDir, { recursive: true, force: true })
        return { ok: false, message: '已取消导入' }
      }

      await writeFile(
        join(this.settings.getDataDir(), 'pending-import.json'),
        JSON.stringify(
          { sourceDir: stagingDir, requestedAt: new Date().toISOString() },
          null,
          2
        ),
        'utf8'
      )

      const infoParent = this.mainWindow.getWindow() ?? undefined
      if (infoParent) {
        await dialog.showMessageBox(infoParent, {
          type: 'info',
          title: '导入准备完成',
          message: '应用将重启并应用备份。',
          buttons: ['确定'],
          noLink: true
        })
      } else {
        await dialog.showMessageBox({
          type: 'info',
          title: '导入准备完成',
          message: '应用将重启并应用备份。',
          buttons: ['确定'],
          noLink: true
        })
      }

      setTimeout(() => {
        app.relaunch()
        app.exit(0)
      }, 250)

      return { ok: true, message: '导入准备完成，应用即将重启', restartRequired: true }
    } catch (error) {
      await rm(stagingDir, { recursive: true, force: true })
      return {
        ok: false,
        message: `导入失败：${error instanceof Error ? error.message : '未知错误'}`
      }
    }
  }
}
