import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  message: string
}

interface ToastState {
  toasts: ToastItem[]
  push: (type: ToastType, message: string) => void
  dismiss: (id: string) => void
}

let sequence = 0

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (type, message) => {
    sequence += 1
    const id = `toast-${sequence}`
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }))
    window.setTimeout(() => {
      if (get().toasts.some((toast) => toast.id === id)) {
        set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
      }
    }, 3600)
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
