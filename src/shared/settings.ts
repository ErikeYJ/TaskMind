export type ThemeMode = 'system' | 'light' | 'dark'

export type AiProvider = 'opencode-go' | 'custom'

export type BallDockEdge = 'none' | 'left' | 'right' | 'top' | 'bottom'

export interface AiPublicConfig {
  provider: AiProvider
  baseUrl: string
  model: string
}

export interface NotificationSettings {
  enabled: boolean
  morningTime: string
  dailySummary: boolean
  dueTimeReminders: boolean
}

export interface BallSettings {
  visible: boolean
  x: number | null
  y: number | null
  size: number
  dock: BallDockEdge
}

export interface WindowSettings {
  width: number
  height: number
  x: number | null
  y: number | null
}

export interface AppSettings {
  theme: ThemeMode
  autostart: boolean
  notifications: NotificationSettings
  ball: BallSettings
  window: WindowSettings
  ai: AiPublicConfig
  onboardingCompleted: boolean
  hasApiKey: boolean
}

export interface SettingsPatch {
  theme?: ThemeMode
  autostart?: boolean
  notifications?: Partial<NotificationSettings>
  ball?: Partial<BallSettings>
  window?: Partial<WindowSettings>
  ai?: Partial<AiPublicConfig>
  onboardingCompleted?: boolean
}

export const OPENCODE_GO_BASE_URL = 'https://opencode.ai/inference/go/openai/v1'
export const OPENCODE_GO_MODEL = 'deepseek-v4.1-flash'

export const DEFAULT_AI_CONFIG: AiPublicConfig = {
  provider: 'opencode-go',
  baseUrl: OPENCODE_GO_BASE_URL,
  model: OPENCODE_GO_MODEL
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  autostart: false,
  notifications: {
    enabled: true,
    morningTime: '09:00',
    dailySummary: true,
    dueTimeReminders: true
  },
  ball: {
    visible: true,
    x: null,
    y: null,
    size: 88,
    dock: 'none'
  },
  window: {
    width: 1200,
    height: 800,
    x: null,
    y: null
  },
  ai: DEFAULT_AI_CONFIG,
  onboardingCompleted: false,
  hasApiKey: false
}
