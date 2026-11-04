import {
  addDays,
  differenceInCalendarDays,
  format,
  isValid,
  startOfDay
} from 'date-fns'
import type { Task } from './types'

const WEEKDAY_CN = ['日', '一', '二', '三', '四', '五', '六'] as const
const WEEKDAY_MAP: Record<string, number> = {
  日: 0,
  天: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6
}

export interface DueLabel {
  text: string
  tone: 'overdue' | 'today' | 'soon' | 'normal' | 'none'
}

export function toDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function toTimeString(date: Date): string {
  return format(date, 'HH:mm')
}

export function getTodayString(now = new Date()): string {
  return toDateString(now)
}

export function getLocalTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai'
  } catch {
    return 'Asia/Shanghai'
  }
}

export function parseLocalDate(dateString: string | null | undefined): Date | null {
  if (!dateString) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day, 12, 0, 0, 0)
  if (
    !isValid(date) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

export function isValidDateString(dateString: string | null | undefined): dateString is string {
  return Boolean(dateString && parseLocalDate(dateString))
}

export function isValidTimeString(timeString: string | null | undefined): timeString is string {
  return Boolean(timeString && /^([01]\d|2[0-3]):[0-5]\d$/.test(timeString))
}

export function combineDateTime(
  dateString: string | null | undefined,
  timeString: string | null | undefined
): Date | null {
  const date = parseLocalDate(dateString)
  if (!date) return null
  if (!isValidTimeString(timeString)) {
    date.setHours(23, 59, 59, 999)
    return date
  }
  const [hours, minutes] = timeString.split(':').map(Number)
  date.setHours(hours, minutes, 0, 0)
  return date
}

export function isTaskOverdue(
  task: Pick<Task, 'dueDate' | 'dueTime'>,
  now = new Date()
): boolean {
  if (!task.dueDate) return false
  const today = getTodayString(now)
  if (task.dueDate < today) return true
  if (task.dueDate > today) return false
  if (!isValidTimeString(task.dueTime)) return false
  const due = combineDateTime(task.dueDate, task.dueTime)
  return Boolean(due && due.getTime() < now.getTime())
}

export function formatDueLabel(
  task: Pick<Task, 'dueDate' | 'dueTime'>,
  now = new Date()
): DueLabel {
  if (!task.dueDate) {
    return { text: '未设日期', tone: 'none' }
  }

  const dueDate = parseLocalDate(task.dueDate)
  if (!dueDate) {
    return { text: '日期无效', tone: 'none' }
  }

  const base = startOfDay(now)
  const diff = differenceInCalendarDays(dueDate, base)
  const time = isValidTimeString(task.dueTime) ? ` ${task.dueTime}` : ''

  if (diff < 0) {
    return { text: `逾期 ${Math.abs(diff)} 天${time}`, tone: 'overdue' }
  }

  if (diff === 0) {
    if (isValidTimeString(task.dueTime)) {
      const due = combineDateTime(task.dueDate, task.dueTime)
      if (due && due.getTime() < now.getTime()) {
        const minutes = Math.max(1, Math.floor((now.getTime() - due.getTime()) / 60_000))
        const late = minutes < 60 ? `${minutes} 分钟` : `${Math.floor(minutes / 60)} 小时`
        return { text: `已超时 ${late}`, tone: 'overdue' }
      }
    }
    return { text: `今天${time}`, tone: 'today' }
  }

  if (diff === 1) {
    return { text: `明天${time}`, tone: 'soon' }
  }

  if (diff > 1 && diff <= 7) {
    return { text: `周${WEEKDAY_CN[dueDate.getDay()]}${time}`, tone: 'normal' }
  }

  if (dueDate.getFullYear() === now.getFullYear()) {
    return { text: `${dueDate.getMonth() + 1}月${dueDate.getDate()}日${time}`, tone: 'normal' }
  }

  return {
    text: `${dueDate.getFullYear()}年${dueDate.getMonth() + 1}月${dueDate.getDate()}日${time}`,
    tone: 'normal'
  }
}

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (!isValid(date)) return ''
  return format(date, 'yyyy-MM-dd HH:mm')
}

export function formatShortDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (!isValid(date)) return ''
  return format(date, 'M月d日 HH:mm')
}

function normalizeNaturalInput(input: string): string {
  return input
    .trim()
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[：]/g, ':')
    .replace(/[／]/g, '/')
    .replace(/[－]/g, '-')
}

