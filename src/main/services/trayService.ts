import { Menu, Tray, nativeImage } from 'electron'
import { existsSync } from 'node:fs'
import { getIconPath, getTrayIconPath } from '../appPaths'
import type { BallWindowManager } from '../windows/ballWindow'
import type { MainWindowManager } from '../windows/mainWindow'
import type { SettingsService } from './settingsService'

export class TrayService {
  private tray: Tray | null = null

  constructor(
    private readonly settings: SettingsService,
    private readonly mainWindow: MainWindowManager,
    private readonly ballWindow: BallWindowManager,
    private readonly onQuit: () => void
  ) {}

  create(): void {
    if (this.tray) return

    let icon = nativeImage.createEmpty()
    const trayIconPath = getTrayIconPath()
    if (existsSync(trayIconPath)) {
      icon = nativeImage.createFromPath(trayIconPath)
    }
    if (icon.isEmpty() && existsSync(getIconPath())) {
      icon = nativeImage.createFromPath(getIconPath())
    }

    try {
      this.tray = new Tray(icon.resize({ width: 16, height: 16 }))
    } catch {
      return
    }

    this.tray.setToolTip('TaskMind')
    this.tray.on('double-click', () => this.mainWindow.show())
    this.refresh()
  }

  refresh(): void {
    if (!this.tray) return
    const current = this.settings.getPublic()
    const menu = Menu.buildFromTemplate([
      {
        label: '打开 TaskMind',
        click: () => this.mainWindow.show()
      },
      {
        label: '添加任务',
        click: () => this.mainWindow.sendOpenAddTask()
      },
      {
        label: '设置',
        click: () => this.mainWindow.sendOpenSettings()
      },
      { type: 'separator' },
      {
        label: '显示浮球',
        type: 'checkbox',
        checked: current.ball.visible,
        click: () => {
          const next = !this.settings.getPublic().ball.visible
          this.settings.setBallVisible(next)
          this.ballWindow.setVisible(next)
        }
      },
      {
        label: '开机自启',
        type: 'checkbox',
        checked: current.autostart,
        click: () => {
          const next = !this.settings.getPublic().autostart
          this.settings.update({ autostart: next })
        }
      },
      { type: 'separator' },
      {
        label: '退出 TaskMind',
        click: () => this.onQuit()
      }
    ])
    this.tray.setContextMenu(menu)
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }
}
