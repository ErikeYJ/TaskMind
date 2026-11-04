import { BrowserWindow, screen, shell } from 'electron'
import { existsSync } from 'node:fs'
import {
  getIconPath,
  getPreloadPath,
  getRendererIndexPath,
  getRendererUrl
} from '../appPaths'
import { IPC } from '../../shared/api'
import type { SettingsService } from '../services/settingsService'

interface WindowBounds {
  width: number
  height: number
  x: number
  y: number
}

export class MainWindowManager {
  private win: BrowserWindow | null = null
  private saveTimer: NodeJS.Timeout | null = null
  private quitting = false
  private readonly pendingMessages: Array<{ channel: string; args: unknown[] }> = []

  constructor(private readonly settings: SettingsService) {}

  setQuitting(quitting: boolean): void {
    this.quitting = quitting
  }

  private resolveBounds(): WindowBounds {
    const saved = this.settings.getPublic().window
    const primary = screen.getPrimaryDisplay().workArea
    const width = Math.min(Math.max(saved.width, 980), primary.width)
    const height = Math.min(Math.max(saved.height, 640), primary.height)

    let x =
      typeof saved.x === 'number'
        ? saved.x
        : Math.round(primary.x + (primary.width - width) / 2)
    let y =
      typeof saved.y === 'number'
        ? saved.y
        : Math.round(primary.y + (primary.height - height) / 2)

    if (!this.isVisibleOnAnyDisplay(x, y, width, height)) {
      x = Math.round(primary.x + (primary.width - width) / 2)
      y = Math.round(primary.y + (primary.height - height) / 2)
    }

    return { width, height, x, y }
  }

  private isVisibleOnAnyDisplay(x: number, y: number, width: number, height: number): boolean {
    return screen.getAllDisplays().some((display) => {
      const area = display.workArea
      return (
        x + width > area.x &&
        x < area.x + area.width &&
        y + height > area.y &&
        y < area.y + area.height
      )
    })
  }

  create(startHidden = false): BrowserWindow {
    if (this.win && !this.win.isDestroyed()) {
      if (!startHidden) this.show()
      return this.win
    }

    const bounds = this.resolveBounds()
    const win = new BrowserWindow({
      ...bounds,
      minWidth: 980,
      minHeight: 640,
      show: false,
      title: 'TaskMind',
      icon: existsSync(getIconPath()) ? getIconPath() : undefined,
      backgroundColor: '#f6f7f9',
      autoHideMenuBar: true,
      webPreferences: {
        preload: getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: false
      }
    })

    this.win = win
    win.setMenuBarVisibility(false)

    win.once('ready-to-show', () => {
      if (!startHidden) win.show()
    })

    win.on('close', (event) => {
      if (this.quitting) {
        this.saveStateNow()
        return
      }
      event.preventDefault()
      this.saveStateNow()
      win.hide()
    })

    win.on('resize', () => this.scheduleSaveState())
    win.on('move', () => this.scheduleSaveState())
    win.on('closed', () => {
      this.win = null
    })

    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) {
        void shell.openExternal(url)
      }
      return { action: 'deny' }
    })

    win.webContents.on('will-navigate', (event) => {
      event.preventDefault()
    })

    win.webContents.on('will-attach-webview', (event) => {
      event.preventDefault()
    })

    win.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(false)
    })

    win.webContents.on('did-finish-load', () => {
      while (this.pendingMessages.length > 0) {
        const message = this.pendingMessages.shift()
        if (message && this.win && !this.win.isDestroyed()) {
          this.win.webContents.send(message.channel, ...message.args)
        }
      }
    })

    const devUrl = getRendererUrl()
    if (devUrl) {
      void win.loadURL(devUrl)
    } else {
      void win.loadFile(getRendererIndexPath())
    }

    return win
  }

  show(): void {
    if (!this.win || this.win.isDestroyed()) {
      this.create(false)
      return
    }
    if (this.win.isMinimized()) this.win.restore()
    this.win.show()
    this.win.focus()
  }

  hide(): void {
    if (this.win && !this.win.isDestroyed()) this.win.hide()
  }

  toggle(): void {
    if (!this.win || this.win.isDestroyed()) {
      this.create(false)
      return
    }
    if (this.win.isVisible() && !this.win.isMinimized()) {
      this.win.hide()
    } else {
      this.show()
    }
  }

  send(channel: string, ...args: unknown[]): void {
    if (!this.win || this.win.isDestroyed()) {
      this.pendingMessages.push({ channel, args })
      return
    }
    if (this.win.webContents.isLoading()) {
      this.pendingMessages.push({ channel, args })
      return
    }
    this.win.webContents.send(channel, ...args)
  }

  getWindow(): BrowserWindow | null {
    return this.win && !this.win.isDestroyed() ? this.win : null
  }

  ensureVisible(): void {
    if (!this.win || this.win.isDestroyed()) return
    const bounds = this.win.getBounds()
    if (!this.isVisibleOnAnyDisplay(bounds.x, bounds.y, bounds.width, bounds.height)) {
      this.win.center()
    }
  }

  private scheduleSaveState(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.saveStateNow(), 400)
  }

  saveStateNow(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    if (!this.win || this.win.isDestroyed()) return
    if (this.win.isMinimized() || this.win.isFullScreen()) return
    this.settings.updateWindowState(this.win.getBounds())
  }

  sendOpenAddTask(): void {
    this.show()
    this.send(IPC.events.openAddTask, {})
  }

  sendOpenSettings(): void {
    this.show()
    this.send(IPC.events.openSettings)
  }
}
