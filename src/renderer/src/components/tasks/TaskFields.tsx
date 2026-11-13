import { useState } from 'react'
import { addDays, getDay, startOfDay } from 'date-fns'
import { Plus, Sparkles, X } from 'lucide-react'
import { parseNaturalDate, toDateString } from '@shared/date'
import type { Task } from '@shared/types'
import { useTaskStore } from '../../stores/taskStore'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'

export interface TaskFormValue {
  title: string
  projectId: string
  client: string
  content: string
  notes: string
  dueDate: string
  dueTime: string
}

export const EMPTY_TASK_FORM: TaskFormValue = {
  title: '',
  projectId: '',
  client: '',
  content: '',
  notes: '',
  dueDate: '',
  dueTime: ''
}

export function taskToForm(task: Task): TaskFormValue {
  return {
    title: task.title,
    projectId: task.projectId ?? '',
    client: task.client ?? '',
    content: task.content,
    notes: task.notes,
    dueDate: task.dueDate ?? '',
    dueTime: task.dueTime ?? ''
  }
}

export const inputClass =
  'h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--fg)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-teal-500/15 disabled:opacity-50'

export const textareaClass =
  'w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm leading-6 text-[var(--fg)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-teal-500/15 disabled:opacity-50'

function labelClass(): string {
  return 'mb-1.5 block text-xs font-medium text-[var(--muted)]'
}

function nextMondayString(): string {
  const base = startOfDay(new Date())
  const day = getDay(base)
  const days = ((8 - day) % 7) || 7
  return toDateString(addDays(base, days))
}

interface TaskFieldsProps {
  value: TaskFormValue
  onChange: (patch: Partial<TaskFormValue>) => void
  disabled?: boolean
  autoFocus?: boolean
  compact?: boolean
  projectHint?: string | null
}