function nextMonday(base: Date): Date {
  const day = base.getDay()
  const days = ((8 - day) % 7) || 7
  return addDays(base, days)
}

function parseTimePart(text: string): string | null {
  const periodPattern = /(上午|早上|早晨|凌晨|中午|下午|晚上|夜里)\s*(\d{1,2})\s*[点时:]\s*(\d{1,2})?\s*分?/
  const plainPattern = /(\d{1,2})\s*[点时:]\s*(\d{1,2})?\s*分?/
  const colonPattern = /(\d{1,2}):(\d{2})/

  let period = ''
  let hourText = ''
  let minuteText = ''

  const periodMatch = periodPattern.exec(text)
  if (periodMatch) {
    period = periodMatch[1]
    hourText = periodMatch[2]
    minuteText = periodMatch[3] ?? '0'
  } else {
    const colonMatch = colonPattern.exec(text)
    if (colonMatch) {
      hourText = colonMatch[1]
      minuteText = colonMatch[2]
    } else {
      const plainMatch = plainPattern.exec(text)
      if (plainMatch) {
        hourText = plainMatch[1]
        minuteText = plainMatch[2] ?? '0'
      }
    }
  }

  if (!hourText) return null
  let hour = Number(hourText)
  const minute = Number(minuteText || 0)
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    return null
  }

  if (period === '下午' || period === '晚上' || period === '夜里') {
    if (hour < 12) hour += 12
  } else if (period === '中午') {
    if (hour < 11) hour += 12
  } else if (period === '凌晨') {
    if (hour === 12) hour = 0
  }

  if (hour < 0 || hour > 23) return null
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export interface NaturalDateResult {
  dueDate: string | null
  dueTime: string | null
  matched: boolean
}

/**
 * 解析中文自然语言日期，例如：明天下午3点、下周三、11月8日、后天 09:30。
 * 识别不到日期时返回 null；只有时间时会落在今天。
 */
export function parseNaturalDate(input: string, now = new Date()): NaturalDateResult {
  const text = normalizeNaturalInput(input)
  if (!text) return { dueDate: null, dueTime: null, matched: false }

  const base = startOfDay(now)
  let date: Date | null = null

  const explicitFull = /(\d{4})\s*[年\-/.]\s*(\d{1,2})\s*[月\-/.]\s*(\d{1,2})\s*[日号]?/.exec(text)
  const explicitMonthDay = /(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/.exec(text)

  if (explicitFull) {
    date = new Date(Number(explicitFull[1]), Number(explicitFull[2]) - 1, Number(explicitFull[3]))
  } else if (explicitMonthDay) {
    date = new Date(now.getFullYear(), Number(explicitMonthDay[1]) - 1, Number(explicitMonthDay[2]))
  } else {
    const nextWeekMatch = /下周([一二三四五六日天])/.exec(text)
    if (nextWeekMatch) {
      const target = WEEKDAY_MAP[nextWeekMatch[1]]
      const monday = nextMonday(base)
      date = addDays(monday, target === 0 ? 6 : target - 1)
    } else if (/下周/.test(text)) {
      date = nextMonday(base)
    } else {
      const weekdayMatch = /(?:周|星期|礼拜)([一二三四五六日天])/.exec(text)
      if (weekdayMatch) {
        const target = WEEKDAY_MAP[weekdayMatch[1]]
        const current = base.getDay()
        const delta = (target - current + 7) % 7
        date = addDays(base, delta)
      } else if (/大后天/.test(text)) {
        date = addDays(base, 3)
      } else if (/后天/.test(text)) {
        date = addDays(base, 2)
      } else if (/明天|明日/.test(text)) {
        date = addDays(base, 1)
      } else if (/今天|今日/.test(text)) {
        date = base
      }
    }
  }

  const dueTime = parseTimePart(text)

  if (!date && !dueTime) {
    return { dueDate: null, dueTime: null, matched: false }
  }

  if (!date && dueTime) {
    date = base
  }

  if (date && !isValid(date)) {
    return { dueDate: null, dueTime, matched: true }
  }

  return {
    dueDate: date ? toDateString(date) : null,
    dueTime,
    matched: true
  }
}

export function weekdayLabel(dateString: string): string {
  const date = parseLocalDate(dateString)
  return date ? `周${WEEKDAY_CN[date.getDay()]}` : ''
}
