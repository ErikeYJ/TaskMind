import { create } from 'zustand'
import type { AppSettings, SettingsPatch } from '@shared/settings'

interface SettingsState {
  settings: AppSettings | null
  loading: boolean
  error: string | null
  load: () => Promise<void>
  update: (patch: SettingsPatch) => Promise<AppSettings | null>
  setSettings: (settings: AppSettings) => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  loading: false,
  error: null,
  load: async () => {
    set({ loading: true, error: null })
    try {
      const settings = await window.taskmind.settings.get()
      set({ settings, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : '读取设置失败'
      })
    }
  },
  update: async (patch) => {
    try {
      const settings = await window.taskmind.settings.update(patch)
      set({ settings })
      return settings
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '保存设置失败' })
      return get().settings
    }
  },
  setSettings: (settings) => set({ settings })
}))
