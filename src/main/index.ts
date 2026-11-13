import { app, dialog, nativeTheme, protocol, screen } from 'electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { configureUserDataPath } from './appPaths'
import { openDatabase, type AppDatabase } from './db/database'
import { registerIpc } from './ipc/registerIpc'
import { AiService } from './services/aiService'
import { applyAutostart, isStartHidden } from './services/autostart'
import { BackupService, createPreMigrationBackupIfNeeded } from './services/backupService'
import { MediaService } from './services/mediaService'
import { applyPendingImport } from './services/pendingImport'
import { ProjectService } from './services/projectService'
import { ReminderService } from './services/reminderService'
import { SettingsService } from './services/settingsService'
import { TaskService } from './services/taskService'
import { UndoService } from './services/undoService'
import { TrayService } from './services/trayService'
import { BallWindowManager } from './windows/ballWindow'
import { MainWindowManager } from './windows/mainWindow'
import { IPC } from '../shared/api'
import { APP_ID } from '../shared/constants'

app.setName('TaskMind')
const userDataDir = configureUserDataPath()
app.setAppUserModelId(APP_ID)

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'taskmind-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true
    }
  }
])

let db: AppDatabase | null = null
let settings: SettingsService | null = null
let media: MediaService | null = null
let tasks: TaskService | null = null
let mainWindow: MainWindowManager | null = null
let ballWindow: BallWindowManager | null = null
let tray: TrayService | null = null
let reminders: ReminderService | null = null
let backup: BackupService | null = null
let undo: UndoService | null = null
let isQuitting = false

function quitApp(): void {
  isQuitting = true
  mainWindow?.setQuitting(true)
  reminders?.stop()
  backup?.stopAutoBackups()
  void undo?.dispose()
  app.quit()
}

function refreshBall(): void {
  if (!tasks || !ballWindow) return
  ballWindow.send(IPC.events.ballData, tasks.getBallTop())
}

async function registerMediaProtocol(): Promise<void> {
  protocol.handle('taskmind-media', async (request) => {
    try {
      if (!tasks || !media) {
        return new Response('Service unavailable', { status: 503 })
      }
      const url = new URL(request.url)
      const kind = url.hostname.toLowerCase()
      if (kind !== 'screenshot' && kind !== 'thumb') {
        return new Response('Not found', { status: 404 })
      }
      const id = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
      if (!id || id.length > 100) {
        return new Response('Not found', { status: 404 })
      }
      const row = tasks.getScreenshotRow(id)
      if (!row) return new Response('Not found', { status: 404 })
      const fileName = kind === 'thumb' && row.thumb_name ? row.thumb_name : row.file_name
      const fullPath = media.resolveImagePath(fileName)
      if (!fullPath) return new Response('Not found', { status: 404 })
      const buffer = await readFile(fullPath)
      const mimeType =
        kind === 'thumb' && row.thumb_name ? 'image/jpeg' : row.mime_type || 'application/octet-stream'
      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'no-cache'
        }
      })
    } catch {
      return new Response('Error', { status: 500 })
    }
  })
}

