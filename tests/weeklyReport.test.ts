import { describe, expect, it } from 'vitest'
import { buildWeeklyReport } from '../src/shared/weeklyReport'
import type { Project, Task } from '../src/shared/types'

function project(id: string, name: string, color: string): Project {
  return {
    id,
    name,
    color,
    pinned: false,
    sortOrder: 0,
    archivedAt: null,
    openTaskCount: 0,
    totalTaskCount: 0,
    createdAt: '2026-11-17T00:00:00.000Z',
    updatedAt: '2026-11-17T00:00:00.000Z'
  }
}

function task(
  input: { id: string; title: string; completedAt: string } & Partial<Task>
): Task {
  return {
    content: '',
    client: null,
    notes: '',
    projectId: null,
    dueDate: null,
    dueTime: null,
    status: 'done',
    statusBeforeSuspend: null,
    statusBeforeDone: 'todo',
    startedAt: null,
    suspendedAt: null,
    createdAt: '2026-11-17T00:00:00.000Z',
    updatedAt: '2026-11-17T00:00:00.000Z',
    screenshots: [],
    ...input
  }
}

describe('weekly report', () => {
  it('groups completed tasks by project and unassigned with safe fields only', () => {
    const gold = project('p1', '金色花园安装', '#0d9488')
    const store = project('p2', '门店维护', '#2563eb')
    const report = buildWeeklyReport(
      [
        task({
          id: 't1',
          title: '安装门窗',
          client: '李姐',
          projectId: gold.id,
          completedAt: '2026-11-18T03:00:00.000Z',
          notes: '不要出现在周报'
        }),
        task({
          id: 't2',
          title: '回访客户',
          client: '李姐',
          projectId: gold.id,
          completedAt: '2026-11-19T03:00:00.000Z'
        }),
        task({
          id: 't3',
          title: '更换门锁',
          client: '王老板',
          projectId: store.id,
          completedAt: '2026-11-20T03:00:00.000Z'
        }),
        task({
          id: 't4',
          title: '整理材料',
          completedAt: '2026-11-21T03:00:00.000Z'
        })
      ],
      [gold, store],
      {
        weekOffset: 0,
        weekStart: new Date(2026, 10, 16),
        weekEnd: new Date(2026, 10, 23)
      }
    )

    expect(report.totalTasks).toBe(4)
    expect(report.projectCount).toBe(2)
    expect(report.unassignedCount).toBe(1)
    expect(report.groups.map((group) => group.name)).toEqual([
      '金色花园安装',
      '门店维护',
      '未关联项目'
    ])
    expect(report.groups[0].summary).toContain('本周在「金色花园安装」完成了 2 项工作')
    expect(report.groups[0].summary).toContain('李姐')
    expect(report.text).not.toContain('不要出现在周报')
    expect(report.text).toContain('【未关联项目】完成 1 项')
    expect(report.markdown).toContain('### 金色花园安装 · 完成 2 项')
    expect(report.markdown).toContain('> 本周在「金色花园安装」完成了 2 项工作')
  })

  it('uses the selected week wording and handles empty weeks', () => {
    const empty = buildWeeklyReport([], [], {
      weekOffset: -1,
      weekStart: new Date(2026, 10, 9),
      weekEnd: new Date(2026, 10, 16)
    })
    expect(empty.title).toBe('上周工作小结')
    expect(empty.text).toContain('上周没有已完成的任务')
    expect(empty.projectCount).toBe(0)
  })
})
