import { useEffect, useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { addDays, addWeeks, format as formatDate, startOfWeek } from 'date-fns'
import {
  AlertTriangle,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  Loader2,
  RefreshCw,
  X
} from 'lucide-react'
import type { Task } from '@shared/types'
import { buildWeeklyReport, type WeeklyReportFormat } from '@shared/weeklyReport'
import { useTaskStore } from '../../stores/taskStore'
import { toastError, toastSuccess } from '../../stores/toastStore'
import { getErrorMessage } from '../../lib/utils'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'

export function WeeklyReportDialog(): React.JSX.Element | null {
  const open = useTaskStore((state) => state.weeklyReportOpen)
  const closeWeeklyReport = useTaskStore((state) => state.closeWeeklyReport)
  const projects = useTaskStore((state) => state.allProjects)

  const [weekOffset, setWeekOffset] = useState(0)
  const [format, setFormat] = useState<WeeklyReportFormat>('text')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const weekStart = useMemo(
    () => startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 }),
    [weekOffset]
  )
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart])
  const displayEnd = addDays(weekEnd, -1)
  const rangeLabel = `${formatDate(weekStart, 'M月d日')} - ${formatDate(displayEnd, 'M月d日')}`

  useEffect(() => {
    if (!open) return
    setWeekOffset(0)
    setFormat('text')
    setTasks([])
    setError(null)
    setDraft('')
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void useTaskStore.getState().loadProjects()
    window.taskmind.tasks
      .completedBetween(weekStart.toISOString(), weekEnd.toISOString())
      .then((completed) => {
        if (!cancelled) setTasks(completed)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, '读取本周任务失败'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, weekStart, weekEnd, reloadKey])

  const report = useMemo(
    () =>
      buildWeeklyReport(tasks, projects, {
        weekOffset,
        weekStart,
        weekEnd
      }),
    [tasks, projects, weekOffset, weekStart, weekEnd]
  )
  const generated = format === 'text' ? report.text : report.markdown

  useEffect(() => {
    setDraft(generated)
  }, [generated])

  if (!open) return null

  const copyText = async (text: string, key: string): Promise<void> => {
    if (!text.trim()) return
    try {
      await window.taskmind.app.copyText(text)
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey(null), 1600)
      toastSuccess('已复制到剪贴板')
    } catch (err) {
      toastError(getErrorMessage(err, '复制失败'))
    }
  }

  const copyProject = (key: string, summary: string): void => {
    void copyText(`${summary}`, `project-${key}`)
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) closeWeeklyReport()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-[140] animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[145] flex max-h-[92vh] w-[1120px] max-w-[calc(100vw-48px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)] animate-scale-in">
          <div className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                <CalendarRange className="h-5 w-5" />
              </div>
              <div>
                <Dialog.Title className="text-base font-semibold text-[var(--fg)]">
                  工作小结
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 text-xs text-[var(--muted)]">
                  按本周完成的任务整理，默认只包含项目、任务、客户和完成日期。
                </Dialog.Description>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setWeekOffset((current) => current - 1)}
                title="上一周"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                上一周
              </Button>
              <span className="min-w-[128px] text-center text-xs font-medium text-[var(--fg)]">
                {rangeLabel}
              </span>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setWeekOffset((current) => Math.min(0, current + 1))}
                disabled={weekOffset >= 0}
                title="下一周"
              >
                下一周
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              {weekOffset !== 0 ? (
                <Button size="xs" variant="secondary" onClick={() => setWeekOffset(0)}>
                  回到本周
                </Button>
              ) : null}
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" title="关闭">
                  <X className="h-5 w-5" />
                </Button>
              </Dialog.Close>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 lg:overflow-hidden">
            {error ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-6 py-10 text-center">
                <AlertTriangle className="h-6 w-6 text-[var(--danger)]" />
                <p className="text-sm text-[var(--danger)]">{error}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setReloadKey((current) => current + 1)}
                >
                  重试
                </Button>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center gap-2 py-24 text-sm text-[var(--muted)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在整理这一周的工作…
              </div>
            ) : (
              <div className="grid h-full grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
                <div className="min-w-0 space-y-3 lg:h-full lg:overflow-y-auto lg:pr-1">
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5">
                    <span className="text-sm font-semibold text-[var(--fg)]">
                      完成 {report.totalTasks} 项
                    </span>
                    <span className="text-[11px] text-[var(--muted)]">
                      涉及 {report.projectCount} 个项目
                      {report.unassignedCount > 0
                        ? ` · ${report.unassignedCount} 项未关联`
                        : ''}
                    </span>
                  </div>

                  {report.groups.length === 0 ? (
                    <div className="flex flex-col items-center rounded-2xl border border-dashed border-[var(--border-strong)] px-6 py-16 text-center">
                      <CalendarRange className="h-7 w-7 text-[var(--muted)]" />
                      <p className="mt-3 text-sm font-medium text-[var(--fg)]">
                        {report.weekWord}还没有完成的任务
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        可以切换上一周看看，或者完成任务后再来整理。
                      </p>
                    </div>
                  ) : (
                    report.groups.map((group) => (
                      <section
                        key={group.key}
                        className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
                      >
                        <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-4 py-3">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: group.color }}
                          />
                          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--fg)]">
                            {group.name}
                          </h3>
                          <span className="rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                            {group.tasks.length} 项
                          </span>
                        </div>
                        <div className="px-4 py-3">
                          <ul className="space-y-1.5">
                            {group.tasks.map((task) => (
                              <li
                                key={task.id}
                                className="flex min-w-0 items-baseline gap-2 text-[12px] text-[var(--muted)]"
                              >
                                <span className="shrink-0 font-mono text-[10px] text-[var(--muted)]">
                                  {task.completedAt
                                    ? formatDate(new Date(task.completedAt), 'MM-dd')
                                    : '—'}
                                </span>
                                <span className="min-w-0 flex-1 text-[var(--fg)]">
                                  {task.title}
                                </span>
                                {task.client ? (
                                  <span className="shrink-0 text-[10px] text-[var(--muted)]">
                                    {task.client}
                                  </span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                          <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5">
                            <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
                              一句话总结
                            </div>
                            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                              {group.summary}
                            </p>
                            <Button
                              size="xs"
                              variant="soft"
                              className="mt-2"
                              onClick={() => copyProject(group.key, group.summary)}
                            >
                              <Copy className="h-3 w-3" />
                              {copiedKey === `project-${group.key}` ? '已复制' : '复制一句话'}
                            </Button>
                          </div>
                        </div>
                      </section>
                    ))
                  )}
                </div>

                <div className="flex min-w-0 flex-col self-start rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 lg:h-full lg:self-stretch">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-[var(--muted)]" />
                      <span className="text-xs font-semibold text-[var(--fg)]">
                        整份周报预览
                      </span>
                    </div>
                    <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
                      {(['text', 'markdown'] as const).map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={cn(
                            'rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
                            format === item
                              ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                              : 'text-[var(--muted)] hover:text-[var(--fg)]'
                          )}
                          onClick={() => setFormat(item)}
                        >
                          {item === 'text' ? '纯文本' : 'Markdown'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    spellCheck={false}
                    className="mt-2 min-h-[280px] w-full flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 font-mono text-[11px] leading-5 text-[var(--fg)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-teal-500/15"
                    aria-label="整份周报预览"
                  />
                  <p className="mt-1.5 px-1 text-[10px] leading-4 text-[var(--muted)]">
                    可以直接修改预览内容；复制时不会包含任务内容或备注。
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => void copyText(draft, 'full-report')}
                      disabled={!draft.trim()}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copiedKey === 'full-report' ? '已复制' : '复制整份周报'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDraft(generated)}
                      title="恢复为自动生成的预览"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      重新生成
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
