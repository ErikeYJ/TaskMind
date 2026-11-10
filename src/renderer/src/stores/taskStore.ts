import { create } from 'zustand'
import { getTodayString } from '@shared/date'
import { defaultViewForTask } from '@shared/status'
import type { Project, Task, TaskCounts, TaskView } from '@shared/types'

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
  searchOpen: boolean
  projects: Project[]
  projectsLoading: boolean
  projectsError: string | null
  projectFilterId: string | null
  projectEditorOpen: boolean
  editingProject: Project | null
  load: () => Promise<void>
  setView: (view: TaskView) => Promise<void>
  setProjectFilter: (projectId: string | null) => Promise<void>
  loadProjects: () => Promise<void>
  refreshAfterChange: () => Promise<void>
  openTask: (id: string) => Promise<void>
  openTaskById: (id: string) => Promise<void>
  closeDetail: () => void
  openAdd: (images?: string[]) => void
  closeAdd: () => void
  openSettings: () => void
  closeSettings: () => void
  openSearch: () => void
  closeSearch: () => void
  openProjectEditor: (project?: Project | null) => void
  closeProjectEditor: () => void
  setDetailTask: (task: Task | null) => void
}

let listRequestId = 0
let projectListRequestId = 0

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
  searchOpen: false,
  projects: [],
  projectsLoading: true,
  projectsError: null,
  projectFilterId: null,
  projectEditorOpen: false,
  editingProject: null,

  load: async () => {
    const requestId = ++listRequestId
    const view = get().view
    const projectId = get().projectFilterId
    set({ loading: true, error: null })
    try {
      const [counts, tasks] = await Promise.all([
        window.taskmind.tasks.counts(projectId),
        window.taskmind.tasks.list(view, projectId)
      ])
      if (
        requestId !== listRequestId ||
        get().view !== view ||
        get().projectFilterId !== projectId
      ) {
        return
      }
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
    const projectId = get().projectFilterId
    set({ view, loading: true, error: null })
    try {
      const [counts, tasks] = await Promise.all([
        window.taskmind.tasks.counts(projectId),
        window.taskmind.tasks.list(view, projectId)
      ])
      if (
        requestId !== listRequestId ||
        get().view !== view ||
        get().projectFilterId !== projectId
      ) {
        return
      }
      set({ counts, tasks, loading: false, error: null })
    } catch (error) {
      if (requestId !== listRequestId) return
      set({
        loading: false,
        error: error instanceof Error ? error.message : '读取任务失败'
      })
    }
  },

  setProjectFilter: async (projectId) => {
    const current = get().projectFilterId
    const target = projectId && current !== projectId ? projectId : null
    if (current === target) {
      set({ detailOpen: false })
      return
    }

    const requestId = ++listRequestId
    const view = target ? 'all_open' : get().view
    set({
      projectFilterId: target,
      view,
      loading: true,
      error: null,
      detailOpen: false,
      detailTask: null
    })
    try {
      const [counts, tasks] = await Promise.all([
        window.taskmind.tasks.counts(target),
        window.taskmind.tasks.list(view, target)
      ])
      if (
        requestId !== listRequestId ||
        get().projectFilterId !== target ||
        get().view !== view
      ) {
        return
      }
      set({ counts, tasks, loading: false, error: null })
    } catch (error) {
      if (requestId !== listRequestId) return
      set({
        loading: false,
        error: error instanceof Error ? error.message : '读取任务失败'
      })
    }
  },

  loadProjects: async () => {
    const requestId = ++projectListRequestId
    set({ projectsLoading: true, projectsError: null })
    try {
      const projects = await window.taskmind.projects.list()
      if (requestId !== projectListRequestId) return
      const filterId = get().projectFilterId
      const filterExists = !filterId || projects.some((project) => project.id === filterId)
      set({
        projects,
        projectsLoading: false,
        projectsError: null,
        projectFilterId: filterExists ? filterId : null
      })
      if (!filterExists) {
        await get().load()
      }
    } catch (error) {
      if (requestId !== projectListRequestId) return
      set({
        projectsLoading: false,
        projectsError: error instanceof Error ? error.message : '读取项目失败'
      })
    }
  },

  refreshAfterChange: async () => {
    const requestId = ++listRequestId
    const view = get().view
    const projectId = get().projectFilterId
    const wasDetailOpen = get().detailOpen
    const detailId = get().detailTask?.id
    try {
      const [counts, tasks] = await Promise.all([
        window.taskmind.tasks.counts(projectId),
        window.taskmind.tasks.list(view, projectId)
      ])
      if (
        requestId !== listRequestId ||
        get().view !== view ||
        get().projectFilterId !== projectId
      ) {
        return
      }
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
      void get().loadProjects()
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
    set({
      view,
      projectFilterId: null,
      loading: true,
      detailTask: task,
      detailOpen: true,
      searchOpen: false,
      error: null
    })
    try {
      const [counts, tasks] = await Promise.all([
        window.taskmind.tasks.counts(null),
        window.taskmind.tasks.list(view, null)
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
      searchOpen: false,
      projectEditorOpen: false,
      addOpen: true,
      addInitialImages: images
    }),
  closeAdd: () => set({ addOpen: false, addInitialImages: [] }),
  openSettings: () => set({ settingsOpen: true, searchOpen: false }),
  closeSettings: () => set({ settingsOpen: false }),
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  openProjectEditor: (project = null) =>
    set({
      projectEditorOpen: true,
      editingProject: project,
      settingsOpen: false,
      searchOpen: false
    }),
  closeProjectEditor: () => set({ projectEditorOpen: false, editingProject: null }),
  setDetailTask: (task) => set({ detailTask: task })
}))
