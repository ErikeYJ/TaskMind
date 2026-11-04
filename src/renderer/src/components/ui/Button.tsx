import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'icon'

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] shadow-sm shadow-teal-900/10',
  secondary:
    'bg-[var(--surface)] text-[var(--fg)] border border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]',
  ghost:
    'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-hover)]',
  danger:
    'bg-[var(--danger)] text-white hover:opacity-90 shadow-sm shadow-red-900/10',
  soft:
    'bg-[var(--primary-soft)] text-[var(--primary)] hover:brightness-[0.98]'
}

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'h-7 rounded-lg px-2 text-[11px] gap-1',
  sm: 'h-8 rounded-lg px-2.5 text-xs gap-1.5',
  md: 'h-10 rounded-xl px-4 text-sm gap-2',
  icon: 'h-9 w-9 rounded-xl'
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'sm', loading = false, disabled, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      {children}
    </button>
  )
})
