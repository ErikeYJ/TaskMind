import { randomUUID } from 'node:crypto'
import type { AppDatabase } from '../db/database'
import {
  mapScreenshotRow,
  TaskRepository,
  type ScreenshotRow,
  type TaskRow
} from '../db/taskRepository'
import { getTodayString, isValidDateString, isValidTimeString } from '../../shared/date'
import { nextStatusForAction } from '../../shared/status'
import type {
  BallTopTask,
  CreateTaskInput,
  ScreenshotMeta,
  Task,
  TaskAction,
  TaskCounts,
  TaskView,
  UpdateTaskInput
} from '../../shared/types'
import { MAX_SCREENSHOTS_PER_TASK } from '../../shared/constants'
import type { SavedImage } from './mediaService'

export interface TaskMedia {
  saveImage(dataUrl: string): Promise<SavedImage>
  deleteFiles(fileName: string, thumbName: string | null): Promise<void>
}

function nowIso(): string {
  return new Date().toISOString()
}

function normalizeDue(
  dueDate: string | null | undefined,
  dueTime: string | null | undefined
): { dueDate: string | null; dueTime: string | null } {
  const date = typeof dueDate === 'string' && dueDate.trim() ? dueDate.trim() : null
  let time = typeof dueTime === 'string' && dueTime.trim() ? dueTime.trim() : null
  if (date && !isValidDateString(date)) {
    throw new Error('截止日期格式不正确')
  }
  if (time && !isValidTimeString(time)) {
    throw new Error('截止时间格式不正确')
  }
  if (!date) time = null
  return { dueDate: date, dueTime: time }
}

function cleanTitle(title: string): string {
  const value = title.trim()
  if (!value) throw new Error('任务名称不能为空')
  return value
}

export class TaskService {
  private readonly repository: TaskRepository
  private readonly listeners = new Set<() => void>()

  constructor(
    private readonly db: AppDatabase,
    private readonly media: TaskMedia
  ) {
    this.repository = new TaskRepository(db)
  }

