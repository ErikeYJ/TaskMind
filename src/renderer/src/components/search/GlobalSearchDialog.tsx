import { useEffect, useMemo, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ArrowDown, ArrowUp, CornerDownLeft, Loader2, Search, X } from 'lucide-react'
import type { Task } from '@shared/types'
import { useTaskStore } from '../../stores/taskStore'
import { DueBadge, StatusBadge } from '../ui/Badges'
import { ProjectBadge } from '../projects/ProjectBadge'
import { cn, getErrorMessage } from '../../lib/utils'

const SEARCH_DEBOUNCE_MS = 220

function Highlight({ text, query }: { text: string; query: string }): React.JSX.Element {
  const needle = query.trim().toLowerCase()
  if (!needle) return <>{text}</>
  const index = text.toLowerCase().indexOf(needle)
  if (index < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-amber-200/70 px-0.5 text-inherit dark:bg-amber-300/25">
        {text.slice(index, index + needle.length)}
      </mark>
      {text.slice(index + needle.length)}
    </>
  )
}

function snippetFor(task: Task, query: string): string {
  const needle = query.trim().toLowerCase()
  if (!needle) return task.content.slice(0, 120)
  const candidates = [task.content, task.notes, task.client ?? '']
  const field = candidates.find((value) => value.toLowerCase().includes(needle))
  if (!field) return task.content.slice(0, 120)
  const index = field.toLowerCase().indexOf(needle)
  const start = Math.max(0, index - 28)
  const end = Math.min(field.length, index + needle.length + 80)
  return `${start > 0 ? '…' : ''}${field.slice(start, end)}${end < field.length ? '…' : ''}`
}

export function GlobalSearchDialog(): React.JSX.Element {
  const open = useTaskStore((state) => state.searchOpen)
  const closeSearch = useTaskStore((state) => state.closeSearch)
  const projects = useTaskStore((state) => state.projects)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([])
  const requestId = useRef(0)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return
      const state = useTaskStore.getState()
      if (state.searchOpen) {
        event.preventDefault()
        state.closeSearch()
        return
      }
      if (document.querySelector('[role="dialog"]')) return
      event.preventDefault()
      state.openSearch()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!open) {
      requestId.current += 1
      return
    }
    requestId.current += 1
    setQuery('')
    setResults([])
    setLoading(false)
    setError(null)
    setActiveIndex(-1)
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) return
    const trimmed = query.trim()
    const id = ++requestId.current
    if (!trimmed) {
      setResults([])
      setLoading(false)
      setError(null)
      setActiveIndex(-1)
      return
    }

    setLoading(true)
    setError(null)
    setResults([])
    setActiveIndex(-1)
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const found = await window.taskmind.tasks.search(trimmed)
          if (id !== requestId.current) return
          setResults(found)
          setActiveIndex(found.length > 0 ? 0 : -1)
        } catch (err) {
          if (id !== requestId.current) return
          setResults([])
          setActiveIndex(-1)
          setError(getErrorMessage(err, '搜索失败'))
        } finally {
          if (id === requestId.current) setLoading(false)
        }
      })()
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [open, query])

  useEffect(() => {
    if (activeIndex < 0) return
    resultRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const activeTask = activeIndex >= 0 ? results[activeIndex] : undefined
  const queryActive = query.trim().length > 0
  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  )

  const openTask = (task: Task): void => {
    closeSearch()
    void useTaskStore.getState().openTaskById(task.id)
  }

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (results.length > 0) {
        setActiveIndex((current) => (current + 1) % results.length)
      }
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (results.length > 0) {
        setActiveIndex((current) => (current - 1 + results.length) % results.length)
      }
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      if (activeTask) openTask(activeTask)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      closeSearch()
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) closeSearch()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-[160] animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-[10vh] z-[170] flex max-h-[76vh] w-[680px] max-w-[calc(100vw-48px)] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)] animate-scale-in">
          <Dialog.Title className="sr-only">搜索任务</Dialog.Title>
          <Dialog.Description className="sr-only">
            搜索全部任务，不受当前视图和项目筛选影响。
          </Dialog.Description>

          <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] px-5">
            <Search className="h-5 w-5 shrink-0 text-[var(--muted)]" />
            <input
              id="global-search"
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="搜索标题、客户、内容、备注、项目…"
              maxLength={100}
              autoComplete="off"
              className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-[var(--fg)] outline-none placeholder:text-[var(--muted)]"
            />
            {loading ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--primary)]" />
            ) : null}
            <button
              type="button"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
              onClick={closeSearch}
              title="关闭搜索"
              aria-label="关闭搜索"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="shrink-0 border-b border-[var(--border)] px-5 py-2 text-[11px] text-[var(--muted)]">
            搜索全部任务，不受当前视图和项目筛选影响
            {queryActive && !loading && !error ? ` · 找到 ${results.length} 条` : ''}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {!queryActive ? (
              <div className="flex flex-col items-center px-6 py-14 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
                  <Search className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-medium text-[var(--fg)]">搜索全部任务</p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  支持任务名称、客户、内容、备注和项目名。
                  <br />
                  试试搜客户名、门禁密码或者项目名。
                </p>
              </div>
            ) : error ? (
              <div className="px-5 py-12 text-center text-sm text-[var(--danger)]">{error}</div>
            ) : loading && results.length === 0 ? (
              <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-[var(--muted)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在搜索…
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-14 text-center">
                <p className="text-sm font-medium text-[var(--fg)]">没有找到相关任务</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  换个客户名、项目名或任务里的关键词试试。
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {results.map((task, index) => {
                  const project = task.projectId ? projectById.get(task.projectId) : undefined
                  const snippet = snippetFor(task, query)
                  const active = index === activeIndex
                  return (
                    <button
                      key={task.id}
                      ref={(element) => {
                        resultRefs.current[index] = element
                      }}
                      type="button"
                      className={cn(
                        'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                        active
                          ? 'bg-[var(--surface-hover)]'
                          : 'hover:bg-[var(--surface-soft)]'
                      )}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => openTask(task)}
                    >
                      <StatusBadge status={task.status} className="mt-0.5 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-medium text-[var(--fg)]">
                            <Highlight text={task.title} query={query} />
                          </span>
                          {project ? <ProjectBadge project={project} className="shrink-0" /> : null}
                          {task.dueDate ? (
                            <DueBadge task={task} showIcon={false} className="shrink-0" />
                          ) : null}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-[var(--muted)]">
                          {task.client ? (
                            <span>
                              客户：<Highlight text={task.client} query={query} />
                            </span>
                          ) : null}
                          {task.screenshots.length > 0 ? (
                            <span>{task.screenshots.length} 张截图</span>
                          ) : null}
                        </span>
                        {snippet ? (
                          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[var(--muted)]">
                            <Highlight text={snippet} query={query} />
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={cn(
                          'mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--muted)]',
                          active ? 'bg-[var(--surface)]' : 'opacity-0'
                        )}
                      >
                        <CornerDownLeft className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-2.5 text-[11px] text-[var(--muted)]">
            <span>
              {loading
                ? '搜索中…'
                : queryActive
                  ? results.length > 0
                    ? `找到 ${results.length} 个任务`
                    : '没有结果'
                  : '输入关键词开始搜索'}
            </span>
            <span className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <ArrowUp className="h-3 w-3" />
                <ArrowDown className="h-3 w-3" />
                选择
              </span>
              <span className="inline-flex items-center gap-1">
                <CornerDownLeft className="h-3 w-3" />
                打开
              </span>
              <span>Esc 关闭</span>
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
