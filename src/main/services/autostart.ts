import { app } from 'electron'

export function isStartHidden(): boolean {
  return process.argv.includes('--hidden')
}

export function applyAutostart(enabled: boolean): void {
  if (!app.isPackaged) return
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath,
      args: enabled ? ['--hidden'] : []
    })
  } catch {
    // 不让开机自启失败影响主流程
  }
}
