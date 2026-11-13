import { app, ipcMain, shell } from 'electron'
import { IPC } from '../../shared/api'
import { APP_NAME, APP_VERSION } from '../../shared/constants'
import {
  addScreenshotSchema,
  aiExtractInputSchema,
  apiKeySchema,
  ballExpandedSchema,
  createProjectInputSchema,
  createTaskInputSchema,
  projectIdFilterSchema,
  projectIdSchema,
  screenshotIdSchema,
  searchTasksSchema,
  suggestProjectInputSchema,
  settingsPatchSchema,
  taskActionSchema,
  taskIdSchema,
  taskViewSchema,
  transitionTaskSchema,
  undoTokenSchema,
  updateProjectInputSchema,
  updateTaskInputSchema
} from '../../shared/schemas'
import type { AppDatabase } from '../db/database'
import type { AiService } from '../services/aiService'
import type { BackupService } from '../services/backupService'
import type { MediaService } from '../services/mediaService'
import type { ProjectService } from '../services/projectService'
import type { ReminderService } from '../services/reminderService'
import type { SettingsService } from '../services/settingsService'
import type { TaskService } from '../services/taskService'
import type { UndoService } from '../services/undoService'
import type { BallWindowManager } from '../windows/ballWindow'
import type { MainWindowManager } from '../windows/mainWindow'

export interface IpcContext {
  db: AppDatabase
  settings: SettingsService
  tasks: TaskService
  projects: ProjectService
  ai: AiService
  media: MediaService
  mainWindow: MainWindowManager
  ballWindow: BallWindowManager
  reminders: ReminderService
  backup: BackupService
  undo: UndoService
  onQuit: () => void
}

function handle(
  channel: string,
  handler: (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => unknown
): void {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, handler)
}

export function registerIpc(context: IpcContext): void {
  const { tasks, projects, ai, settings, ballWindow, mainWindow, reminders, backup, undo } = context

  handle(IPC.tasksList, (_event, view, projectId) => {
    return tasks.list(
      taskViewSchema.parse(view),
      projectIdFilterSchema.parse(projectId) ?? null
    )
  })

  handle(IPC.tasksCounts, (_event, projectId) => {
    return tasks.counts(projectIdFilterSchema.parse(projectId) ?? null)
  })

  handle(IPC.tasksSearch, (_event, query) => {
    return tasks.search(searchTasksSchema.parse({ query }).query)
  })

  handle(IPC.tasksSuggestProject, (_event, input) => {
    return tasks.suggestProject(suggestProjectInputSchema.parse(input))
  })

  handle(IPC.projectsList, () => projects.list())

  handle(IPC.projectsCreate, (_event, input) => {
    return projects.create(createProjectInputSchema.parse(input))
  })

  handle(IPC.projectsUpdate, (_event, id, patch) => {
    return projects.update(
      projectIdSchema.shape.id.parse(id),
      updateProjectInputSchema.parse(patch)
    )
  })

  handle(IPC.projectsDelete, (_event, id) => {
    return undo.deleteProject(projectIdSchema.shape.id.parse(id))
  })

  handle(IPC.tasksGet, (_event, id) => {
    return tasks.get(taskIdSchema.shape.id.parse(id))
  })

  handle(IPC.tasksCreate, (_event, input) => {
    return tasks.create(createTaskInputSchema.parse(input))
  })

  handle(IPC.tasksUpdate, (_event, id, patch) => {
    const parsedId = taskIdSchema.shape.id.parse(id)
    return tasks.update(parsedId, updateTaskInputSchema.parse(patch))
  })

  handle(IPC.tasksTransition, (_event, id, action) => {
    const parsed = transitionTaskSchema.parse({ id, action: taskActionSchema.parse(action) })
    return tasks.transition(parsed.id, parsed.action)
  })

  handle(IPC.tasksDelete, (_event, id) => {
    return undo.deleteTask(taskIdSchema.shape.id.parse(id))
  })

  handle(IPC.tasksAddScreenshot, (_event, taskId, input) => {
    const parsed = addScreenshotSchema.parse({
      taskId,
      dataUrl: (input as { dataUrl?: unknown } | undefined)?.dataUrl,
      fileName: (input as { fileName?: unknown } | undefined)?.fileName
    })
    return tasks.addScreenshot(parsed.taskId, parsed.dataUrl)
  })

  handle(IPC.tasksDeleteScreenshot, (_event, id) => {
    return tasks.deleteScreenshot(screenshotIdSchema.shape.id.parse(id))
  })

  handle(IPC.aiExtract, (_event, imageDataUrls) => {
    const parsed = aiExtractInputSchema.parse({ imageDataUrls })
    return ai.extract(parsed.imageDataUrls)
  })

  handle(IPC.aiTestConnection, () => ai.testConnection())

  handle(IPC.aiSetApiKey, (_event, key) => {
    const parsed = apiKeySchema.parse({ key })
    return settings.setApiKey(parsed.key)
  })

  handle(IPC.settingsGet, () => settings.getPublic())

  handle(IPC.settingsUpdate, (_event, patch) => {
    return settings.update(settingsPatchSchema.parse(patch))
  })

  handle(IPC.notificationsTest, () => reminders.testNotification())

  handle(IPC.ballGetTop, () => tasks.getBallTop())

  handle(IPC.ballGetLayout, () => ballWindow.getLayout())

  handle(IPC.ballSetExpanded, (_event, expanded) => {
    return ballWindow.setExpanded(ballExpandedSchema.parse({ expanded }).expanded)
  })

  handle(IPC.ballDragStart, () => {
    ballWindow.dragStart()
  })

  handle(IPC.ballDragEnd, () => {
    return ballWindow.dragEnd()
  })

  handle(IPC.ballOpenTask, (_event, id) => {
    const parsed = taskIdSchema.shape.id.parse(id)
    mainWindow.show()
    mainWindow.send(IPC.events.navigateTask, parsed)
    ballWindow.bringToFront()
  })

  handle(IPC.ballOpenMain, () => {
    ballWindow.openMain()
  })

  handle(IPC.ballContextMenu, () => {
    ballWindow.contextMenu()
  })

  handle(IPC.ballResetPosition, () => {
    ballWindow.resetPosition()
  })

  handle(IPC.backupExport, () => backup.exportBackup())

  handle(IPC.backupImport, () => backup.importBackup())

  handle(IPC.backupRunAuto, () => backup.runAutoBackup('manual'))

  handle(IPC.backupOpenDir, () => backup.openAutoBackupDir())

  handle(IPC.undoRestore, (_event, token) => {
    return undo.undo(undoTokenSchema.parse({ token }).token)
  })

  handle(IPC.appGetInfo, () => ({
    name: APP_NAME,
    version: app.getVersion() || APP_VERSION,
    electronVersion: process.versions.electron,
    dataDir: settings.getDataDir(),
    platform: process.platform,
    packaged: app.isPackaged
  }))

  handle(IPC.appOpenDataDir, async () => {
    await shell.openPath(settings.getDataDir())
  })

  handle(IPC.appQuit, () => {
    context.onQuit()
  })
}
