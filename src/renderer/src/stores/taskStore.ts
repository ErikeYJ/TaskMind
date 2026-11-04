import { create } from 'zustand'
import { getTodayString } from '@shared/date'
import { defaultViewForTask } from '@shared/status'
import type { Task, TaskCounts, TaskView } from '@shared/types'

const EMPTY_COUNTS: TaskCounts = {
  today: 0,
  all_open: 0,
  in_progress: 0,
  completed: 0,
  suspended: 0
}

interface TaskState {
  view: TaskView
  tasks: Task[]
  counts: TaskCounts
  loading: boolean
  error: string | null
  detailTask: Task | null
  detailOpen: boolean
  addOpen: boolean
  addInitialImages: string[]
  settingsOpen: boolean
  load: () => Promise<void>
  setView: (view: TaskView) => Promise<void>
  refreshAfterChange: () => Promise<void>
  openTask: (id: string) => Promise<void>
  openTaskById: (id: string) => Promise<void>
  closeDetail: () => void
  openAdd: (images?: string[]) => void
  closeAdd: () => void
  openSettings: () => void
  closeSettings: () => void
  setDetailTask: (task: Task | null) => void
}

let listRequestId = 0

export const useTaskStore = create<TaskState>((set, get) => ({
  view: 'today',
  tasks: [],
  counts: EMPTY_COUNTS,
  loading: true,
  error: null,
  detailTask: null,
  detailOpen: false,
  addOpen: false,
  addInitialImages: [],
  settingsOpen: false,

  load: async () => {
    const requestId = ++listRequestId
    const view = get().view
    set({ loading: true, error: null })
    try {
      const [counts, tasks] = await Promise.all([
        window.taskmind.tasks.counts(),
        window.taskmind.tasks.list(view)
      ])
      if (requestId !== listRequestId || get().view !== view) return
      set({ counts, tasks, loading: false, error: null })
    } catch (error) {
      if (requestId !== listRequestId) return
      set({
        loading: false,
        error: error instanceof Error ? error.message : '读取任务失败'
      })
    }
  },

  setView: async (view) => {
    if (get().view === view && !get().loading) {
      set({ detailOpen: false })
      return
    }
    const requestId = ++listRequestId
    set({ view, loading: true, error: null })
    try {
      const [counts, tasks] = await Promise.all([
        window.taskmind.tasks.counts(),
        window.taskmind.tasks.list(view)
      ])
      if (requestId !== listRequestId || get().view !== view) return
      set({ counts, tasks, loading: false, error: null })
    } catch (error) {
      if (requestId !== listRequestId) return
      set({
        loading: false,
        error: error instanceof Error ? error.message : '读取任务失败'
      })
    }
  },

  refreshAfterChange: async () => {
    const requestId = ++listRequestId
    const view = get().view
    const wasDetailOpen = get().detailOpen
    const detailId = get().detailTask?.id
    try {
      const [counts, tasks] = await Promise.all([
        window.taskmind.tasks.counts(),
        window.taskmind.tasks.list(view)
      ])
      if (requestId !== listRequestId || get().view !== view) return
      let detailTask = get().detailTask
      if (wasDetailOpen && detailId) {
        detailTask = await window.taskmind.tasks.get(detailId)
      }
      set({
        counts,
        tasks,
        loading: false,
        detailTask,
        detailOpen: Boolean(wasDetailOpen && detailTask)
      })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '读取任务失败' })
    }
  },

  openTask: async (id) => {
    const task = await window.taskmind.tasks.get(id)
    if (!task) {
      set({ detailOpen: false, detailTask: null })
      return
    }
    set({ detailTask: task, detailOpen: true })
  },

  openTaskById: async (id) => {
    const task = await window.taskmind.tasks.get(id)
    if (!task) {
      set({ detailOpen: false, detailTask: null })
      return
    }
    const view = defaultViewForTask(task, getTodayString())
    const requestId = ++listRequestId
    set({ view, loading: true, detailTask: task, detailOpen: true, error: null })
    try {
      const [counts, tasks] = await Promise.all([
        window.taskmind.tasks.counts(),
        window.taskmind.tasks.list(view)
      ])
      if (requestId !== listRequestId) return
      set({ counts, tasks, loading: false })
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : '读取任务失败' })
    }
  },

  closeDetail: () => set({ detailOpen: false, detailTask: null }),
  openAdd: (images = []) =>
    set({
      detailOpen: false,
      detailTask: null,
      settingsOpen: false,
      addOpen: true,
      addInitialImages: images
    }),
  closeAdd: () => set({ addOpen: false, addInitialImages: [] }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  setDetailTask: (task) => set({ detailTask: task })
}))
