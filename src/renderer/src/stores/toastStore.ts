import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void | Promise<void>
}

export interface ToastItem {
  id: string
  type: ToastType
  message: string
  action?: ToastAction
}

interface ToastOptions {
  action?: ToastAction
  durationMs?: number
}

interface ToastState {
  toasts: ToastItem[]
  push: (type: ToastType, message: string, options?: ToastOptions) => void
  dismiss: (id: string) => void
}

let sequence = 0

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (type, message, options = {}) => {
    sequence += 1
    const id = `toast-${sequence}`
    set((state) => ({
      toasts: [...state.toasts, { id, type, message, action: options.action }]
    }))
    window.setTimeout(() => {
      if (get().toasts.some((toast) => toast.id === id)) {
        set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
      }
    }, options.durationMs ?? 3600)
  },
  dismiss: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
  }
}))

export function toastSuccess(message: string): void {
  useToastStore.getState().push('success', message)
}

export function toastError(message: string): void {
  useToastStore.getState().push('error', message)
}

export function toastInfo(message: string): void {
  useToastStore.getState().push('info', message)
}

export function toastUndo(message: string, onUndo: () => void | Promise<void>): void {
  useToastStore.getState().push('info', message, {
    durationMs: 9000,
    action: { label: '撤销', onClick: onUndo }
  })
}
