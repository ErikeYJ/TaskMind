import { safeStorage } from 'electron'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  DEFAULT_AI_CONFIG,
  DEFAULT_SETTINGS,
  type AiProvider,
  type AppSettings,
  type BallDockEdge,
  type SettingsPatch,
  type ThemeMode
} from '../../shared/settings'

interface StoredAiConfig {
  provider: AiProvider
  baseUrl: string
  model: string
  sessionId: string
}

interface StoredSettings {
  theme: ThemeMode
  autostart: boolean
  notifications: {
    enabled: boolean
    morningTime: string
    dailySummary: boolean
    dueTimeReminders: boolean
  }
  ball: {
    visible: boolean
    x: number | null
    y: number | null
    size: number
    dock: BallDockEdge
  }
  window: {
    width: number
    height: number
    x: number | null
    y: number | null
  }
  backup: {
    autoEnabled: boolean
    keepCount: number
    lastBackupAt: string | null
    lastBackupPath: string | null
    lastBackupError: string | null
  }
  ai: StoredAiConfig
  onboardingCompleted: boolean
  encryptedApiKey: string | null
}

function createDefaults(): StoredSettings {
  return {
    theme: DEFAULT_SETTINGS.theme,
    autostart: DEFAULT_SETTINGS.autostart,
    notifications: { ...DEFAULT_SETTINGS.notifications },
    ball: { ...DEFAULT_SETTINGS.ball },
    window: { ...DEFAULT_SETTINGS.window },
    backup: { ...DEFAULT_SETTINGS.backup },
    ai: {
      ...DEFAULT_AI_CONFIG,
      sessionId: randomUUID()
    },
    onboardingCompleted: DEFAULT_SETTINGS.onboardingCompleted,
    encryptedApiKey: null
  }
}

function isTheme(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark'
}

function isProvider(value: unknown): value is AiProvider {
  return value === 'opencode-go' || value === 'custom'
}

function mergeSettings(base: StoredSettings, raw: unknown): StoredSettings {
  if (!raw || typeof raw !== 'object') return base
  const data = raw as Record<string, unknown>
  const notifications =
    data.notifications && typeof data.notifications === 'object'
      ? (data.notifications as Record<string, unknown>)
      : {}
  const ball =
    data.ball && typeof data.ball === 'object' ? (data.ball as Record<string, unknown>) : {}
  const windowData =
    data.window && typeof data.window === 'object'
      ? (data.window as Record<string, unknown>)
      : {}
  const ai =
    data.ai && typeof data.ai === 'object' ? (data.ai as Record<string, unknown>) : {}
  const backup =
    data.backup && typeof data.backup === 'object'
      ? (data.backup as Record<string, unknown>)
      : {}

  return {
    theme: isTheme(data.theme) ? data.theme : base.theme,
    autostart: typeof data.autostart === 'boolean' ? data.autostart : base.autostart,
    notifications: {
      enabled:
        typeof notifications.enabled === 'boolean' ? notifications.enabled : base.notifications.enabled,
      morningTime:
        typeof notifications.morningTime === 'string' &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(notifications.morningTime)
          ? notifications.morningTime
          : base.notifications.morningTime,
      dailySummary:
        typeof notifications.dailySummary === 'boolean'
          ? notifications.dailySummary
          : base.notifications.dailySummary,
      dueTimeReminders:
        typeof notifications.dueTimeReminders === 'boolean'
          ? notifications.dueTimeReminders
          : base.notifications.dueTimeReminders
    },
    ball: {
      visible: typeof ball.visible === 'boolean' ? ball.visible : base.ball.visible,
      x: typeof ball.x === 'number' && Number.isFinite(ball.x) ? Math.round(ball.x) : base.ball.x,
      y: typeof ball.y === 'number' && Number.isFinite(ball.y) ? Math.round(ball.y) : base.ball.y,
      size:
        typeof ball.size === 'number' && Number.isFinite(ball.size)
          ? Math.min(120, Math.max(56, Math.round(ball.size)))
          : base.ball.size,
      dock:
        ball.dock === 'left' ||
        ball.dock === 'right' ||
        ball.dock === 'top' ||
        ball.dock === 'bottom' ||
        ball.dock === 'none'
          ? ball.dock
          : base.ball.dock
    },
    window: {
      width:
        typeof windowData.width === 'number' && windowData.width >= 800
          ? Math.round(windowData.width)
          : base.window.width,
      height:
        typeof windowData.height === 'number' && windowData.height >= 600
          ? Math.round(windowData.height)
          : base.window.height,
      x:
        typeof windowData.x === 'number' && Number.isFinite(windowData.x)
          ? Math.round(windowData.x)
          : base.window.x,
      y:
        typeof windowData.y === 'number' && Number.isFinite(windowData.y)
          ? Math.round(windowData.y)
          : base.window.y
    },
    backup: {
      autoEnabled:
        typeof backup.autoEnabled === 'boolean'
          ? backup.autoEnabled
          : base.backup.autoEnabled,
      keepCount:
        typeof backup.keepCount === 'number' && Number.isFinite(backup.keepCount)
          ? Math.min(30, Math.max(1, Math.round(backup.keepCount)))
          : base.backup.keepCount,
      lastBackupAt:
        typeof backup.lastBackupAt === 'string' ? backup.lastBackupAt : null,
      lastBackupPath:
        typeof backup.lastBackupPath === 'string' ? backup.lastBackupPath : null,
      lastBackupError:
        typeof backup.lastBackupError === 'string' ? backup.lastBackupError : null
    },
    ai: {
      provider: isProvider(ai.provider) ? ai.provider : base.ai.provider,
      baseUrl:
        typeof ai.baseUrl === 'string' && ai.baseUrl.length > 0 ? ai.baseUrl : base.ai.baseUrl,
      model: typeof ai.model === 'string' && ai.model.length > 0 ? ai.model : base.ai.model,
      sessionId:
        typeof ai.sessionId === 'string' && ai.sessionId.length > 0
          ? ai.sessionId
          : randomUUID()
    },
    onboardingCompleted:
      typeof data.onboardingCompleted === 'boolean'
        ? data.onboardingCompleted
        : base.onboardingCompleted,
    encryptedApiKey:
      typeof data.encryptedApiKey === 'string' && data.encryptedApiKey.length > 0
        ? data.encryptedApiKey
        : null
  }
}

