import { CalendarDays, Check, Inbox, Pause, Play, Plus } from 'lucide-react'
import type { Task, TaskView } from '@shared/types'
import { VIEW_SUBTITLES } from '@shared/constants'
import { Button } from '../ui/Button'
import { TaskCard } from './TaskCard'
import { useTaskStore } from '../../stores/taskStore'

const emptyContent: Record<
  TaskView,
  { icon: React.JSX.Element; title: string; description: string }
> = {
  today: {
    icon: <CalendarDays className="h-7 w-7" />,
    title: '今天没有要开始的任务',
    description: '添加一个任务，或者去「未完成」看看后面的安排。'
  },
  all_open: {
    icon: <Inbox className="h-7 w-7" />,
    title: '所有任务都清空了',
    description: '现在没有没做完的任务，可以休息一下。'
  },
  in_progress: {
    icon: <Play className="h-7 w-7" />,
    title: '还没有进行中的任务',
    description: '在任务上点「开始」，它就会出现在这里。'
  },
  completed: {
    icon: <Check className="h-7 w-7" />,
    title: '还没有完成记录',
    description: '完成任务后，会在这里留下记录，也可以随时还原。'
  },
  suspended: {
    icon: <Pause className="h-7 w-7" />,
    title: '没有挂起的任务',
    description: '暂时不做的任务可以挂起，不会出现在浮球和提醒里。'
  }
}

function SkeletonCard(): React.JSX.Element {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 pl-5 shadow-[var(--shadow-soft)]">
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-2/5 rounded bg-[var(--surface-hover)]" />
        <div className="h-3 w-4/5 rounded bg-[var(--surface-hover)]" />
        <div className="flex gap-2">
          <div className="h-5 w-14 rounded-full bg-[var(--surface-hover)]" />
          <div className="h-5 w-16 rounded-full bg-[var(--surface-hover)]" />
        </div>
      </div>
    </div>
  )
}

interface TaskListProps {
  tasks: Task[]
  view: TaskView
  loading: boolean
  error: string | null
  onOpen: (id: string) => void
}

export function TaskList({
  tasks,
  view,
  loading,
  error,
  onOpen
}: TaskListProps): React.JSX.Element {
  const openAdd = useTaskStore((state) => state.openAdd)
  const load = useTaskStore((state) => state.load)

  if (loading) {
    return (
      <div className="space-y-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-8 py-16 text-center">
        <p className="text-sm font-medium text-[var(--fg)]">读取任务失败</p>
        <p className="mt-1 max-w-md text-xs leading-5 text-[var(--muted)]">{error}</p>
        <Button className="mt-4" size="sm" onClick={() => void load()}>
          重新加载
        </Button>
      </div>
    )
  }

  if (tasks.length === 0) {
    const empty = emptyContent[view]
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-8 py-20 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
          {empty.icon}
        </div>
        <h2 className="text-base font-semibold text-[var(--fg)]">{empty.title}</h2>
        <p className="mt-1.5 max-w-md text-sm leading-6 text-[var(--muted)]">
          {empty.description}
        </p>
        <Button className="mt-5" variant="soft" onClick={() => openAdd()}>
          <Plus className="h-4 w-4" />
          添加任务
        </Button>
        <p className="mt-3 text-[11px] text-[var(--muted)]">{VIEW_SUBTITLES[view]}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} onOpen={onOpen} />
      ))}
    </div>
  )
}