export function TaskFields({
  value,
  onChange,
  disabled = false,
  autoFocus = false,
  compact = false,
  projectHint = null
}: TaskFieldsProps): React.JSX.Element {
  const [natural, setNatural] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  const projects = useTaskStore((state) => state.projects)
  const openProjectEditor = useTaskStore((state) => state.openProjectEditor)
  const selectedProject = projects.find((project) => project.id === value.projectId)
  const today = toDateString(new Date())
  const tomorrow = toDateString(addDays(new Date(), 1))
  const dayAfter = toDateString(addDays(new Date(), 2))
  const nextWeek = nextMondayString()

  const parseNatural = (): void => {
    const text = natural.trim()
    if (!text) return
    const parsed = parseNaturalDate(text)
    if (!parsed.matched) {
      setHint('没识别出来，可以试试「明天下午3点」「下周三上午10点」')
      return
    }
    onChange({
      dueDate: parsed.dueDate ?? '',
      dueTime: parsed.dueTime ?? ''
    })
    setHint(
      parsed.dueDate
        ? `已设为 ${parsed.dueDate}${parsed.dueTime ? ` ${parsed.dueTime}` : ''}`
        : '没有识别到日期'
    )
    setNatural('')
  }

  const setQuickDate = (date: string): void => {
    onChange({ dueDate: date, dueTime: value.dueTime })
  }

  return (
    <div className={cn('space-y-4', compact && 'space-y-3')}>
      <div>
        <label className={labelClass()} htmlFor="task-title">
          任务名称 <span className="text-[var(--danger)]">*</span>
        </label>
        <input
          id="task-title"
          className={inputClass}
          value={value.title}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder="例如：去金色家园 3 栋 502 安装窗帘"
          maxLength={200}
          disabled={disabled}
          autoFocus={autoFocus}
        />
      </div>

      <div>
        <label className={labelClass()} htmlFor="task-project">
          项目
        </label>
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-300"
            style={selectedProject ? { backgroundColor: selectedProject.color } : undefined}
          />
          <select
            id="task-project"
            className={cn(inputClass, 'min-w-0 flex-1 cursor-pointer')}
            value={value.projectId}
            onChange={(event) => onChange({ projectId: event.target.value })}
            disabled={disabled || projects.length === 0}
          >
            <option value="">{projects.length === 0 ? '还没有项目' : '不关联项目'}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-xs font-medium text-[var(--fg)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-50"
            onClick={() =>
              openProjectEditor(null, (project) => onChange({ projectId: project.id }))
            }
            disabled={disabled}
            title="新建项目"
          >
            <Plus className="h-3.5 w-3.5" />
            新建项目
          </button>
        </div>
        {projects.length === 0 ? (
          <p className="mt-1.5 text-[11px] text-[var(--muted)]">
            还没有项目，可以直接点「新建项目」创建并关联。
          </p>
        ) : projectHint ? (
          <p className="mt-1.5 text-[11px] text-[var(--primary)]">{projectHint}</p>
        ) : null}
      </div>

      <div>
        <label className={labelClass()} htmlFor="task-client">
          客户 / 来源
        </label>
        <input
          id="task-client"
          className={inputClass}
          value={value.client}
          onChange={(event) => onChange({ client: event.target.value })}
          placeholder="例如：王先生、金色家园 3 栋 502（可留空）"
          maxLength={160}
          disabled={disabled}
        />
      </div>

      <div>
        <label className={labelClass()} htmlFor="task-content">
          任务内容
        </label>
        <textarea
          id="task-content"
          className={textareaClass}
          value={value.content}
          onChange={(event) => onChange({ content: event.target.value })}
          placeholder="地址、要求、要带的东西……"
          rows={compact ? 3 : 4}
          maxLength={20_000}
          disabled={disabled}
        />
      </div>

      <div>
        <label className={labelClass()}>截止日期</label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            className={cn(inputClass, 'h-9 flex-1 min-w-[150px]')}
            value={value.dueDate}
            onChange={(event) =>
              onChange({
                dueDate: event.target.value,
                dueTime: event.target.value ? value.dueTime : ''
              })
            }
            disabled={disabled}
          />
          <input
            type="time"
            className={cn(inputClass, 'h-9 w-[122px]')}
            value={value.dueTime}
            onChange={(event) => onChange({ dueTime: event.target.value })}
            disabled={disabled || !value.dueDate}
            aria-label="截止时间"
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {[
            ['今天', today],
            ['明天', tomorrow],
            ['后天', dayAfter],
            ['下周', nextWeek]
          ].map(([label, date]) => (
            <button
              key={label}
              type="button"
              disabled={disabled}
              className={cn(
                'rounded-lg px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50',
                value.dueDate === date
                  ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                  : 'text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]'
              )}
              onClick={() => setQuickDate(date)}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] disabled:opacity-50"
            onClick={() => onChange({ dueDate: '', dueTime: '' })}
          >
            <X className="h-3 w-3" />
            清除
          </button>
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <div className="relative flex-1">
            <Sparkles className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
            <input
              className={cn(inputClass, 'h-9 pl-8 text-xs')}
              value={natural}
              onChange={(event) => {
                setNatural(event.target.value)
                setHint(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  parseNatural()
                }
              }}
              placeholder="也可以直接输入：明天下午3点"
              disabled={disabled}
            />
          </div>
          <Button type="button" size="xs" variant="secondary" onClick={parseNatural} disabled={disabled}>
            解析
          </Button>
        </div>
        {hint ? <p className="mt-1.5 text-[11px] text-[var(--muted)]">{hint}</p> : null}
      </div>

      <div>
        <label className={labelClass()} htmlFor="task-notes">
          备注
        </label>
        <textarea
          id="task-notes"
          className={textareaClass}
          value={value.notes}
          onChange={(event) => onChange({ notes: event.target.value })}
          placeholder="提醒事项，例如：记得带轨道和膨胀螺丝"
          rows={compact ? 2 : 3}
          maxLength={10_000}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