export class SettingsService {
  private readonly filePath: string
  private data: StoredSettings
  private readonly listeners = new Set<(settings: AppSettings) => void>()

  constructor(private readonly userDataDir: string) {
    this.filePath = join(userDataDir, 'settings.json')
    this.data = this.load()
  }

  onChanged(listener: (settings: AppSettings) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emitChanged(): void {
    const current = this.getPublic()
    for (const listener of this.listeners) {
      try {
        listener(current)
      } catch {
        // ignore listener errors
      }
    }
  }

  private load(): StoredSettings {
    const defaults = createDefaults()
    if (!existsSync(this.filePath)) {
      this.data = defaults
      this.save()
      return defaults
    }

    try {
      const raw = JSON.parse(readFileSync(this.filePath, 'utf8'))
      const merged = mergeSettings(defaults, raw)
      const serialized = JSON.stringify(merged)
      const current = readFileSync(this.filePath, 'utf8')
      if (serialized !== current) {
        this.data = merged
        this.save()
      }
      return merged
    } catch {
      try {
        renameSync(this.filePath, `${this.filePath}.corrupt-${Date.now()}.json`)
      } catch {
        // ignore
      }
      this.data = defaults
      this.save()
      return defaults
    }
  }

  private save(): void {
    const tempPath = `${this.filePath}.tmp`
    writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf8')
    renameSync(tempPath, this.filePath)
  }

  getPublic(): AppSettings {
    return {
      theme: this.data.theme,
      autostart: this.data.autostart,
      notifications: { ...this.data.notifications },
      ball: { ...this.data.ball },
      window: { ...this.data.window },
      backup: { ...this.data.backup },
      ai: {
        provider: this.data.ai.provider,
        baseUrl: this.data.ai.baseUrl,
        model: this.data.ai.model
      },
      onboardingCompleted: this.data.onboardingCompleted,
      hasApiKey: this.hasApiKey()
    }
  }

  getApiKey(): string | null {
    if (this.data.encryptedApiKey) {
      try {
        const decrypted = safeStorage.decryptString(
          Buffer.from(this.data.encryptedApiKey, 'base64')
        )
        if (decrypted.trim()) return decrypted.trim()
      } catch {
        // 加密数据可能来自其他 Windows 用户；继续尝试开发环境变量
      }
    }

    const devKey = process.env.TASKMIND_AI_KEY?.trim()
    return devKey || null
  }

  hasApiKey(): boolean {
    return Boolean(this.getApiKey())
  }

  setApiKey(key: string): { ok: boolean; message: string } {
    const trimmed = key.trim()
    if (!trimmed) {
      this.data.encryptedApiKey = null
      this.save()
      this.emitChanged()
      return { ok: true, message: 'API Key 已清除' }
    }

    if (!safeStorage.isEncryptionAvailable()) {
      return { ok: false, message: '当前系统安全存储不可用，无法保存 API Key' }
    }

    try {
      this.data.encryptedApiKey = safeStorage.encryptString(trimmed).toString('base64')
      this.save()
      this.emitChanged()
      return { ok: true, message: 'API Key 已加密保存' }
    } catch {
      return { ok: false, message: '保存 API Key 失败' }
    }
  }

  update(patch: SettingsPatch): AppSettings {
    if (patch.theme) this.data.theme = patch.theme
    if (typeof patch.autostart === 'boolean') this.data.autostart = patch.autostart
    if (patch.notifications) {
      this.data.notifications = {
        ...this.data.notifications,
        ...patch.notifications
      }
    }
    if (patch.ball) {
      this.data.ball = {
        ...this.data.ball,
        ...patch.ball
      }
    }
    if (patch.window) {
      this.data.window = {
        ...this.data.window,
        ...patch.window
      }
    }
    if (patch.backup) {
      if (typeof patch.backup.autoEnabled === 'boolean') {
        this.data.backup.autoEnabled = patch.backup.autoEnabled
      }
      if (typeof patch.backup.keepCount === 'number') {
        this.data.backup.keepCount = Math.min(30, Math.max(1, Math.round(patch.backup.keepCount)))
      }
    }
    if (patch.ai) {
      this.data.ai = {
        ...this.data.ai,
        ...patch.ai
      }
    }
    if (typeof patch.onboardingCompleted === 'boolean') {
      this.data.onboardingCompleted = patch.onboardingCompleted
    }
    this.save()
    const current = this.getPublic()
    this.emitChanged()
    return current
  }

  updateWindowState(bounds: { width: number; height: number; x: number; y: number }): void {
    this.data.window = {
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
      x: Math.round(bounds.x),
      y: Math.round(bounds.y)
    }
    this.save()
  }

  updateBallState(x: number, y: number, dock: BallDockEdge): void {
    this.data.ball.x = Math.round(x)
    this.data.ball.y = Math.round(y)
    this.data.ball.dock = dock
    this.save()
  }

  setBallVisible(visible: boolean): AppSettings {
    this.data.ball.visible = visible
    this.save()
    const current = this.getPublic()
    this.emitChanged()
    return current
  }

  getSessionId(): string {
    return this.data.ai.sessionId
  }

  getImagesDir(): string {
    return join(this.userDataDir, 'images')
  }

  getDataDir(): string {
    return this.userDataDir
  }

  updateBackupStatus(status: {
    lastBackupAt?: string | null
    lastBackupPath?: string | null
    lastBackupError?: string | null
  }): void {
    if (status.lastBackupAt !== undefined) {
      this.data.backup.lastBackupAt = status.lastBackupAt
    }
    if (status.lastBackupPath !== undefined) {
      this.data.backup.lastBackupPath = status.lastBackupPath
    }
    if (status.lastBackupError !== undefined) {
      this.data.backup.lastBackupError = status.lastBackupError
    }
    this.save()
    this.emitChanged()
  }

  getStoredForBackup(): Record<string, unknown> {
    return {
      theme: this.data.theme,
      autostart: false,
      notifications: this.data.notifications,
      ball: { visible: this.data.ball.visible, size: this.data.ball.size },
      window: {
        width: this.data.window.width,
        height: this.data.window.height
      },
      backup: {
        autoEnabled: this.data.backup.autoEnabled,
        keepCount: this.data.backup.keepCount
      },
      ai: {
        provider: this.data.ai.provider,
        baseUrl: this.data.ai.baseUrl,
        model: this.data.ai.model
      },
      onboardingCompleted: this.data.onboardingCompleted
    }
  }

  applyBackupSettings(raw: unknown): void {
    const merged = mergeSettings(createDefaults(), raw)
    this.data = {
      ...merged,
      // 恢复备份时保留当前机器的 Key 和新的会话 ID
      encryptedApiKey: this.data.encryptedApiKey,
      ai: {
        ...merged.ai,
        sessionId: randomUUID()
      }
    }
    this.save()
    this.emitChanged()
  }
}