  onChanged(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emitChanged(): void {
    for (const listener of this.listeners) {
      try {
        listener()
      } catch {
        // ignore listener errors
      }
    }
  }

  list(view: TaskView): Task[] {
    return this.repository.list(view, getTodayString())
  }

  counts(): TaskCounts {
    return this.repository.counts(getTodayString())
  }

  get(id: string): Task | null {
    return this.repository.get(id)
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const title = cleanTitle(input.title)
    const due = normalizeDue(input.dueDate, input.dueTime)
    const screenshots = input.screenshots ?? []
    if (screenshots.length > MAX_SCREENSHOTS_PER_TASK) {
      throw new Error(`每个任务最多 ${MAX_SCREENSHOTS_PER_TASK} 张截图`)
    }

    const savedImages: SavedImage[] = []
    try {
      for (const screenshot of screenshots) {
        savedImages.push(await this.media.saveImage(screenshot.dataUrl))
      }

      const id = randomUUID()
      const now = nowIso()
      const taskRow: TaskRow = {
        id,
        title,
        content: (input.content ?? '').trim(),
        client: input.client?.trim() || null,
        notes: (input.notes ?? '').trim(),
        due_date: due.dueDate,
        due_time: due.dueTime,
        status: 'todo',
        status_before_suspend: null,
        status_before_done: null,
        started_at: null,
        suspended_at: null,
        completed_at: null,
        created_at: now,
        updated_at: now
      }

      const insert = this.db.transaction(() => {
        this.repository.insert(taskRow)
        for (const image of savedImages) {
          const row: ScreenshotRow = {
            id: image.id,
            task_id: id,
            file_name: image.fileName,
            thumb_name: image.thumbName,
            mime_type: image.mimeType,
            width: image.width,
            height: image.height,
            created_at: now
          }
          this.repository.insertScreenshot(row)
        }
      })
      insert()

      const task = this.repository.get(id)
      if (!task) throw new Error('创建任务失败')
      this.emitChanged()
      return task
    } catch (error) {
      await Promise.all(savedImages.map((image) => this.media.deleteFiles(image.fileName, image.thumbName)))
      throw error
    }
  }

  update(id: string, patch: UpdateTaskInput): Task {
    const existing = this.repository.get(id)
    if (!existing) throw new Error('任务不存在')

    const fields: Parameters<TaskRepository['update']>[1] = { updated_at: nowIso() }

    if (patch.title !== undefined) fields.title = cleanTitle(patch.title)
    if (patch.content !== undefined) fields.content = patch.content.trim()
    if (patch.client !== undefined) fields.client = patch.client?.trim() || null
    if (patch.notes !== undefined) fields.notes = patch.notes.trim()

    if (patch.dueDate !== undefined || patch.dueTime !== undefined) {
      const due = normalizeDue(
        patch.dueDate !== undefined ? patch.dueDate : existing.dueDate,
        patch.dueTime !== undefined ? patch.dueTime : existing.dueTime
      )
      fields.due_date = due.dueDate
      fields.due_time = due.dueTime
    }

    this.repository.update(id, fields)
    const task = this.repository.get(id)
    if (!task) throw new Error('任务不存在')
    this.emitChanged()
    return task
  }

  transition(id: string, action: TaskAction): Task {
    const existing = this.repository.get(id)
    if (!existing) throw new Error('任务不存在')

    const next = nextStatusForAction(
      existing.status,
      action,
      existing.statusBeforeSuspend,
      existing.statusBeforeDone
    )
    if (!next) throw new Error('当前状态不能执行这个操作')

    const now = nowIso()
    const fields: Parameters<TaskRepository['update']>[1] = {
      status: next,
      updated_at: now
    }

    if (action === 'start') {
      fields.started_at = existing.startedAt ?? now
    } else if (action === 'suspend') {
      fields.status_before_suspend = existing.status
      fields.suspended_at = now
    } else if (action === 'resume') {
      fields.status_before_suspend = null
      fields.suspended_at = null
    } else if (action === 'complete') {
      fields.status_before_done = existing.status
      fields.completed_at = now
    } else if (action === 'restore') {
      fields.status_before_done = null
      fields.completed_at = null
      if (next !== 'suspended') {
        fields.status_before_suspend = null
        fields.suspended_at = null
      }
    }

    this.repository.update(id, fields)
    const task = this.repository.get(id)
    if (!task) throw new Error('任务不存在')
    this.emitChanged()
    return task
  }

  async delete(id: string): Promise<void> {
    const existing = this.repository.get(id)
    if (!existing) return
    const screenshotRows = this.repository.listScreenshotsForTask(id)
    this.repository.delete(id)
    await Promise.all(
      screenshotRows.map((row) => this.media.deleteFiles(row.file_name, row.thumb_name))
    )
    this.emitChanged()
  }

  async addScreenshot(taskId: string, dataUrl: string): Promise<ScreenshotMeta> {
    const existing = this.repository.get(taskId)
    if (!existing) throw new Error('任务不存在')
    if (existing.screenshots.length >= MAX_SCREENSHOTS_PER_TASK) {
      throw new Error(`每个任务最多 ${MAX_SCREENSHOTS_PER_TASK} 张截图`)
    }

    const saved = await this.media.saveImage(dataUrl)
    const now = nowIso()
    try {
      const inserted = this.repository.insertScreenshot({
        id: saved.id,
        task_id: taskId,
        file_name: saved.fileName,
        thumb_name: saved.thumbName,
        mime_type: saved.mimeType,
        width: saved.width,
        height: saved.height,
        created_at: now
      })
      this.repository.update(taskId, { updated_at: now })
      this.emitChanged()
      return inserted
    } catch (error) {
      await this.media.deleteFiles(saved.fileName, saved.thumbName)
      throw error
    }
  }

  async deleteScreenshot(id: string): Promise<void> {
    const row = this.repository.getScreenshot(id)
    if (!row) return
    this.repository.deleteScreenshot(id)
    this.repository.update(row.task_id, { updated_at: nowIso() })
    await this.media.deleteFiles(row.file_name, row.thumb_name)
    this.emitChanged()
  }

  getBallTop(): BallTopTask[] {
    return this.repository.listBallTop(3).map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      dueDate: row.due_date,
      dueTime: row.due_time
    }))
  }

  getScreenshotRow(id: string): ScreenshotRow | null {
    return this.repository.getScreenshot(id)
  }

  getRepository(): TaskRepository {
    return this.repository
  }
}

export { mapScreenshotRow }
