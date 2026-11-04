import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle } from 'lucide-react'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '确定',
  cancelLabel = '取消',
  danger = false,
  loading = false,
  onConfirm,
  onOpenChange
}: ConfirmDialogProps): React.JSX.Element {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-[140] animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[150] w-[420px] max-w-[calc(100vw-48px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] animate-scale-in">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--danger-soft)] text-[var(--danger)]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold text-[var(--fg)]">
                {title}
              </Dialog.Title>
              <Dialog.Description className="mt-1.5 text-sm leading-6 text-[var(--muted)]">
                {description}
              </Dialog.Description>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost" size="md" disabled={loading}>
                {cancelLabel}
              </Button>
            </Dialog.Close>
            <Button
              variant={danger ? 'danger' : 'primary'}
              size="md"
              loading={loading}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
