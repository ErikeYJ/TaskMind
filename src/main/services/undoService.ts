import { randomUUID } from 'node:crypto'
import type { DeleteUndoResult, UndoResult } from '../../shared/types'
import type { DeletedProjectSnapshot, ProjectService } from './projectService'
import type { DeletedTaskSnapshot, TaskService } from './taskService'

const DEFAULT_UNDO_TIMEOUT_MS = 10_000

interface UndoBase {
  token: string
  timer: ReturnType<typeof setTimeout>
}

interface TaskUndoEntry extends UndoBase {
  kind: 'task'
  snapshot: DeletedTaskSnapshot
}

interface ProjectUndoEntry extends UndoBase {
  kind: 'project'
  snapshot: DeletedProjectSnapshot
}

type UndoEntry = TaskUndoEntry | ProjectUndoEntry

export class UndoService {
  private readonly pending = new Map<string, UndoEntry>()

  constructor(
    private readonly tasks: TaskService,
    private readonly projects: ProjectService,
    private readonly timeoutMs = DEFAULT_UNDO_TIMEOUT_MS
  ) {}

  deleteTask(id: string): DeleteUndoResult {
    const snapshot = this.tasks.deleteWithSnapshot(id)
    if (!snapshot) return { ok: true, message: '任务不存在或已删除' }
    const token = randomUUID()
    const timer = setTimeout(() => this.finalize(token), this.timeoutMs)
    timer.unref?.()
    this.pending.set(token, { kind: 'task', token, snapshot, timer })
    return { ok: true, undoToken: token }
  }

  deleteProject(id: string): DeleteUndoResult {
    const snapshot = this.projects.deleteWithSnapshot(id)
    if (!snapshot) return { ok: true, message: '项目不存在或已删除' }
    const token = randomUUID()
    const timer = setTimeout(() => this.finalize(token), this.timeoutMs)
    timer.unref?.()
    this.pending.set(token, { kind: 'project', token, snapshot, timer })
    return { ok: true, undoToken: token }
  }

  undo(token: string): UndoResult {
    const entry = this.pending.get(token)
    if (!entry) return { ok: false, message: '撤销已过期' }
    clearTimeout(entry.timer)
    this.pending.delete(token)
    try {
      if (entry.kind === 'task') {
        this.tasks.restoreDeleted(entry.snapshot)
        return { ok: true, message: '任务已恢复' }
      }
      this.projects.restoreDeleted(entry.snapshot)
      return { ok: true, message: '项目已恢复' }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : '撤销失败'
      }
    }
  }

  async dispose(): Promise<void> {
    const entries = Array.from(this.pending.values())
    this.pending.clear()
    for (const entry of entries) {
      clearTimeout(entry.timer)
      if (entry.kind === 'task') {
        await this.tasks.finalizeDeleted(entry.snapshot).catch((error) => {
          console.error('[TaskMind] failed to clean deleted task files:', error)
        })
      }
    }
  }

  private finalize(token: string): void {
    const entry = this.pending.get(token)
    if (!entry) return
    clearTimeout(entry.timer)
    this.pending.delete(token)
    if (entry.kind === 'task') {
      void this.tasks.finalizeDeleted(entry.snapshot).catch((error) => {
        console.error('[TaskMind] failed to clean deleted task files:', error)
      })
    }
  }
}
