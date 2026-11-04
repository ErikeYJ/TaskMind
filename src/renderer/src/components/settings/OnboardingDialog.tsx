import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Switch from '@radix-ui/react-switch'
import { Check, Eye, EyeOff, KeyRound, Sparkles } from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { toastError } from '../../stores/toastStore'
import { getErrorMessage } from '../../lib/utils'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'
import { inputClass } from '../tasks/TaskFields'

export function OnboardingDialog(): React.JSX.Element | null {
  const settings = useSettingsStore((state) => state.settings)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [autostart, setAutostart] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = Boolean(settings && !settings.onboardingCompleted)
  if (!open || !settings) return null

  const complete = async (saveKey: boolean): Promise<void> => {
    setError(null)
    setSaving(true)
    try {
      if (saveKey && apiKey.trim()) {
        const result = await window.taskmind.ai.setApiKey(apiKey.trim())
        if (!result.ok) {
          setError(result.message)
          setSaving(false)
          return
        }
      }
      const updated = await window.taskmind.settings.update({
        onboardingCompleted: true,
        autostart
      })
      useSettingsStore.getState().setSettings(updated)
    } catch (err) {
      setError(getErrorMessage(err, '保存设置失败'))
      toastError(getErrorMessage(err, '保存设置失败'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-[110] animate-fade-in" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[120] w-[560px] max-w-[calc(100vw-48px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)] animate-scale-in"
          onPointerDownOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <div className="border-b border-[var(--border)] bg-gradient-to-br from-teal-50 via-[var(--surface)] to-[var(--surface)] px-7 pb-6 pt-7 dark:from-teal-500/10">
            <div className="flex items-center gap-3">
              <img src="./icon.png" alt="" className="h-12 w-12 rounded-2xl shadow-sm" />
              <div>
                <Dialog.Title className="text-xl font-semibold tracking-tight text-[var(--fg)]">
                  欢迎使用 TaskMind
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  把微信里的客户任务接住，按紧急程度排好，还能在桌面浮球上随手看。
                </Dialog.Description>
              </div>
            </div>
          </div>

          <div className="space-y-5 px-7 py-6">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ['Ctrl+V 识图', '粘贴微信截图，AI 自动提取'],
                ['桌面浮球', '最紧急的 3 件随时可见'],
                ['本地保存', '任务和截图存在本机']
              ].map(([title, description]) => (
                <div
                  key={title}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-3"
                >
                  <div className="text-[11px] font-semibold text-[var(--fg)]">{title}</div>
                  <div className="mt-1 text-[10px] leading-4 text-[var(--muted)]">{description}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-[var(--border)] p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--fg)]">
                  <KeyRound className="h-3.5 w-3.5 text-[var(--muted)]" />
                  AI Key
                </div>
                {settings.hasApiKey ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                    <Check className="h-3 w-3" />
                    已配置
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                    可稍后填写
                  </span>
                )}
              </div>
              {!settings.hasApiKey ? (
                <>
                  <div className="flex gap-2">
                    <input
                      className={cn(inputClass, 'flex-1')}
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          void complete(true)
                        }
                      }}
                      placeholder="粘贴 OpenCode Go 或兼容接口的 API Key"
                      autoComplete="off"
                      autoFocus
                    />
                    <Button
                      type="button"
                      size="md"
                      variant="secondary"
                      onClick={() => setShowKey((value) => !value)}
                      title={showKey ? '隐藏' : '显示'}
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="mt-2 text-[10px] leading-5 text-[var(--muted)]">
                    默认使用 OpenCode Go / deepseek-v4.1-flash。Key 会加密保存在本机，不会写进安装包；不填也能手动添加任务。
                  </p>
                </>
              ) : (
                <p className="text-[11px] leading-5 text-[var(--muted)]">
                  本机已经检测到 API Key，可以直接开始。之后可以在设置里更换模型或服务。
                </p>
              )}
            </div>

            <div className="flex items-center justify-between rounded-xl border border-[var(--border)] px-4 py-3">
              <div>
                <div className="text-xs font-medium text-[var(--fg)]">开机自动启动</div>
                <div className="mt-0.5 text-[10px] leading-4 text-[var(--muted)]">
                  登录 Windows 后只显示托盘和浮球，不弹主窗口。
                </div>
              </div>
              <Switch.Root
                checked={autostart}
                onCheckedChange={setAutostart}
                className="relative h-6 w-11 rounded-full bg-slate-300 transition-colors data-[state=checked]:bg-[var(--primary)] dark:bg-slate-700"
              >
                <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[22px]" />
              </Switch.Root>
            </div>

            {error ? (
              <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]">
                {error}
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="md"
                disabled={saving}
                onClick={() => void complete(false)}
              >
                稍后配置
              </Button>
              <Button
                variant="primary"
                size="md"
                loading={saving}
                onClick={() => void complete(true)}
              >
                <Sparkles className="h-4 w-4" />
                保存并开始
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
