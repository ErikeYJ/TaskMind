import { Notification } from 'electron'
import { existsSync } from 'node:fs'
import { getIconPath } from '../appPaths'
import { IPC } from '../../shared/api'
import { getTodayString, toTimeString } from '../../shared/date'
import type { TaskRow } from '../db/taskRepository'
import type { MainWindowManager } from '../windows/mainWindow'
import type { SettingsService } from './settingsService'
import type { TaskService } from './taskService'

interface DueTimeInfo {
  row: TaskRow
  lateMinutes: number
}

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function truncate(text: string, max = 180): string {
  const value = text.replace(/\s+/g, ' ').trim()
  return value.length > max ? `${value.slice(0, max)}…` : value
}

export class ReminderService {
  private timer: NodeJS.Timeout | null = null
  private initialTimer: NodeJS.Timeout | null = null
  private lastDay = getTodayString()
  private ticking = false

  constructor(
    private readonly settings: SettingsService,
    private readonly tasks: TaskService,
    private readonly mainWindow: MainWindowManager,
    private readonly onDayChanged: (today: string) => void
  ) {}

  start(): void {
    this.lastDay = getTodayString()
    this.timer = setInterval(() => void this.tick(), 30_000)
    this.initialTimer = setTimeout(() => void this.tick(), 2_500)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.initialTimer) {
      clearTimeout(this.initialTimer)
      this.initialTimer = null
    }
  }

  async tick(): Promise<void> {
    if (this.ticking) return
    this.ticking = true
    try {
      const now = new Date()
      const today = getTodayString(now)
      const nowTime = toTimeString(now)
      const current = this.settings.getPublic()
      const repository = this.tasks.getRepository()

      if (today !== this.lastDay) {
        this.lastDay = today
        this.onDayChanged(today)
      }

      if (!current.notifications.enabled) return

      if (current.notifications.dailySummary && nowTime >= current.notifications.morningTime) {
        const summaryKey = `summary:${today}`
        if (!repository.hasNotification(summaryKey)) {
          const rows = repository.listDueSummary(today)
          if (rows.length > 0) {
            const overdueCount = rows.filter(
              (row) => row.due_date !== null && row.due_date < today
            ).length
            const title =
              rows.length === 1 ? '今天有 1 个任务要处理' : `今天有 ${rows.length} 个任务要处理`
            const lines = rows.slice(0, 3).map((row) => {
              const overdue = row.due_date !== null && row.due_date < today
              return `• ${row.title}${overdue ? '（逾期）' : ''}`
            })
            if (rows.length > 3) lines.push(`…还有 ${rows.length - 3} 个`)
            if (overdueCount > 0) lines.push(`其中 ${overdueCount} 个已逾期`)
            this.showNotification(title, lines.join('\n'), () => this.mainWindow.show())
          }
          repository.markNotification(summaryKey, now.toISOString())
        }
      }

      if (current.notifications.dueTimeReminders) {
        const candidates = repository.listDueTimeCandidates(today, nowTime)
        const nowMinutes = minutesOf(nowTime)
        for (const row of candidates) {
          if (!row.due_time) continue
          const key = `due:${row.id}:${today}:${row.due_time}`
          if (repository.hasNotification(key)) continue
          const info: DueTimeInfo = {
            row,
            lateMinutes: nowMinutes - minutesOf(row.due_time)
          }
          if (info.lateMinutes >= 0 && info.lateMinutes <= 30) {
            const bodyParts = [`截止时间 ${row.due_time}`]
            if (row.client) bodyParts.push(`客户：${row.client}`)
            if (row.notes) bodyParts.push(truncate(row.notes, 100))
            else if (row.content) bodyParts.push(truncate(row.content, 100))
            this.showNotification(
              `到点提醒：${row.title}`,
              bodyParts.join('\n'),
              () => {
                this.mainWindow.show()
                this.mainWindow.send(IPC.events.navigateTask, row.id)
              }
            )
          }
          repository.markNotification(key, now.toISOString())
        }
      }
    } catch (error) {
      console.error(
        '[TaskMind] reminder tick failed:',
        error instanceof Error ? error.message : 'unknown error'
      )
    } finally {
      this.ticking = false
    }
  }

  private showNotification(title: string, body: string, onClick: () => void): boolean {
    if (!Notification.isSupported()) return false
    try {
      const iconPath = getIconPath()
      const notification = new Notification({
        title,
        body,
        silent: false,
        icon: existsSync(iconPath) ? iconPath : undefined
      })
      notification.on('click', onClick)
      notification.show()
      return true
    } catch {
      return false
    }
  }

  testNotification(): { ok: boolean; message: string } {
    if (!Notification.isSupported()) {
      return { ok: false, message: '当前 Windows 环境不支持通知' }
    }
    const shown = this.showNotification(
      'TaskMind 测试通知',
      '如果你看到这条消息，到期提醒已经可以正常工作。',
      () => this.mainWindow.show()
    )
    return shown
      ? { ok: true, message: '测试通知已发送' }
      : { ok: false, message: '发送测试通知失败' }
  }
}
