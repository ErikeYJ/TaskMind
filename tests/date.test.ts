import { describe, expect, it } from 'vitest'
import {
  formatDueLabel,
  getTodayString,
  isValidDateString,
  isValidTimeString,
  parseNaturalDate
} from '../src/shared/date'

const now = new Date(2026, 10, 4, 10, 0, 0) // 2026-11-04 10:00 local

describe('parseNaturalDate', () => {
  it('parses 明天下午3点', () => {
    expect(parseNaturalDate('明天下午3点', now)).toEqual({
      dueDate: '2026-11-05',
      dueTime: '15:00',
      matched: true
    })
  })

  it('parses 后天', () => {
    expect(parseNaturalDate('后天', now).dueDate).toBe('2026-11-06')
  })

  it('parses 下周三 relative to next Monday', () => {
    expect(parseNaturalDate('下周三', now).dueDate).toBe('2026-11-11')
  })

  it('parses weekday as next occurrence including today', () => {
    expect(parseNaturalDate('周五', now).dueDate).toBe('2026-11-06')
    expect(parseNaturalDate('周三', now).dueDate).toBe('2026-11-04')
  })

  it('parses explicit dates and times', () => {
    expect(parseNaturalDate('11月8日 09:30', now)).toEqual({
      dueDate: '2026-11-08',
      dueTime: '09:30',
      matched: true
    })
    expect(parseNaturalDate('2026-12-01 晚上8点', now)).toEqual({
      dueDate: '2026-12-01',
      dueTime: '20:00',
      matched: true
    })
  })

  it('uses today when only a time is present', () => {
    expect(parseNaturalDate('下午3点', now)).toEqual({
      dueDate: '2026-11-04',
      dueTime: '15:00',
      matched: true
    })
  })

  it('does not mistake addresses for dates or times', () => {
    expect(parseNaturalDate('去金色家园3栋502安装', now)).toEqual({
      dueDate: null,
      dueTime: null,
      matched: false
    })
  })
})

describe('formatDueLabel', () => {
  it('labels tomorrow', () => {
    expect(formatDueLabel({ dueDate: '2026-11-05', dueTime: '15:00' }, now)).toEqual({
      text: '明天 15:00',
      tone: 'soon'
    })
  })

  it('labels overdue days', () => {
    expect(formatDueLabel({ dueDate: '2026-11-03', dueTime: null }, now)).toEqual({
      text: '逾期 1 天',
      tone: 'overdue'
    })
  })

  it('labels today with overdue time', () => {
    expect(formatDueLabel({ dueDate: '2026-11-04', dueTime: '09:00' }, now)).toEqual({
      text: '已超时 1 小时',
      tone: 'overdue'
    })
  })

  it('labels today without time', () => {
    expect(formatDueLabel({ dueDate: '2026-11-04', dueTime: null }, now)).toEqual({
      text: '今天',
      tone: 'today'
    })
  })

  it('labels far dates', () => {
    expect(formatDueLabel({ dueDate: '2026-12-20', dueTime: null }, now)).toEqual({
      text: '12月20日',
      tone: 'normal'
    })
  })
})

describe('date validation', () => {
  it('validates date and time strings', () => {
    expect(isValidDateString('2026-11-04')).toBe(true)
    expect(isValidDateString('2026-02-30')).toBe(false)
    expect(isValidTimeString('09:30')).toBe(true)
    expect(isValidTimeString('24:00')).toBe(false)
  })

  it('returns local today', () => {
    expect(getTodayString(now)).toBe('2026-11-04')
  })
})
