import { Plus, Settings2, Sparkles } from 'lucide-react'
import { VIEW_LABELS, VIEW_SUBTITLES } from '@shared/constants'
import { useSettingsStore } from '../../stores/settingsStore'
import { useTaskStore } from '../../stores/taskStore'
import { Button } from '../ui/Button'

export function Header(): React.JSX.Element {
  const view = useTaskStore((state) => state.view)
  const counts = useTaskStore((state) => state.counts)
  const openAdd = useTaskStore((state) => state.openAdd)
  const openSettings = useTaskStore((state) => state.openSettings)
  const settings = useSettingsStore((state) => state.settings)

  return (
    <header className="shrink-0 border-b border-[var(--border)] bg-[var(--bg)] px-8 pb-5 pt-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-tight text-[var(--fg)]">
              {VIEW_LABELS[view]}
            </h1>
            <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)] ring-1 ring-[var(--border)]">
              {counts[view]}
            </span>
            {settings && !settings.hasApiKey ? (
              <button
                type="button"
                onClick={openSettings}
                className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:bg-amber-400/10 dark:text-amber-300 dark:hover:bg-amber-400/15"
              >
                <Sparkles className="h-3 w-3" />
                AI 未配置
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-[12px] text-[var(--muted)]">{VIEW_SUBTITLES[view]}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="primary"
            size="md"
            onClick={() => openAdd()}
            className="shadow-md shadow-teal-900/10"
          >
            <Plus className="h-4 w-4" />
            添加任务
          </Button>
          <Button variant="ghost" size="icon" onClick={openSettings} title="设置">
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
