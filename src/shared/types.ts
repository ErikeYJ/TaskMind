import type { BallDockEdge } from './settings'

export type TaskStatus = 'todo' | 'in_progress' | 'suspended' | 'done'

export type TaskView = 'today' | 'all_open' | 'in_progress' | 'completed' | 'suspended'

export type TaskAction = 'start' | 'suspend' | 'resume' | 'complete' | 'restore'

export interface ScreenshotMeta {
  id: string
  taskId: string
  fileName: string
  thumbName: string | null
  mimeType: string
  width: number | null
  height: number | null
  createdAt: string
  url: string
  thumbUrl: string
}

export interface Task {
  id: string
  title: string
  content: string
  client: string | null
  notes: string
  dueDate: string | null
  dueTime: string | null
  status: TaskStatus
  statusBeforeSuspend: TaskStatus | null
  statusBeforeDone: TaskStatus | null
  startedAt: string | null
  suspendedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  screenshots: ScreenshotMeta[]
}

export interface ScreenshotInput {
  dataUrl: string
  fileName?: string
}

export interface CreateTaskInput {
  title: string
  content?: string
  client?: string | null
  notes?: string
  dueDate?: string | null
  dueTime?: string | null
  screenshots?: ScreenshotInput[]
}

export interface UpdateTaskInput {
  title?: string
  content?: string
  client?: string | null
  notes?: string
  dueDate?: string | null
  dueTime?: string | null
}

export interface TaskCounts {
  today: number
  all_open: number
  in_progress: number
  completed: number
  suspended: number
}

export interface AiTaskExtraction {
  title: string
  content: string
  client: string | null
  dueDate: string | null
  dueTime: string | null
  notes: string
  confidence: number | null
}

export interface AiExtractionError {
  code: 'NO_KEY' | 'NO_TASK' | 'BAD_RESPONSE' | 'NETWORK' | 'HTTP' | 'UNKNOWN'
  message: string
}

export type AiExtractionResult =
  | { ok: true; data: AiTaskExtraction }
  | { ok: false; error: AiExtractionError }

export interface AiConnectionResult {
  ok: boolean
  message: string
  latencyMs: number | null
}

export interface BallTopTask {
  id: string
  title: string
  status: TaskStatus
  dueDate: string | null
  dueTime: string | null
}

export interface BallLayout {
  expanded: boolean
  windowWidth: number
  windowHeight: number
  ballX: number
  ballY: number
  ballSize: number
  docked: boolean
  dockEdge: BallDockEdge
}

export interface AppInfo {
  name: string
  version: string
  electronVersion: string
  dataDir: string
  platform: string
  packaged: boolean
}

export interface BackupResult {
  ok: boolean
  path?: string
  message: string
}

export interface ImportResult {
  ok: boolean
  message: string
  restartRequired?: boolean
}
