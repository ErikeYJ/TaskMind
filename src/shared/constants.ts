import type { TaskAction, TaskStatus, TaskView } from './types'

export const APP_NAME = 'TaskMind'
export const APP_ID = 'com.taskmind.app'
export const APP_VERSION = '0.1.5'

export const VIEW_ORDER: TaskView[] = ['today', 'all_open', 'in_progress', 'completed', 'suspended']

export const VIEW_LABELS: Record<TaskView, string> = {
  today: '今日待办',
  all_open: '未完成',
  in_progress: '进行中',
  completed: '已完成',
  suspended: '挂起'
}

export const VIEW_SUBTITLES: Record<TaskView, string> = {
  today: '今天到期和已经逾期、还没开始的任务',
  all_open: '所有还没做完的任务，进行中和挂起也会出现在这里',
  in_progress: '正在推进的任务，可以同时有多个',
  completed: '已经完成的任务，可以随时还原',
  suspended: '暂时不做的任务，不参与浮球和提醒'
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: '待办',
  in_progress: '进行中',
  suspended: '挂起',
  done: '已完成'
}

export const STATUS_ORDER: TaskStatus[] = ['todo', 'in_progress', 'suspended', 'done']

export const ACTION_LABELS: Record<TaskAction, string> = {
  start: '开始',
  suspend: '挂起',
  resume: '恢复',
  complete: '完成',
  restore: '还原'
}

export const DEFAULT_BALL_SIZE = 88
export const MIN_BALL_SIZE = 56
export const MAX_BALL_SIZE = 120
export const DOCKED_BALL_SCALE = 0.62
export const BALL_SNAP_DISTANCE = 28
export const BALL_PANEL_WIDTH = 276
export const BALL_PANEL_GAP = 12
export const EXPANDED_BALL_WIDTH = 380
export const EXPANDED_BALL_HEIGHT = 320
export const MAX_SCREENSHOTS_PER_TASK = 12
export const MAX_SCREENSHOT_BYTES = 20 * 1024 * 1024
export const AI_TIMEOUT_MS = 45_000
