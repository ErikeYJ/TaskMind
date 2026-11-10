import type { AiTaskExtraction } from '@shared/types'

export interface AiDraftForm {
  title: string
  projectId: string
  client: string
  content: string
  notes: string
  dueDate: string
  dueTime: string
}

export const AI_FORM_FIELDS = [
  'title',
  'client',
  'content',
  'notes',
  'dueDate',
  'dueTime'
] as const

export type AiFormField = (typeof AI_FORM_FIELDS)[number]
export type AiEditedFields = Partial<Record<AiFormField, boolean>>

export const AI_FIELD_LABELS: Record<AiFormField, string> = {
  title: '任务名称',
  client: '客户 / 来源',
  content: '任务内容',
  notes: '备注',
  dueDate: '截止日期',
  dueTime: '截止时间'
}

export function isAiFormField(key: string): key is AiFormField {
  return (AI_FORM_FIELDS as readonly string[]).includes(key)
}

export function mergeAiIntoForm(
  current: AiDraftForm,
  data: AiTaskExtraction,
  edited: AiEditedFields
): { next: AiDraftForm; skipped: AiFormField[] } {
  const next = { ...current }
  const skipped: AiFormField[] = []

  for (const field of AI_FORM_FIELDS) {
    if (edited[field]) {
      skipped.push(field)
      continue
    }

    switch (field) {
      case 'title':
        next.title = data.title || current.title
        break
      case 'client':
        next.client = data.client ?? current.client
        break
      case 'content':
        next.content = data.content || current.content
        break
      case 'notes':
        next.notes = data.notes || current.notes
        break
      case 'dueDate':
        next.dueDate = data.dueDate ?? current.dueDate
        break
      case 'dueTime':
        next.dueTime = data.dueTime ?? current.dueTime
        break
    }
  }

  return { next, skipped }
}

export function applyAiOverride(
  current: AiDraftForm,
  data: AiTaskExtraction
): AiDraftForm {
  return {
    ...current,
    title: data.title || current.title,
    client: data.client ?? current.client,
    content: data.content || current.content,
    notes: data.notes || current.notes,
    dueDate: data.dueDate ?? current.dueDate,
    dueTime: data.dueTime ?? current.dueTime
  }
}
