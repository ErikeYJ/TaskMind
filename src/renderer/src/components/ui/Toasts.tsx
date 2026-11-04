import { AlertTriangle, Check, Info, X } from 'lucide-react'
import { useToastStore, type ToastType } from '../../stores/toastStore'
import { cn } from '../../lib/utils'

const icons: Record<ToastType, React.JSX.Element> = {
  success: <Check className="h-4 w-4" />,
  error: <AlertTriangle className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />
}

const classes: Record<ToastType, string> = {
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200',
  error:
    'border-red-200 bg-red-50 text-red-800 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-200',
  info: 'border-[var(--border)] bg-[var(--surface)] text-[var(--fg)]'
}

export function Toasts(): React.JSX.Element {
  const toasts = useToastStore((state) => state.toasts)
  const dismiss = useToastStore((state) => state.dismiss)

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[200] flex w-[340px] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'animate-toast-in pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm shadow-[var(--shadow-soft)]',
            classes[toast.type]
          )}
          role="status"
        >
          <span className="mt-0.5 shrink-0">{icons[toast.type]}</span>
          <span className="min-w-0 flex-1 leading-5">{toast.message}</span>
          <button
            type="button"
            className="mt-0.5 shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
            onClick={() => dismiss(toast.id)}
            aria-label="关闭提示"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
