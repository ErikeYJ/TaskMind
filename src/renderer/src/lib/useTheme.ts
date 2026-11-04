import { useEffect } from 'react'
import type { ThemeMode } from '@shared/settings'

export function useApplyTheme(theme: ThemeMode): void {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const apply = (): void => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      document.documentElement.classList.toggle('dark', dark)
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    }

    apply()
    if (theme === 'system') {
      media.addEventListener('change', apply)
      return () => media.removeEventListener('change', apply)
    }
    return undefined
  }, [theme])
}
