import type { Project } from '@shared/types'
import { cn } from '../../lib/utils'

interface ProjectBadgeProps {
  project: Project
  className?: string
}

export function ProjectBadge({ project, className }: ProjectBadgeProps): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex max-w-[220px] items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-0.5 text-[11px] text-[var(--muted)]',
        className
      )}
      title={project.name}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: project.color }}
      />
      <span className="truncate">{project.name}</span>
    </span>
  )
}
