import { ACTION_LABELS } from '@shared/constants'
import type { Task, TaskAction, UpdateTaskInput } from '@shared/types'
import { toastError, toastSuccess, toastUndo } from '../stores/toastStore'
import { useTaskStore } from '../stores/taskStore'
import { getErrorMessage } from './utils'

export async function runTaskAction(id: string, action: TaskAction): Promise<boolean> {
  try {
    await window.taskmind.tasks.transition(id, action)
    await useTaskStore.getState().refreshAfterChange()
    toastSuccess(`${ACTION_LABELS[action]}成功`)
    return true
  } catch (error) {
    toastError(getErrorMessage(error, '操作失败'))
    return false
  }
}

export async function deleteTask(id: string): Promise<boolean> {
  try {
    const result = await window.taskmind.tasks.delete(id)
    if (!result.ok) {
      toastError(result.message || '删除任务失败')
      return false
    }
    useTaskStore.getState().closeDetail()
    await useTaskStore.getState().refreshAfterChange()
    if (!result.undoToken) {
      toastSuccess('任务已删除')
      return true
    }
    const token = result.undoToken
    toastUndo('任务已删除', async () => {
      try {
        const undo = await window.taskmind.undo.restore(token)
        if (!undo.ok) {
          toastError(undo.message)
          return
        }
        await useTaskStore.getState().refreshAfterChange()
        toastSuccess(undo.message)
      } catch (error) {
        toastError(getErrorMessage(error, '撤销删除任务失败'))
      }
    })
    return true
  } catch (error) {
    toastError(getErrorMessage(error, '删除任务失败'))
    return false
  }
}

export async function updateTask(
  id: string,
  patch: UpdateTaskInput
): Promise<Task | null> {
  try {
    const task = await window.taskmind.tasks.update(id, patch)
    useTaskStore.getState().setDetailTask(task)
    await useTaskStore.getState().refreshAfterChange()
    toastSuccess('任务已更新')
    return task
  } catch (error) {
    toastError(getErrorMessage(error, '保存任务失败'))
    return null
  }
}

export async function addScreenshot(taskId: string, dataUrl: string): Promise<boolean> {
  try {
    await window.taskmind.tasks.addScreenshot(taskId, { dataUrl })
    await useTaskStore.getState().refreshAfterChange()
    toastSuccess('截图已添加')
    return true
  } catch (error) {
    toastError(getErrorMessage(error, '添加截图失败'))
    return false
  }
}

export async function deleteScreenshot(id: string): Promise<boolean> {
  try {
    await window.taskmind.tasks.deleteScreenshot(id)
    await useTaskStore.getState().refreshAfterChange()
    toastSuccess('截图已删除')
    return true
  } catch (error) {
    toastError(getErrorMessage(error, '删除截图失败'))
    return false
  }
}
