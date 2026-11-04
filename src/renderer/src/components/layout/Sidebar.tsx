import {
  CalendarDays,
  Check,
  Inbox,
  Pause,
  Pencil,
  Play,
  Plus,
  Settings,
  Sparkles
} from 'lucide-react'
import { APP_VERSION, VIEW_LABELS, VIEW_ORDER } from '@shared/constants'
import type { TaskView } from '@shared/types'
import { useSettingsStore } from '../../stores/settingsStore'
import { useTaskStore } from '../../stores/taskStore'
import { CountBadge } from '../ui/Badges'
import { cn } from '../../lib/utils'

const icons: Record<TaskView, React.JSX.Element> = {
  today: <CalendarDays className="h-4 w-4" />,
  all_open: <Inbox className="h-4 w-4" />,
  in_progress: <Play className="h-4 w-4" />,
  completed: <Check className="h-4 w-4" />,
  suspended: <Pause className="h-4 w-4" />
}

export function Sidebar(): React.JSX.Element {
  const view = useTaskStore((state) => state.view)
  const counts = useTaskStore((state) => state.counts)
  const setView = useTaskStore((state) => state.setView)
  const openSettings = useTaskStore((state) => state.openSettings)
  const projects = useTaskStore((state) => state.projects)
  const projectsLoading = useTaskStore((state) => state.projectsLoading)
  const projectsError = useTaskStore((state) => state.projectsError)
  const projectFilterId = useTaskStore((state) => state.projectFilterId)
  const setProjectFilter = useTaskStore((state) => state.setProjectFilter)
  const loadProjects = useTaskStore((state) => state.loadProjects)
  const openProjectEditor = useTaskStore((state) => state.openProjectEditor)
  const settings = useSettingsStore((state) => state.settings)

  return (
    <aside className="flex w-[248px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface-soft)]">
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <img
          src="./icon.png"
          alt=""
          className="h-10 w-10 rounded-xl shadow-sm shadow-teal-900/10"
        />
        <div className="min-w-0">
          <div className="text-[15px] font-semibold tracking-tight text-[var(--fg)]">TaskMind</div>
          <div className="text-[11px] text-[var(--muted)]">把客户的活接住</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="space-y-1">
          {VIEW_ORDER.map((item) => {
            const active = view === item
            return (
              <button
                key={item}
                type="button"
                onClick={() => void setView(item)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-colors',
                  active
                    ? 'bg-[var(--surface)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--border)]'
                    : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)]'
                )}
              >
                <span className={cn(active ? 'text-[var(--primary)]' : 'text-[var(--muted)]')}>
                  {icons[item]}
                </span>
                <span className="flex-1">{VIEW_LABELS[item]}</span>
                <CountBadge count={counts[item]} active={active} />
              </button>
            )
          })}
        </div>

        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <div className="mb-1 flex items-center justify-between px-3">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              项目
            </span>
            <div className="flex items-center gap-0.5">
              {projectFilterId ? (
                <button
                  type="button"
                  className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
                  onClick={() => void setProjectFilter(null)}
                  title="清除项目筛选"
                >
                  全部
                </button>
              ) : null}
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
                onClick={() => openProjectEditor(null)}
                title="新建项目"
                aria-label="新建项目"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-0.5">
            {projectsLoading && projects.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-[var(--muted)]">正在读取项目…</div>
            ) : null}

            {projectsError && projects.length === 0 ? (
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[11px] text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                onClick={() => void loadProjects()}
              >
                <span className="truncate">读取项目失败</span>
                <span className="shrink-0 underline">重试</span>
              </button>
            ) : null}

            {!projectsLoading && !projectsError && projects.length === 0 ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-xl border border-dashed border-[var(--border-strong)] px-3 py-2.5 text-left text-[11px] text-[var(--muted)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--surface)] hover:text-[var(--fg)]"
                onClick={() => openProjectEditor(null)}
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span>新建第一个项目</span>
              </button>
            ) : null}

            {projects.map((project) => {
              const active = projectFilterId === project.id
              return (
                <div
                  key={project.id}
                  className={cn(
                    'group flex items-center rounded-xl transition-colors',
                    active
                      ? 'bg-[var(--surface)] shadow-sm ring-1 ring-[var(--border)]'
                      : 'hover:bg-[var(--surface)]'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => void setProjectFilter(project.id)}
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium transition-colors',
                      active
                        ? 'text-[var(--primary)]'
                        : 'text-[var(--muted)] hover:text-[var(--fg)]'
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="flex-1 truncate">{project.name}</span>
                    <CountBadge count={project.openTaskCount} active={active} />
                  </button>
                  <button
                    type="button"
                    className="mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] opacity-0 transition-opacity hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => openProjectEditor(project)}
                    title={`编辑项目：${project.name}`}
                    aria-label={`编辑项目：${project.name}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </nav>

      <div className="border-t border-[var(--border)] p-3">
        {settings && !settings.hasApiKey ? (
          <button
            type="button"
            onClick={openSettings}
            className="mb-2 flex w-full items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left text-[11px] leading-4 text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300 dark:hover:bg-amber-400/15"
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">AI 识别未配置，贴图后可手动填写</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={openSettings}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--fg)]"
        >
          <Settings className="h-4 w-4" />
          <span className="flex-1">设置</span>
        </button>
        <div className="px-3 pt-2 text-[10px] text-[var(--muted)]">TaskMind {APP_VERSION}</div>
      </div>
    </aside>
  )
}
