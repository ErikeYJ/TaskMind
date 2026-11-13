import type { AppSettings, SettingsPatch } from './settings'
import type {
  AiConnectionResult,
  AiExtractionResult,
  AppInfo,
  BackupResult,
  BallLayout,
  BallTopTask,
  CreateProjectInput,
  CreateTaskInput,
  ImportResult,
  Project,
  ScreenshotInput,
  ScreenshotMeta,
  Task,
  TaskAction,
  TaskCounts,
  TaskView,
  UpdateProjectInput,
  UpdateTaskInput
} from './types'

export const IPC = {
  tasksList: 'tasks:list',
  tasksCounts: 'tasks:counts',
  tasksSearch: 'tasks:search',
  projectsList: 'projects:list',
  projectsCreate: 'projects:create',
  projectsUpdate: 'projects:update',
  projectsDelete: 'projects:delete',
  tasksGet: 'tasks:get',
  tasksCreate: 'tasks:create',
  tasksUpdate: 'tasks:update',
  tasksTransition: 'tasks:transition',
  tasksDelete: 'tasks:delete',
  tasksAddScreenshot: 'tasks:addScreenshot',
  tasksDeleteScreenshot: 'tasks:deleteScreenshot',
  aiExtract: 'ai:extract',
  aiTestConnection: 'ai:testConnection',
  aiSetApiKey: 'ai:setApiKey',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  notificationsTest: 'notifications:test',
  ballGetTop: 'ball:getTop',
  ballGetLayout: 'ball:getLayout',
  ballSetExpanded: 'ball:setExpanded',
  ballDragStart: 'ball:dragStart',
  ballDragEnd: 'ball:dragEnd',
  ballOpenTask: 'ball:openTask',
  ballOpenMain: 'ball:openMain',
  ballContextMenu: 'ball:contextMenu',
  ballResetPosition: 'ball:resetPosition',
  backupExport: 'backup:export',
  backupImport: 'backup:import',
  backupRunAuto: 'backup:runAuto',
  backupOpenDir: 'backup:openDir',
  appGetInfo: 'app:getInfo',
  appOpenDataDir: 'app:openDataDir',
  appQuit: 'app:quit',
  events: {
    tasksChanged: 'event:tasksChanged',
    projectsChanged: 'event:projectsChanged',
    settingsChanged: 'event:settingsChanged',
    navigateTask: 'event:navigateTask',
    openAddTask: 'event:openAddTask',
    openSettings: 'event:openSettings',
    ballData: 'event:ballData',
    dayChanged: 'event:dayChanged'
  }
} as const

export type Unsubscribe = () => void

export interface OpenAddTaskPayload {
  imageDataUrl?: string
}

export interface TaskmindApi {
  platform: string
  versions: {
    electron: string
    chrome: string
    node: string
  }
  tasks: {
    list(view: TaskView, projectId?: string | null): Promise<Task[]>
    counts(projectId?: string | null): Promise<TaskCounts>
    search(query: string): Promise<Task[]>
    get(id: string): Promise<Task | null>
    create(input: CreateTaskInput): Promise<Task>
    update(id: string, patch: UpdateTaskInput): Promise<Task>
    transition(id: string, action: TaskAction): Promise<Task>
    delete(id: string): Promise<void>
    addScreenshot(taskId: string, input: ScreenshotInput): Promise<ScreenshotMeta>
    deleteScreenshot(id: string): Promise<void>
  }
  projects: {
    list(): Promise<Project[]>
    create(input: CreateProjectInput): Promise<Project>
    update(id: string, patch: UpdateProjectInput): Promise<Project>
    delete(id: string): Promise<void>
  }
  ai: {
    extract(imageDataUrls: string[]): Promise<AiExtractionResult>
    testConnection(): Promise<AiConnectionResult>
    setApiKey(key: string): Promise<{ ok: boolean; message: string }>
  }
  settings: {
    get(): Promise<AppSettings>
    update(patch: SettingsPatch): Promise<AppSettings>
  }
  notifications: {
    test(): Promise<{ ok: boolean; message: string }>
  }
  ball: {
    getTop(): Promise<BallTopTask[]>
    getLayout(): Promise<BallLayout>
    setExpanded(expanded: boolean): Promise<BallLayout>
    dragStart(): Promise<void>
    dragEnd(): Promise<{ moved: boolean }>
    openTask(id: string): Promise<void>
    openMain(): Promise<void>
    contextMenu(): Promise<void>
    resetPosition(): Promise<void>
  }
  backup: {
    export(): Promise<BackupResult>
    import(): Promise<ImportResult>
    runAuto(): Promise<BackupResult>
    openDir(): Promise<BackupResult>
  }
  app: {
    getInfo(): Promise<AppInfo>
    openDataDir(): Promise<void>
    quit(): Promise<void>
  }
  events: {
    onTasksChanged(callback: () => void): Unsubscribe
    onProjectsChanged(callback: () => void): Unsubscribe
    onSettingsChanged(callback: (settings: AppSettings) => void): Unsubscribe
    onNavigateTask(callback: (taskId: string) => void): Unsubscribe
    onOpenAddTask(callback: (payload: OpenAddTaskPayload) => void): Unsubscribe
    onOpenSettings(callback: () => void): Unsubscribe
    onBallData(callback: (tasks: BallTopTask[]) => void): Unsubscribe
    onDayChanged(callback: (today: string) => void): Unsubscribe
  }
}