async function bootstrap(): Promise<void> {
  await app.whenReady()

  const importResult = await applyPendingImport(userDataDir)
  let importError: string | null = null
  if (importResult.error) {
    importError = importResult.error
    console.error('[TaskMind] pending import failed:', importResult.error)
  }

  const settingsService = new SettingsService(userDataDir)
  settings = settingsService
  try {
    const preMigrationBackup = await createPreMigrationBackupIfNeeded(
      settingsService,
      join(userDataDir, 'taskmind.db')
    )
    if (preMigrationBackup) {
      console.log('[TaskMind] pre-migration backup created:', preMigrationBackup)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    console.error('[TaskMind] pre-migration backup failed:', error)
    settingsService.updateBackupStatus({
      lastBackupError: `升级前备份失败：${message}`
    })
  }
  db = openDatabase(join(userDataDir, 'taskmind.db'))
  media = new MediaService(userDataDir)
  tasks = new TaskService(db, media)
  const projects = new ProjectService(db)
  const undoService = new UndoService(tasks, projects)
  undo = undoService
  const ai = new AiService(settings, media)

  await registerMediaProtocol()

  mainWindow = new MainWindowManager(settings)
  const publicSettings = settings.getPublic()
  const startHidden = isStartHidden() && publicSettings.onboardingCompleted
  mainWindow.create(startHidden)

  ballWindow = new BallWindowManager(settings, mainWindow, {
    isQuitting: () => isQuitting,
    onQuit: quitApp
  })
  ballWindow.create()

  tray = new TrayService(settings, mainWindow, ballWindow, quitApp)
  tray.create()

  reminders = new ReminderService(settings, tasks, mainWindow, (today) => {
    mainWindow?.send(IPC.events.dayChanged, today)
    ballWindow?.send(IPC.events.dayChanged, today)
    refreshBall()
  })
  reminders.start()

  const backupService = new BackupService(db, settings, media, mainWindow)
  backup = backupService
  backupService.startAutoBackups()

  nativeTheme.themeSource = publicSettings.theme
  applyAutostart(publicSettings.autostart)
  let lastBallVisible = publicSettings.ball.visible
  let lastBallSize = publicSettings.ball.size
  let lastBallDock = publicSettings.ball.dock
  let lastAutoBackupEnabled = publicSettings.backup.autoEnabled
  let lastBackupKeepCount = publicSettings.backup.keepCount

  settings.onChanged((updated) => {
    nativeTheme.themeSource = updated.theme
    applyAutostart(updated.autostart)
    if (updated.ball.visible !== lastBallVisible) {
      ballWindow?.setVisible(updated.ball.visible)
      lastBallVisible = updated.ball.visible
    }
    if (updated.ball.size !== lastBallSize || updated.ball.dock !== lastBallDock) {
      lastBallSize = updated.ball.size
      lastBallDock = updated.ball.dock
      ballWindow?.updateSize()
    }
    if (updated.backup.autoEnabled !== lastAutoBackupEnabled) {
      lastAutoBackupEnabled = updated.backup.autoEnabled
      if (updated.backup.autoEnabled) {
        void backupService.maybeRunDailyBackup()
      }
    }
    if (updated.backup.keepCount !== lastBackupKeepCount) {
      lastBackupKeepCount = updated.backup.keepCount
      void backupService.pruneAutoBackups()
    }
    tray?.refresh()
    mainWindow?.send(IPC.events.settingsChanged, updated)
    ballWindow?.send(IPC.events.settingsChanged, updated)
  })

  tasks.onChanged(() => {
    mainWindow?.send(IPC.events.tasksChanged)
    refreshBall()
  })

  projects.onChanged(() => {
    mainWindow?.send(IPC.events.projectsChanged)
  })

  registerIpc({
    db,
    settings,
    tasks,
    projects,
    ai,
    media,
    mainWindow,
    ballWindow,
    reminders,
    backup: backupService,
    undo: undoService,
    onQuit: quitApp
  })

  screen.on('display-removed', () => {
    mainWindow?.ensureVisible()
    ballWindow?.ensureVisible()
  })
  screen.on('display-metrics-changed', () => {
    mainWindow?.ensureVisible()
    ballWindow?.ensureVisible()
  })

  if (importError) {
    setTimeout(() => {
      dialog.showErrorBox('导入失败', importError ?? '未知错误')
    }, 800)
  }

  refreshBall()
}

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    mainWindow?.show()
  })

  app.on('before-quit', () => {
    isQuitting = true
    mainWindow?.setQuitting(true)
    reminders?.stop()
    backup?.stopAutoBackups()
    void undo?.dispose()
    mainWindow?.saveStateNow()
  })

  app.on('will-quit', () => {
    reminders?.stop()
    tray?.destroy()
    ballWindow?.destroy()
    try {
      db?.close()
    } catch {
      // ignore
    }
    db = null
  })

  app.on('window-all-closed', () => {
    // 常驻托盘：不因为窗口关闭而退出
  })

  app.on('activate', () => {
    mainWindow?.show()
  })

  void bootstrap().catch((error) => {
    console.error('[TaskMind] startup failed:', error)
    dialog.showErrorBox(
      'TaskMind 启动失败',
      error instanceof Error ? error.message : '未知错误'
    )
    app.quit()
  })
}
