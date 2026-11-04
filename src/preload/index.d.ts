import type { TaskmindApi } from '../shared/api'

declare global {
  interface Window {
    taskmind: TaskmindApi
  }
}

export {}
