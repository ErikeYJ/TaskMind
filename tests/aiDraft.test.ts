import { describe, expect, it } from 'vitest'
import type { AiTaskExtraction } from '../src/shared/types'
import {
  applyAiOverride,
  mergeAiIntoForm,
  type AiDraftForm,
  type AiEditedFields
} from '../src/shared/aiDraft'

const current: AiDraftForm = {
  title: '原有标题',
  projectId: 'project-1',
  client: '',
  content: '',
  notes: '',
  dueDate: '',
  dueTime: ''
}

const extraction: AiTaskExtraction = {
  title: 'AI 标题',
  client: '李姐',
  content: 'AI 内容',
  notes: 'AI 备注',
  dueDate: '2026-11-05',
  dueTime: '15:00',
  confidence: 0.9
}

describe('mergeAiIntoForm', () => {
  it('fills empty fields and preserves other fields when no user edits exist', () => {
    const result = mergeAiIntoForm(current, extraction, {})
    expect(result.skipped).toEqual([])
    expect(result.next).toEqual({
      ...current,
      title: 'AI 标题',
      client: '李姐',
      content: 'AI 内容',
      notes: 'AI 备注',
      dueDate: '2026-11-05',
      dueTime: '15:00'
    })
  })

  it('keeps manually edited fields and reports them as skipped', () => {
    const edited: AiEditedFields = { title: true, notes: true }
    const result = mergeAiIntoForm(
      { ...current, title: '手改标题', notes: '手改备注' },
      extraction,
      edited
    )
    expect(result.skipped).toEqual(['title', 'notes'])
    expect(result.next.title).toBe('手改标题')
    expect(result.next.notes).toBe('手改备注')
    expect(result.next.client).toBe('李姐')
    expect(result.next.content).toBe('AI 内容')
    expect(result.next.dueDate).toBe('2026-11-05')
    expect(result.next.dueTime).toBe('15:00')
    expect(result.next.projectId).toBe('project-1')
  })

  it('does not clear existing values when the AI returns empty values', () => {
    const result = mergeAiIntoForm(
      { ...current, title: '标题', dueDate: '2026-11-06' },
      { ...extraction, title: '', client: null, content: '', notes: '', dueDate: null, dueTime: null },
      {}
    )
    expect(result.next.title).toBe('标题')
    expect(result.next.client).toBe('')
    expect(result.next.content).toBe('')
    expect(result.next.notes).toBe('')
    expect(result.next.dueDate).toBe('2026-11-06')
  })

  it('applies the full AI result only through the explicit override', () => {
    const overridden = applyAiOverride(
      { ...current, title: '手改标题', notes: '手改备注' },
      extraction
    )
    expect(overridden.title).toBe('AI 标题')
    expect(overridden.notes).toBe('AI 备注')
    expect(overridden.projectId).toBe('project-1')
  })
})
