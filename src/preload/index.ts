import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type TaskmindApi, type Unsubscribe } from '../shared/api'
import type { AppSettings } from '../shared/settings'
import type { BallTopTask } from '../shared/types'

function cleanError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error)
  const marker = 'Error: '
  const index = message.lastIndexOf(marker)
  return new Error(index >= 0 ? message.slice(index + marker.length) : message)
}

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  try {
    return (await ipcRenderer.invoke(channel, ...args)) as T
  } catch (error) {
    throw cleanError(error)
  }
}

function subscribe<T>(channel: string, callback: (payload: T) => void): Unsubscribe {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

function subscribeVoid(channel: string, callback: () => void): Unsubscribe {
  const listener = (): void => callback()
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: TaskmindApi = {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  },
  tasks: {
    list: (view) => invoke(IPC.tasksList, view),
    counts: () => invoke(IPC.tasksCounts),
    get: (id) => invoke(IPC.tasksGet, id),
    create: (input) => invoke(IPC.tasksCreate, input),
    update: (id, patch) => invoke(IPC.tasksUpdate, id, patch),
    transition: (id, action) => invoke(IPC.tasksTransition, id, action),
    delete: (id) => invoke(IPC.tasksDelete, id),
    addScreenshot: (taskId, input) => invoke(IPC.tasksAddScreenshot, taskId, input),
    deleteScreenshot: (id) => invoke(IPC.tasksDeleteScreenshot, id)
  },
  ai: {
    extract: (imageDataUrl) => invoke(IPC.aiExtract, imageDataUrl),
    testConnection: () => invoke(IPC.aiTestConnection),
    setApiKey: (key) => invoke(IPC.aiSetApiKey, key)
  },
  settings: {
    get: () => invoke(IPC.settingsGet),
    update: (patch) => invoke(IPC.settingsUpdate, patch)
  },
  notifications: {
    test: () => invoke(IPC.notificationsTest)
  },
  ball: {
    getTop: () => invoke(IPC.ballGetTop),
    getLayout: () => invoke(IPC.ballGetLayout),
    setExpanded: (expanded) => invoke(IPC.ballSetExpanded, expanded),
    dragStart: () => invoke(IPC.ballDragStart),
    dragEnd: () => invoke(IPC.ballDragEnd),
    openTask: (id) => invoke(IPC.ballOpenTask, id),
    openMain: () => invoke(IPC.ballOpenMain),
    contextMenu: () => invoke(IPC.ballContextMenu),
    resetPosition: () => invoke(IPC.ballResetPosition)
  },
  backup: {
    export: () => invoke(IPC.backupExport),
    import: () => invoke(IPC.backupImport)
  },
  app: {
    getInfo: () => invoke(IPC.appGetInfo),
    openDataDir: () => invoke(IPC.appOpenDataDir),
    quit: () => invoke(IPC.appQuit)
  },
  events: {
    onTasksChanged: (callback) => subscribeVoid(IPC.events.tasksChanged, callback),
    onSettingsChanged: (callback) =>
      subscribe<AppSettings>(IPC.events.settingsChanged, callback),
    onNavigateTask: (callback) => subscribe<string>(IPC.events.navigateTask, callback),
    onOpenAddTask: (callback) => subscribe(IPC.events.openAddTask, callback),
    onOpenSettings: (callback) => subscribeVoid(IPC.events.openSettings, callback),
    onBallData: (callback) => subscribe<BallTopTask[]>(IPC.events.ballData, callback),
    onDayChanged: (callback) => subscribe<string>(IPC.events.dayChanged, callback)
  }
}

contextBridge.exposeInMainWorld('taskmind', api)
