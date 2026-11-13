import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Switch from '@radix-ui/react-switch'
import {
  Bell,
  Bot,
  Download,
  FolderOpen,
  HardDrive,
  Info,
  KeyRound,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Sun,
  Upload,
  X
} from 'lucide-react'
import { APP_VERSION } from '@shared/constants'
import {
  DEFAULT_AI_CONFIG,
  OPENCODE_GO_BASE_URL,
  OPENCODE_GO_MODEL,
  type AiProvider,
  type ThemeMode
} from '@shared/settings'
import type { AppInfo } from '@shared/types'
import { useSettingsStore } from '../../stores/settingsStore'
import { useTaskStore } from '../../stores/taskStore'
import { toastError, toastInfo, toastSuccess } from '../../stores/toastStore'
import { getErrorMessage } from '../../lib/utils'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'
import { inputClass } from '../tasks/TaskFields'

function Section({
  icon,
  title,
  description,
  children
}: {
  icon: React.JSX.Element
  title: string
  description?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex items-start gap-2.5">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--fg)]">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[11px] leading-5 text-[var(--muted)]">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Row({
  label,
  description,
  children
}: {
  label: string
  description?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-5 py-0.5">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-[var(--fg)]">{label}</div>
        {description ? (
          <div className="mt-0.5 text-[11px] leading-5 text-[var(--muted)]">{description}</div>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({
  checked,
  onCheckedChange,
  disabled
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}): React.JSX.Element {
  return (
    <Switch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className="relative h-6 w-11 rounded-full bg-slate-300 transition-colors data-[state=checked]:bg-[var(--primary)] disabled:opacity-50 dark:bg-slate-700"
    >
      <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[22px]" />
    </Switch.Root>
  )
}

export function SettingsDialog(): React.JSX.Element | null {
  const open = useTaskStore((state) => state.settingsOpen)
  const closeSettings = useTaskStore((state) => state.closeSettings)
  const settings = useSettingsStore((state) => state.settings)
  const updateSettings = useSettingsStore((state) => state.update)

  const [provider, setProvider] = useState<AiProvider>(DEFAULT_AI_CONFIG.provider)
  const [baseUrl, setBaseUrl] = useState(DEFAULT_AI_CONFIG.baseUrl)
  const [model, setModel] = useState(DEFAULT_AI_CONFIG.model)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [savingAi, setSavingAi] = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [busyData, setBusyData] = useState<'export' | 'import' | 'auto' | null>(null)
  const [resetPositionBusy, setResetPositionBusy] = useState(false)

  useEffect(() => {
    if (!open || !settings) return
    setProvider(settings.ai.provider)
    setBaseUrl(settings.ai.baseUrl)
    setModel(settings.ai.model)
    setApiKey('')
    setShowKey(false)
    setTestResult(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    void window.taskmind.app
      .getInfo()
      .then(setAppInfo)
      .catch(() => setAppInfo(null))
  }, [open])

  if (!open || !settings) return null

  const saveAiConfig = async (): Promise<void> => {
    try {
      new URL(baseUrl.trim())
    } catch {
      toastError('Base URL 格式不正确')
      return
    }
    if (!model.trim()) {
      toastError('模型名不能为空')
      return
    }
    setSavingAi(true)
    try {
      const updated = await window.taskmind.settings.update({
        ai: { provider, baseUrl: baseUrl.trim(), model: model.trim() }
      })
      useSettingsStore.getState().setSettings(updated)
      setTestResult(null)
      toastSuccess('AI 配置已保存')
    } catch (error) {
      toastError(getErrorMessage(error, '保存 AI 配置失败'))
    } finally {
      setSavingAi(false)
    }
  }

  const saveKey = async (): Promise<void> => {
    if (!apiKey.trim()) {
      toastError('请先输入 API Key')
      return
    }
    setSavingKey(true)
    try {
      const result = await window.taskmind.ai.setApiKey(apiKey.trim())
      if (result.ok) {
        toastSuccess(result.message)
        setApiKey('')
        await useSettingsStore.getState().load()
      } else {
        toastError(result.message)
      }
    } catch (error) {
      toastError(getErrorMessage(error, '保存 API Key 失败'))
    } finally {
      setSavingKey(false)
    }
  }

  const clearKey = async (): Promise<void> => {
    setSavingKey(true)
    try {
      const result = await window.taskmind.ai.setApiKey('')
      if (result.ok) {
        toastInfo(result.message)
        await useSettingsStore.getState().load()
      } else {
        toastError(result.message)
      }
    } catch (error) {
      toastError(getErrorMessage(error, '清除 API Key 失败'))
    } finally {
      setSavingKey(false)
    }
  }

  const testConnection = async (): Promise<void> => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await window.taskmind.ai.testConnection()
      setTestResult({ ok: result.ok, message: result.message })
    } catch (error) {
      setTestResult({ ok: false, message: getErrorMessage(error, '测试连接失败') })
    } finally {
      setTesting(false)
    }
  }

  const setTheme = (theme: ThemeMode): void => {
    void updateSettings({ theme })
  }

  const runAutoBackup = async (): Promise<void> => {
    setBusyData('auto')
    try {
      const result = await window.taskmind.backup.runAuto()
      if (result.ok) {
        toastSuccess(result.message)
      } else {
        toastError(result.message)
      }
      await useSettingsStore.getState().load()
    } catch (error) {
      toastError(getErrorMessage(error, '自动备份失败'))
    } finally {
      setBusyData(null)
    }
  }

  const openBackupDir = async (): Promise<void> => {
    try {
      const result = await window.taskmind.backup.openDir()
      if (!result.ok) toastError(result.message)
    } catch (error) {
      toastError(getErrorMessage(error, '打开备份目录失败'))
    }
  }

  const exportBackup = async (): Promise<void> => {
    setBusyData('export')
    try {
      const result = await window.taskmind.backup.export()
      if (result.ok) {
        toastSuccess(result.message)
      } else if (result.message !== '已取消导出') {
        toastError(result.message)
      }
    } catch (error) {
      toastError(getErrorMessage(error, '导出失败'))
    } finally {
      setBusyData(null)
    }
  }

  const importBackup = async (): Promise<void> => {
    setBusyData('import')
    try {
      const result = await window.taskmind.backup.import()
      if (result.ok) {
        toastInfo(result.message)
      } else if (result.message !== '已取消导入') {
        toastError(result.message)
      }
    } catch (error) {
      toastError(getErrorMessage(error, '导入失败'))
    } finally {
      setBusyData(null)
    }
  }

  const resetBall = async (): Promise<void> => {
    setResetPositionBusy(true)
    try {
      await window.taskmind.ball.resetPosition()
      toastSuccess('浮球位置已重置')
    } catch (error) {
      toastError(getErrorMessage(error, '重置浮球位置失败'))
    } finally {
      setResetPositionBusy(false)
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) closeSettings()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-[90] animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[100] flex max-h-[90vh] w-[880px] max-w-[calc(100vw-48px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)] animate-scale-in">
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-6 py-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-[var(--fg)]">设置</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-[var(--muted)]">
                AI、通知、外观和数据都在这里。
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" title="关闭">
                <X className="h-5 w-5" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-4">
              <Section
                icon={<Bot className="h-4 w-4" />}
                title="AI 识别"
                description="从微信截图里提取任务。截图只会发送给你配置的模型服务。"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] text-[var(--muted)]">服务预设</label>
                    <select
                      className={inputClass}
                      value={provider}
                      onChange={(event) => {
                        const next = event.target.value as AiProvider
                        setProvider(next)
                        if (next === 'opencode-go') {
                          setBaseUrl(OPENCODE_GO_BASE_URL)
                          setModel(OPENCODE_GO_MODEL)
                        }
                      }}
                    >
                      <option value="opencode-go">OpenCode Go</option>
                      <option value="custom">自定义 OpenAI 兼容接口</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-[var(--muted)]">模型</label>
                    <input
                      className={inputClass}
                      value={model}
                      onChange={(event) => setModel(event.target.value)}
                      placeholder="deepseek-v4.1-flash"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-[var(--muted)]">Base URL</label>
                  <input
                    className={inputClass}
                    value={baseUrl}
                    onChange={(event) => setBaseUrl(event.target.value)}
                    placeholder="https://opencode.ai/inference/go/openai/v1"
                  />
                  <p className="mt-1 text-[10px] leading-4 text-[var(--muted)]">
                    会自动在末尾拼接 /chat/completions。OpenCode Go 需要会话头，应用会自动处理。
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--fg)]">
                      <KeyRound className="h-3.5 w-3.5 text-[var(--muted)]" />
                      API Key
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        settings.hasApiKey
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300'
                      )}
                    >
                      {settings.hasApiKey ? '已配置' : '未配置'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      className={cn(inputClass, 'flex-1')}
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder={settings.hasApiKey ? '输入新 Key 可替换当前 Key' : '粘贴 API Key'}
                      autoComplete="off"
                    />
                    <Button
                      type="button"
                      size="md"
                      variant="secondary"
                      onClick={() => setShowKey((value) => !value)}
                    >
                      {showKey ? '隐藏' : '显示'}
                    </Button>
                    <Button
                      type="button"
                      size="md"
                      variant="primary"
                      loading={savingKey}
                      onClick={() => void saveKey()}
                    >
                      保存
                    </Button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] leading-4 text-[var(--muted)]">
                      Key 使用 Windows 安全存储加密保存在本机，不会写进安装包。
                    </p>
                    {settings.hasApiKey ? (
                      <button
                        type="button"
                        className="shrink-0 text-[10px] text-[var(--danger)] hover:underline"
                        onClick={() => void clearKey()}
                      >
                        清除 Key
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    loading={savingAi}
                    onClick={() => void saveAiConfig()}
                  >
                    保存 AI 配置
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    loading={testing}
                    onClick={() => void testConnection()}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    测试连接
                  </Button>
                  {testResult ? (
                    <span
                      className={cn(
                        'text-[11px]',
                        testResult.ok ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                      )}
                    >
                      {testResult.message}
                    </span>
                  ) : null}
                </div>
              </Section>

              <Section
                icon={<Bell className="h-4 w-4" />}
                title="提醒"
                description="挂起和已完成的任务不会触发提醒。"
              >
                <Row label="启用通知">
                  <Toggle
                    checked={settings.notifications.enabled}
                    onCheckedChange={(checked) =>
                      void updateSettings({ notifications: { enabled: checked } })
                    }
                  />
                </Row>
                <Row
                  label="每天早间汇总"
                  description="当天到期和逾期任务，默认 09:00 汇总一次。"
                >
                  <Toggle
                    checked={settings.notifications.dailySummary}
                    onCheckedChange={(checked) =>
                      void updateSettings({ notifications: { dailySummary: checked } })
                    }
                    disabled={!settings.notifications.enabled}
                  />
                </Row>
                <Row label="汇总时间">
                  <input
                    type="time"
                    className={cn(inputClass, 'w-[130px]')}
                    value={settings.notifications.morningTime}
                    onChange={(event) => {
                      if (!event.target.value) return
                      void updateSettings({
                        notifications: { morningTime: event.target.value }
                      })
                    }}
                    disabled={!settings.notifications.enabled || !settings.notifications.dailySummary}
                  />
                </Row>
                <Row
                  label="到点提醒"
                  description="设置了具体时间的任务，在截止时间再提醒一次。"
                >
                  <Toggle
                    checked={settings.notifications.dueTimeReminders}
                    onCheckedChange={(checked) =>
                      void updateSettings({ notifications: { dueTimeReminders: checked } })
                    }
                    disabled={!settings.notifications.enabled}
                  />
                </Row>
                <div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      void window.taskmind.notifications
                        .test()
                        .then((result) => {
                          if (result.ok) toastSuccess(result.message)
                          else toastError(result.message)
                        })
                        .catch((error) => toastError(getErrorMessage(error, '测试通知失败')))
                    }}
                  >
                    发送测试通知
                  </Button>
                </div>
              </Section>

              <Section icon={<Palette className="h-4 w-4" />} title="外观">
                <div className="flex gap-2">
                  {[
                    { value: 'system' as const, label: '跟随系统', icon: <Monitor className="h-3.5 w-3.5" /> },
                    { value: 'light' as const, label: '浅色', icon: <Sun className="h-3.5 w-3.5" /> },
                    { value: 'dark' as const, label: '深色', icon: <Moon className="h-3.5 w-3.5" /> }
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setTheme(item.value)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors',
                        settings.theme === item.value
                          ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                          : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]'
                      )}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  ))}
                </div>
              </Section>

              <Section icon={<Monitor className="h-4 w-4" />} title="浮球与启动">
                <Row
                  label="显示桌面浮球"
                  description="浮球显示最紧急的 3 个任务，点击可以直接打开任务。"
                >
                  <Toggle
                    checked={settings.ball.visible}
                    onCheckedChange={(checked) => void updateSettings({ ball: { visible: checked } })}
                  />
                </Row>
                <Row label="浮球位置" description="如果浮球跑到屏幕外，可以重置到默认位置。">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={resetPositionBusy}
                    onClick={() => void resetBall()}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    重置位置
                  </Button>
                </Row>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-[var(--fg)]">浮球大小</div>
                      <div className="mt-0.5 text-[11px] leading-5 text-[var(--muted)]">
                        当前 {settings.ball.size}px。拖到屏幕边缘会自动缩小贴边，拖离后恢复大小。
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center">
                        <span
                          className="rounded-full bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-600"
                          style={{
                            width: Math.round(16 + (settings.ball.size - 56) * 0.4),
                            height: Math.round(16 + (settings.ball.size - 56) * 0.4)
                          }}
                        />
                      </div>
                      <input
                        type="range"
                        min={56}
                        max={120}
                        step={8}
                        value={settings.ball.size}
                        onChange={(event) =>
                          void updateSettings({ ball: { size: Number(event.target.value) } })
                        }
                        className="w-32 accent-teal-600"
                        aria-label="浮球大小"
                      />
                    </div>
                  </div>
                </div>
                <Row
                  label="开机自启"
                  description={
                    appInfo?.packaged
                      ? '登录 Windows 后自动启动，只显示托盘和浮球。'
                      : '开发模式下不会写入启动项，打包安装后生效。'
                  }
                >
                  <Toggle
                    checked={settings.autostart}
                    onCheckedChange={(checked) => void updateSettings({ autostart: checked })}
                  />
                </Row>
              </Section>

              <Section
                icon={<HardDrive className="h-4 w-4" />}
                title="数据"
                description="任务、项目、截图和设置都保存在本机。备份不会包含 API Key。"
              >
                <Row
                  label="自动备份"
                  description="每天自动备份数据库和截图，自动保留最近若干份。"
                >
                  <Toggle
                    checked={settings.backup.autoEnabled}
                    onCheckedChange={(checked) =>
                      void updateSettings({ backup: { autoEnabled: checked } })
                    }
                    disabled={Boolean(busyData)}
                  />
                </Row>
                <Row label="保留份数" description="只清理自动备份，不影响手动导出的备份文件。">
                  <select
                    className="h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--fg)] outline-none focus:border-[var(--primary)] disabled:opacity-50"
                    value={settings.backup.keepCount}
                    onChange={(event) =>
                      void updateSettings({ backup: { keepCount: Number(event.target.value) } })
                    }
                    disabled={Boolean(busyData)}
                    aria-label="自动备份保留份数"
                  >
                    {Array.from(new Set([3, 7, 14, 30, settings.backup.keepCount]))
                      .sort((a, b) => a - b)
                      .map((count) => (
                        <option key={count} value={count}>
                          {count} 份
                        </option>
                      ))}
                  </select>
                </Row>
                <div className="rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-[11px] leading-5 text-[var(--muted)]">
                  <div>
                    最近自动备份：
                    {settings.backup.lastBackupAt
                      ? new Date(settings.backup.lastBackupAt).toLocaleString('zh-CN', {
                          hour12: false
                        })
                      : '尚未备份'}
                  </div>
                  {settings.backup.lastBackupPath ? (
                    <div className="mt-0.5 truncate font-mono text-[10px] text-[var(--muted)]">
                      {settings.backup.lastBackupPath}
                    </div>
                  ) : null}
                  {settings.backup.lastBackupError ? (
                    <div className="mt-1 text-[var(--danger)]">
                      上次失败：{settings.backup.lastBackupError}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busyData === 'auto'}
                    disabled={Boolean(busyData)}
                    onClick={() => void runAutoBackup()}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    立即备份
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void openBackupDir()}>
                    <FolderOpen className="h-3.5 w-3.5" />
                    打开备份目录
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busyData === 'export'}
                    disabled={Boolean(busyData)}
                    onClick={() => void exportBackup()}
                  >
                    <Download className="h-3.5 w-3.5" />
                    导出备份
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busyData === 'import'}
                    disabled={Boolean(busyData)}
                    onClick={() => void importBackup()}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    导入备份
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void window.taskmind.app.openDataDir()}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    打开数据目录
                  </Button>
                </div>
                <div className="rounded-lg bg-[var(--surface-soft)] px-3 py-2 font-mono text-[10px] leading-5 text-[var(--muted)]">
                  {settings ? appInfo?.dataDir ?? '' : ''}
                </div>
              </Section>

              <Section icon={<Info className="h-4 w-4" />} title="关于">
                <div className="space-y-1 text-xs text-[var(--muted)]">
                  <div>TaskMind {APP_VERSION}</div>
                  <div>Electron {appInfo?.electronVersion ?? '—'}</div>
                  <div>任务和截图默认保存在 %APPDATA%\TaskMind。</div>
                </div>
              </Section>
            </div>
          </div>

          <div className="flex shrink-0 justify-end border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4">
            <Dialog.Close asChild>
              <Button variant="primary" size="md">
                完成
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
