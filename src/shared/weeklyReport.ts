import { addDays, format } from 'date-fns'
import type { Project, Task } from './types'

export type WeeklyReportFormat = 'text' | 'markdown'

export interface WeeklyReportGroup {
  key: string
  projectId: string | null
  name: string
  color: string
  isUnassigned: boolean
  tasks: Task[]
  summary: string
}

export interface WeeklyReport {
  title: string
  weekWord: string
  rangeLabel: string
  groups: WeeklyReportGroup[]
  totalTasks: number
  projectCount: number
  unassignedCount: number
  text: string
  markdown: string
}

interface BuildWeeklyReportOptions {
  weekOffset: number
  weekStart: Date
  weekEnd: Date
}

function limitedJoin(values: string[], limit = 3): string {
  if (values.length <= limit) return values.join('、')
  return `${values.slice(0, limit).join('、')}等`
}

function taskLine(task: Task): string {
  const completed = task.completedAt ? format(new Date(task.completedAt), 'MM-dd') : '—'
  return [completed, task.title, task.client ? `客户：${task.client}` : '']
    .filter(Boolean)
    .join(' · ')
}

function buildSummary(
  weekWord: string,
  groupName: string,
  unassigned: boolean,
  tasks: Task[]
): string {
  const names = tasks.map((task) => task.title)
  const taskPart = limitedJoin(names)
  const clients = Array.from(
    new Set(
      tasks
        .map((task) => task.client?.trim())
        .filter((value): value is string => Boolean(value))
    )
  )
  const clientPart = clients.length > 0 ? `，涉及客户：${limitedJoin(clients)}` : ''
  if (unassigned) {
    return `${weekWord}完成了 ${tasks.length} 项未关联项目的工作：${taskPart}${clientPart}。`
  }
  return `${weekWord}在「${groupName}」完成了 ${tasks.length} 项工作：${taskPart}${clientPart}。`
}

export function buildWeeklyReport(
  tasks: Task[],
  projects: Project[],
  options: BuildWeeklyReportOptions
): WeeklyReport {
  const weekWord =
    options.weekOffset === 0 ? '本周' : options.weekOffset === -1 ? '上周' : '这一周'
  const title =
    options.weekOffset === 0
      ? '本周工作小结'
      : options.weekOffset === -1
        ? '上周工作小结'
        : '工作小结'
  const displayEnd = addDays(options.weekEnd, -1)
  const rangeLabel = `${format(options.weekStart, 'yyyy.MM.dd')} - ${format(displayEnd, 'MM.dd')}`

  const completed = tasks
    .filter((task) => task.status === 'done' && Boolean(task.completedAt))
    .sort((a, b) => {
      const left = a.completedAt ? new Date(a.completedAt).getTime() : 0
      const right = b.completedAt ? new Date(b.completedAt).getTime() : 0
      return left - right
    })

  const projectById = new Map(projects.map((project) => [project.id, project]))
  const groupsByProject = new Map<string, WeeklyReportGroup>()
  const unassignedTasks: Task[] = []

  for (const task of completed) {
    const project = task.projectId ? projectById.get(task.projectId) : undefined
    if (!project) {
      unassignedTasks.push(task)
      continue
    }
    let group = groupsByProject.get(project.id)
    if (!group) {
      group = {
        key: project.id,
        projectId: project.id,
        name: project.name,
        color: project.color,
        isUnassigned: false,
        tasks: [],
        summary: ''
      }
      groupsByProject.set(project.id, group)
    }
    group.tasks.push(task)
  }

  const groups: WeeklyReportGroup[] = []
  for (const project of projects) {
    const group = groupsByProject.get(project.id)
    if (!group) continue
    group.summary = buildSummary(weekWord, group.name, false, group.tasks)
    groups.push(group)
  }
  if (unassignedTasks.length > 0) {
    groups.push({
      key: '__unassigned__',
      projectId: null,
      name: '未关联项目',
      color: '#94a3b8',
      isUnassigned: true,
      tasks: unassignedTasks,
      summary: buildSummary(weekWord, '未关联项目', true, unassignedTasks)
    })
  }

  const totalTasks = completed.length
  const projectCount = groups.filter((group) => !group.isUnassigned).length
  const unassignedCount = unassignedTasks.length

  const textLines: string[] = [title, `日期：${rangeLabel}`, '']
  const markdownLines: string[] = [`## ${title}`, `**日期：${rangeLabel}**`, '']
  if (totalTasks === 0) {
    textLines.push(`${weekWord}没有已完成的任务。`)
    markdownLines.push(`${weekWord}没有已完成的任务。`)
  } else {
    const overview = `${weekWord}完成 ${totalTasks} 项工作，涉及 ${projectCount} 个项目${
      unassignedCount > 0 ? `，另有 ${unassignedCount} 项未关联项目` : ''
    }。`
    textLines.push(overview, '')
    markdownLines.push(overview, '')

    for (const group of groups) {
      textLines.push(`【${group.name}】完成 ${group.tasks.length} 项`)
      markdownLines.push(`### ${group.name} · 完成 ${group.tasks.length} 项`, '')
      for (const task of group.tasks) {
        const line = taskLine(task)
        textLines.push(`- ${line}`)
        markdownLines.push(`- ${line}`)
      }
      textLines.push(`一句话：${group.summary}`, '')
      markdownLines.push(`> ${group.summary}`, '')
    }
  }

  return {
    title,
    weekWord,
    rangeLabel,
    groups,
    totalTasks,
    projectCount,
    unassignedCount,
    text: textLines.join('\n').trim(),
    markdown: markdownLines.join('\n').trim()
  }
}
