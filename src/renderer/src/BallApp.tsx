import { useEffect, useRef, useState } from 'react'
import { Bell, Check, ChevronRight, ExternalLink, Loader2 } from 'lucide-react'
import { BALL_PANEL_WIDTH } from '@shared/constants'
import { formatDueLabel } from '@shared/date'
import type { ThemeMode } from '@shared/settings'
import type { BallLayout, BallTopTask } from '@shared/types'
import { StatusDot } from './components/ui/Badges'
import { useApplyTheme } from './lib/useTheme'
import { cn } from './lib/utils'

const COLLAPSED: BallLayout = {
  expanded: false,
  windowWidth: 88,
  windowHeight: 88,
  ballX: 0,
  ballY: 0,
  ballSize: 88,
  docked: false,
  dockEdge: 'none'
}

const TONE_CLASS: Record<string, string> = {
  overdue: 'text-red-600 dark:text-red-300',
  today: 'text-amber-600 dark:text-amber-300',
  soon: 'text-sky-600 dark:text-sky-300',
  normal: 'text-[var(--muted)]',
  none: 'text-[var(--muted)]'
}

export default function BallApp(): React.JSX.Element {
  const [tasks, setTasks] = useState<BallTopTask[]>([])
  const [layout, setLayout] = useState<BallLayout>(COLLAPSED)
  const [expanded, setExpanded] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>('system')
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(true)

  const expandTimer = useRef<number | null>(null)
  const collapseTimer = useRef<number | null>(null)
  const dragActive = useRef(false)
  const suppressClick = useRef(false)

  useApplyTheme(theme)

  const clearTimers = (): void => {
    if (expandTimer.current !== null) {
      window.clearTimeout(expandTimer.current)
      expandTimer.current = null
    }
    if (collapseTimer.current !== null) {
      window.clearTimeout(collapseTimer.current)
      collapseTimer.current = null
    }
  }

  const refreshTasks = async (): Promise<void> => {
    try {
      const top = await window.taskmind.ball.getTop()
      setTasks(top)
    } catch {
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  const syncLayout = async (): Promise<void> => {
    try {
      const next = await window.taskmind.ball.getLayout()
      setLayout(next)
      setExpanded(next.expanded)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void refreshTasks()
    void syncLayout()
    void window.taskmind.settings.get().then((settings) => setTheme(settings.theme))

    const onResize = (): void => {
      void syncLayout()
    }
    window.addEventListener('resize', onResize)

    const unsubscribers = [
      window.taskmind.events.onBallData((next) => {
        setTasks(next)
        setLoading(false)
      }),
      window.taskmind.events.onSettingsChanged((settings) => {
        setTheme(settings.theme)
        void syncLayout()
      }),
      window.taskmind.events.onDayChanged(() => {
        void refreshTasks()
      })
    ]

    return () => {
      window.removeEventListener('resize', onResize)
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [])

  useEffect(() => {
    return () => clearTimers()
  }, [])

  const expand = async (): Promise<void> => {
    clearTimers()
    const next = await window.taskmind.ball.setExpanded(true)
    setLayout(next)
    setExpanded(true)
  }

  const collapse = async (): Promise<void> => {
    clearTimers()
    const next = await window.taskmind.ball.setExpanded(false)
    setLayout(next)
    setExpanded(false)
  }

  const onMouseEnter = (): void => {
    if (expanded || dragging) return
    void syncLayout()
    clearTimers()
    expandTimer.current = window.setTimeout(() => {
      void expand()
    }, 280)
  }

  const onMouseLeave = (): void => {
    if (expandTimer.current !== null) {
      window.clearTimeout(expandTimer.current)
      expandTimer.current = null
    }
    if (!expanded) return
    collapseTimer.current = window.setTimeout(() => {
      void collapse()
    }, 260)
  }

  const onBallMouseDown = (event: React.MouseEvent<HTMLButtonElement>): void => {
    if (event.button !== 0 || dragActive.current) return
    event.preventDefault()
    clearTimers()
    const wasExpanded = expanded
    dragActive.current = true
    suppressClick.current = true
    setDragging(true)
    void window.taskmind.ball.dragStart()

    let safety = 0
    let finished = false

    const finish = (): void => {
      if (finished) return
      finished = true
      window.clearTimeout(safety)
      window.removeEventListener('mouseup', finish)
      window.removeEventListener('blur', finish)
      dragActive.current = false
      setDragging(false)
      void window.taskmind.ball
        .dragEnd()
        .then((result) => {
          // 弹窗打开时按下球，主进程会先收起弹窗；单纯点击只收起，不重新展开。
          if (!result.moved && !wasExpanded) {
            void expand()
          }
          window.setTimeout(() => {
            suppressClick.current = false
          }, 200)
        })
        .catch(() => {
          suppressClick.current = false
        })
    }

    safety = window.setTimeout(finish, 15_000)
    window.addEventListener('mouseup', finish, { once: true })
    window.addEventListener('blur', finish, { once: true })
  }

  const onBallClick = (): void => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    if (expanded) void collapse()
    else void expand()
  }

  const openTask = (task: BallTopTask): void => {
    void window.taskmind.ball.openTask(task.id)
  }

  const panelWidth = BALL_PANEL_WIDTH
  const panelHeight = Math.min(286, 64 + Math.max(tasks.length, 1) * 70)
  const spaceRight = layout.windowWidth - (layout.ballX + layout.ballSize)
  const spaceLeft = layout.ballX
  const panelLeft =
    spaceRight >= panelWidth + 12 || spaceRight >= spaceLeft
      ? Math.min(
          layout.ballX + layout.ballSize + 12,
          layout.windowWidth - panelWidth - 8
        )
      : Math.max(8, layout.ballX - panelWidth - 12)
  const panelTop = Math.min(
    Math.max(8, layout.ballY - 24),
    Math.max(8, layout.windowHeight - panelHeight - 8)
  )

  const innerSize = layout.docked
    ? Math.max(40, layout.ballSize - 6)
    : Math.max(40, layout.ballSize - 16)
  const iconSize = Math.max(16, Math.round(innerSize * 0.36))
  const badgeClass = layout.docked
    ? 'right-0.5 top-0.5 h-5 min-w-5 text-[9px]'
    : '-right-1.5 -top-1.5 h-6 min-w-6 text-[10px]'

  return (
    <div
      className={cn(
        'ball-root relative h-screen w-screen overflow-hidden',
        dragging && 'ball-dragging'
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onContextMenu={(event) => {
        event.preventDefault()
        clearTimers()
        void window.taskmind.ball.contextMenu()
      }}
    >
      {expanded ? (
        <div
          className="absolute z-20 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 shadow-2xl backdrop-blur-md animate-scale-in"
          style={{ left: panelLeft, top: panelTop, width: panelWidth }}
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3.5 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--fg)]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
              </span>
              最紧急 {tasks.length > 0 ? `Top ${tasks.length}` : ''}
            </div>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
              onClick={() => void window.taskmind.ball.openMain()}
              title="打开 TaskMind"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-[var(--muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在读取任务…
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-7 text-center">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300">
                <Check className="h-5 w-5" />
              </div>
              <div className="text-xs font-medium text-[var(--fg)]">暂无紧急任务</div>
              <div className="mt-1 text-[10px] leading-4 text-[var(--muted)]">
                有截止日期的未完成任务会出现在这里
              </div>
            </div>
          ) : (
            <div className="p-1.5">
              {tasks.map((task) => {
                const due = formatDueLabel(task)
                return (
                  <button
                    key={task.id}
                    type="button"
                    className="group flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-[var(--surface-hover)]"
                    onClick={() => openTask(task)}
                    title="打开任务详情"
                  >
                    <StatusDot status={task.status} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium text-[var(--fg)]">
                        {task.title}
                      </div>
                      <div className={cn('mt-0.5 text-[10px]', TONE_CLASS[due.tone])}>
                        {due.text}
                      </div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                )
              })}
            </div>
          )}

          <div className="border-t border-[var(--border)] px-3.5 py-2 text-[9px] leading-4 text-[var(--muted)]">
            拖动小球可移动 · 拖到屏幕边缘会自动缩小贴边
          </div>
        </div>
      ) : null}

      <div
        className="absolute z-10"
        style={{
          left: layout.ballX,
          top: layout.ballY,
          width: layout.ballSize,
          height: layout.ballSize
        }}
      >
        <button
          type="button"
          className={cn(
            'group relative flex h-full w-full items-center justify-center rounded-full outline-none',
            dragging ? 'cursor-grabbing' : 'cursor-grab'
          )}
          onMouseDown={onBallMouseDown}
          onClick={onBallClick}
          title={tasks.length > 0 ? `最紧急 ${tasks.length} 个任务` : 'TaskMind'}
        >
          <span
            className="relative flex items-center justify-center rounded-full border border-white/30 bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-600 text-white transition-transform duration-200 group-hover:scale-[1.04] group-active:scale-95"
            style={{ width: innerSize, height: innerSize }}
          >
            {tasks.length > 0 ? (
              <Bell style={{ width: iconSize, height: iconSize }} />
            ) : (
              <Check style={{ width: iconSize, height: iconSize }} />
            )}
            {tasks.length > 0 ? (
              <span
                className={cn(
                  'absolute flex items-center justify-center rounded-full border-2 border-white bg-amber-400 px-1 font-bold text-amber-950',
                  badgeClass
                )}
              >
                {tasks.length}
              </span>
            ) : null}
          </span>
        </button>
      </div>
    </div>
  )
}
