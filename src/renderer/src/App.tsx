import { useEffect } from 'react'
import { AlertTriangle, Loader2, Sparkles } from 'lucide-react'
import { Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'
import { AddTaskDialog } from './components/tasks/AddTaskDialog'
import { TaskDetailDrawer } from './components/tasks/TaskDetailDrawer'
import { TaskList } from './components/tasks/TaskList'
import { OnboardingDialog } from './components/settings/OnboardingDialog'
import { SettingsDialog } from './components/settings/SettingsDialog'
import { Button } from './components/ui/Button'
import { Toasts } from './components/ui/Toasts'
import { addScreenshot } from './lib/taskActions'
import { useApplyTheme } from './lib/useTheme'
import { filesToDataUrls, imagesFromClipboard, imagesFromDataTransfer } from './lib/utils'
import { useSettingsStore } from './stores/settingsStore'
import { useTaskStore } from './stores/taskStore'

export default function App(): React.JSX.Element {
  const settings = useSettingsStore((state) => state.settings)
  const settingsLoading = useSettingsStore((state) => state.loading)
  const settingsError = useSettingsStore((state) => state.error)
  const loadSettings = useSettingsStore((state) => state.load)

  const view = useTaskStore((state) => state.view)
  const tasks = useTaskStore((state) => state.tasks)
  const loading = useTaskStore((state) => state.loading)
  const error = useTaskStore((state) => state.error)
  const openTask = useTaskStore((state) => state.openTask)
  const openAdd = useTaskStore((state) => state.openAdd)
  const openSettings = useTaskStore((state) => state.openSettings)

  useApplyTheme(settings?.theme ?? 'system')

  useEffect(() => {
    void loadSettings()
    void useTaskStore.getState().load()

    const unsubscribers = [
      window.taskmind.events.onTasksChanged(() => {
        void useTaskStore.getState().refreshAfterChange()
      }),
      window.taskmind.events.onSettingsChanged((updated) => {
        useSettingsStore.getState().setSettings(updated)
      }),
      window.taskmind.events.onNavigateTask((taskId) => {
        if (!useSettingsStore.getState().settings?.onboardingCompleted) return
        void useTaskStore.getState().openTaskById(taskId)
      }),
      window.taskmind.events.onOpenAddTask((payload) => {
        if (!useSettingsStore.getState().settings?.onboardingCompleted) return
        useTaskStore.getState().openAdd(payload.imageDataUrl ? [payload.imageDataUrl] : [])
      }),
      window.taskmind.events.onOpenSettings(() => {
        if (!useSettingsStore.getState().settings?.onboardingCompleted) return
        useTaskStore.getState().openSettings()
      }),
      window.taskmind.events.onDayChanged(() => {
        void useTaskStore.getState().refreshAfterChange()
      })
    ]

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [loadSettings])

  useEffect(() => {
    const onPaste = (event: ClipboardEvent): void => {
      const state = useTaskStore.getState()
      const currentSettings = useSettingsStore.getState().settings
      if (state.addOpen || state.settingsOpen) return
      if (!currentSettings?.onboardingCompleted) return
      const files = imagesFromClipboard(event)
      if (files.length === 0) return
      event.preventDefault()
      void filesToDataUrls(files).then(async (dataUrls) => {
        const latest = useTaskStore.getState()
        if (latest.detailOpen && latest.detailTask) {
          for (const dataUrl of dataUrls) {
            await addScreenshot(latest.detailTask.id, dataUrl)
          }
        } else {
          latest.openAdd(dataUrls)
        }
      })
    }

    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  useEffect(() => {
    const onDragOver = (event: DragEvent): void => {
      if (event.dataTransfer?.types.includes('Files')) {
        event.preventDefault()
      }
    }

    const onDrop = (event: DragEvent): void => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault()
      const state = useTaskStore.getState()
      const currentSettings = useSettingsStore.getState().settings
      if (state.addOpen || state.settingsOpen || !currentSettings?.onboardingCompleted) return
      const files = imagesFromDataTransfer(event.dataTransfer)
      if (files.length === 0) return
      void filesToDataUrls(files).then(async (dataUrls) => {
        const latest = useTaskStore.getState()
        if (latest.detailOpen && latest.detailTask) {
          for (const dataUrl of dataUrls) {
            await addScreenshot(latest.detailTask.id, dataUrl)
          }
        } else {
          latest.openAdd(dataUrls)
        }
      })
    }

    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  if (!settings) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[var(--bg)] text-[var(--muted)]">
        <img src="./icon.png" alt="" className="h-14 w-14 rounded-2xl shadow-lg shadow-teal-900/10" />
        {settingsError ? (
          <>
            <div className="flex items-center gap-2 text-sm text-[var(--danger)]">
              <AlertTriangle className="h-4 w-4" />
              {settingsError}
            </div>
            <Button variant="secondary" size="sm" onClick={() => void loadSettings()}>
              重试
            </Button>
          </>
        ) : (
          <div className="flex items-center gap-2 text-xs">
            <Loader2 className="h-4 w-4 animate-spin" />
            {settingsLoading ? '正在加载 TaskMind…' : '准备中…'}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />

        {settings.onboardingCompleted && !settings.hasApiKey ? (
          <div className="mx-8 mt-4 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              AI 识别还没配置。你仍然可以手动添加任务和截图；配置 Key 后，Ctrl+V
              粘贴截图就能自动填写。
            </span>
            <button
              type="button"
              className="shrink-0 rounded-lg bg-white/65 px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-white dark:bg-black/20 dark:hover:bg-black/30"
              onClick={openSettings}
            >
              去设置
            </button>
          </div>
        ) : null}

        <main className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
          <div className="mx-auto max-w-5xl">
            <TaskList
              tasks={tasks}
              view={view}
              loading={loading}
              error={error}
              onOpen={(id) => void openTask(id)}
            />
          </div>
        </main>
      </div>

      <AddTaskDialog />
      <TaskDetailDrawer />
      <SettingsDialog />
      <OnboardingDialog />
      <Toasts />
    </div>
  )
}
