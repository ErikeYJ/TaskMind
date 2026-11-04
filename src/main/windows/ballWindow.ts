import { BrowserWindow, Menu, screen } from 'electron'
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import {
  BALL_PANEL_GAP,
  BALL_PANEL_WIDTH,
  BALL_SNAP_DISTANCE,
  DEFAULT_BALL_SIZE,
  DOCKED_BALL_SCALE,
  EXPANDED_BALL_HEIGHT,
  EXPANDED_BALL_WIDTH,
  MAX_BALL_SIZE,
  MIN_BALL_SIZE
} from '../../shared/constants'
import type { BallDockEdge } from '../../shared/settings'
import type { BallLayout } from '../../shared/types'
import {
  getIconPath,
  getPreloadPath,
  getRendererIndexPath,
  getRendererUrl
} from '../appPaths'
import type { SettingsService } from '../services/settingsService'
import type { MainWindowManager } from './mainWindow'

interface Point {
  x: number
  y: number
}

interface BallDeps {
  isQuitting: () => boolean
  onQuit: () => void
}

function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export class BallWindowManager {
  private win: BrowserWindow | null = null
  private expanded = false
  private collapsedPosition: Point = { x: 0, y: 0 }
  private dragTimer: NodeJS.Timeout | null = null
  private dragOffset: Point | null = null
  private dragStartCursor: Point | null = null
  private dragLastPosition: Point | null = null
  private dragMoved = false

  constructor(
    private readonly settings: SettingsService,
    private readonly mainWindow: MainWindowManager,
    private readonly deps: BallDeps
  ) {}

  private normalSize(): number {
    return clampValue(
      this.settings.getPublic().ball.size || DEFAULT_BALL_SIZE,
      MIN_BALL_SIZE,
      MAX_BALL_SIZE
    )
  }

  private dockedSize(): number {
    return Math.max(44, Math.round(this.normalSize() * DOCKED_BALL_SCALE))
  }

  private currentSize(): number {
    return this.settings.getPublic().ball.dock === 'none'
      ? this.normalSize()
      : this.dockedSize()
  }

  private dockEdge(): BallDockEdge {
    return this.settings.getPublic().ball.dock
  }

  private expandedWidth(size: number): number {
    return Math.max(
      EXPANDED_BALL_WIDTH,
      BALL_PANEL_WIDTH + BALL_PANEL_GAP + size + 16
    )
  }

  private defaultPosition(size = this.normalSize()): Point {
    const area = screen.getPrimaryDisplay().workArea
    return {
      x: area.x + area.width - size - 28,
      y: area.y + Math.round(area.height * 0.45)
    }
  }

  private clampPosition(x: number, y: number, size = this.currentSize()): Point {
    const probe = {
      x: Math.round(x + size / 2),
      y: Math.round(y + size / 2)
    }
    const area = screen.getDisplayNearestPoint(probe).workArea
    return {
      x: Math.round(clampValue(x, area.x, area.x + Math.max(0, area.width - size))),
      y: Math.round(clampValue(y, area.y, area.y + Math.max(0, area.height - size)))
    }
  }

  private snapToDock(edge: BallDockEdge, x: number, y: number, size: number): Point {
    if (edge === 'none') return this.clampPosition(x, y, size)
    const area = screen.getDisplayNearestPoint({
      x: Math.round(x + size / 2),
      y: Math.round(y + size / 2)
    }).workArea
    let nextX = x
    let nextY = y
    if (edge === 'left') nextX = area.x
    if (edge === 'right') nextX = area.x + area.width - size
    if (edge === 'top') nextY = area.y
    if (edge === 'bottom') nextY = area.y + area.height - size
    return {
      x: Math.round(clampValue(nextX, area.x, area.x + Math.max(0, area.width - size))),
      y: Math.round(clampValue(nextY, area.y, area.y + Math.max(0, area.height - size)))
    }
  }

  private nearestEdge(
    area: { x: number; y: number; width: number; height: number },
    point: Point
  ): { edge: BallDockEdge; distance: number } {
    const candidates: Array<{ edge: BallDockEdge; distance: number }> = [
      { edge: 'left', distance: Math.abs(point.x - area.x) },
      { edge: 'right', distance: Math.abs(area.x + area.width - point.x) },
      { edge: 'top', distance: Math.abs(point.y - area.y) },
      { edge: 'bottom', distance: Math.abs(area.y + area.height - point.y) }
    ]
    candidates.sort((a, b) => a.distance - b.distance)
    return candidates[0]
  }

  private findDockEdge(x: number, y: number, size: number): BallDockEdge {
    // 优先看鼠标是否已经到屏幕边缘：即使窗口被拖出屏幕一部分，也能正常吸附。
    const cursor = screen.getCursorScreenPoint()
    const cursorArea = screen.getDisplayNearestPoint(cursor).workArea
    const cursorNearest = this.nearestEdge(cursorArea, cursor)
    if (cursorNearest.distance <= BALL_SNAP_DISTANCE) {
      return cursorNearest.edge
    }

    const center = { x: Math.round(x + size / 2), y: Math.round(y + size / 2) }
    const area = screen.getDisplayNearestPoint(center).workArea
    const windowCandidates: Array<{ edge: BallDockEdge; distance: number }> = [
      { edge: 'left', distance: Math.abs(x - area.x) },
      { edge: 'right', distance: Math.abs(area.x + area.width - (x + size)) },
      { edge: 'top', distance: Math.abs(y - area.y) },
      { edge: 'bottom', distance: Math.abs(area.y + area.height - (y + size)) }
    ]
    windowCandidates.sort((a, b) => a.distance - b.distance)
    const windowNearest = windowCandidates[0]
    return windowNearest.distance <= BALL_SNAP_DISTANCE ? windowNearest.edge : 'none'
  }

  private applyBounds(position: Point, size: number, dock: BallDockEdge): void {
    this.collapsedPosition = position
    if (this.win && !this.win.isDestroyed()) {
      this.win.setBounds({
        x: position.x,
        y: position.y,
        width: size,
        height: size
      })
    }
    this.settings.updateBallState(position.x, position.y, dock)
  }

  create(): BrowserWindow {
    if (this.win && !this.win.isDestroyed()) return this.win

    const saved = this.settings.getPublic().ball
    const size = this.currentSize()
    const fallback = this.defaultPosition(size)
    const initial =
      saved.dock === 'none'
        ? this.clampPosition(saved.x ?? fallback.x, saved.y ?? fallback.y, size)
        : this.snapToDock(saved.dock, saved.x ?? fallback.x, saved.y ?? fallback.y, size)

    this.collapsedPosition = initial
    this.settings.updateBallState(initial.x, initial.y, saved.dock)

    const win = new BrowserWindow({
      width: size,
      height: size,
      x: initial.x,
      y: initial.y,
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      movable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      backgroundColor: '#00000000',
      title: 'TaskMind',
      icon: existsSync(getIconPath()) ? getIconPath() : undefined,
      webPreferences: {
        preload: getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: false
      }
    })

    this.win = win
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setSkipTaskbar(true)

    win.once('ready-to-show', () => {
      if (this.settings.getPublic().ball.visible) {
        win.setAlwaysOnTop(true, 'screen-saver')
        win.showInactive()
        win.moveTop()
      }
    })

    win.on('close', (event) => {
      if (this.deps.isQuitting()) return
      event.preventDefault()
      this.setVisible(false)
    })

    win.on('closed', () => {
      this.win = null
    })

    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    win.webContents.on('will-navigate', (event) => event.preventDefault())
    win.webContents.on('will-attach-webview', (event) => event.preventDefault())

    const devUrl = getRendererUrl('/ball')
    if (devUrl) {
      void win.loadURL(devUrl)
    } else {
      const fileUrl = pathToFileURL(getRendererIndexPath()).toString()
      void win.loadURL(`${fileUrl}#/ball`)
    }

    return win
  }

  getLayout(): BallLayout {
    const size = this.currentSize()
    const dockEdge = this.dockEdge()
    const docked = dockEdge !== 'none'

    if (!this.win || this.win.isDestroyed()) {
      return {
        expanded: false,
        windowWidth: size,
        windowHeight: size,
        ballX: 0,
        ballY: 0,
        ballSize: size,
        docked,
        dockEdge
      }
    }

    if (!this.expanded) {
      const bounds = this.win.getBounds()
      return {
        expanded: false,
        windowWidth: bounds.width,
        windowHeight: bounds.height,
        ballX: 0,
        ballY: 0,
        ballSize: size,
        docked,
        dockEdge
      }
    }

    const bounds = this.win.getBounds()
    return {
      expanded: true,
      windowWidth: bounds.width,
      windowHeight: bounds.height,
      ballX: this.collapsedPosition.x - bounds.x,
      ballY: this.collapsedPosition.y - bounds.y,
      ballSize: size,
      docked,
      dockEdge
    }
  }

  setExpanded(expanded: boolean): BallLayout {
    if (!this.win || this.win.isDestroyed()) {
      return this.getLayout()
    }
    if (this.expanded === expanded) {
      return this.getLayout()
    }

    const size = this.currentSize()
    if (expanded) {
      const [x, y] = this.win.getPosition()
      this.collapsedPosition = { x, y }
      const area = screen.getDisplayNearestPoint({
        x: Math.round(x + size / 2),
        y: Math.round(y + size / 2)
      }).workArea

      const expandedW = this.expandedWidth(size)
      const rightSpace = area.x + area.width - (x + size)
      const leftSpace = x - area.x
      const panelSpace = BALL_PANEL_WIDTH + BALL_PANEL_GAP
      let x2: number
      if (rightSpace >= panelSpace) {
        x2 = x
      } else if (leftSpace >= panelSpace) {
        x2 = x - (expandedW - size)
      } else {
        x2 = rightSpace >= leftSpace ? x : x - (expandedW - size)
      }
      const y2 = Math.min(
        Math.max(y, area.y),
        area.y + Math.max(0, area.height - EXPANDED_BALL_HEIGHT)
      )
      this.win.setBounds({
        x: Math.round(x2),
        y: Math.round(y2),
        width: expandedW,
        height: EXPANDED_BALL_HEIGHT
      })
      this.win.setAlwaysOnTop(true, 'screen-saver')
      this.win.moveTop()
      this.expanded = true
    } else {
      const dock = this.dockEdge()
      const position =
        dock === 'none'
          ? this.clampPosition(this.collapsedPosition.x, this.collapsedPosition.y, size)
          : this.snapToDock(dock, this.collapsedPosition.x, this.collapsedPosition.y, size)
      this.win.setBounds({
        x: position.x,
        y: position.y,
        width: size,
        height: size
      })
      this.collapsedPosition = position
      this.settings.updateBallState(position.x, position.y, dock)
      this.expanded = false
    }

    return this.getLayout()
  }

  updateSize(): void {
    if (!this.win || this.win.isDestroyed()) return
    if (this.expanded) this.setExpanded(false)

    const bounds = this.win.getBounds()
    const size = this.currentSize()
    const dock = this.dockEdge()
    let position: Point
    if (dock === 'none') {
      const centerX = bounds.x + bounds.width / 2
      const centerY = bounds.y + bounds.height / 2
      position = this.clampPosition(centerX - size / 2, centerY - size / 2, size)
    } else {
      position = this.snapToDock(dock, bounds.x, bounds.y, size)
    }
    this.applyBounds(position, size, dock)
  }

  setVisible(visible: boolean): void {
    if (!visible) {
      this.stopDrag()
      if (this.expanded) this.setExpanded(false)
      if (this.win && !this.win.isDestroyed()) this.win.hide()
      return
    }

    if (!this.win || this.win.isDestroyed()) {
      this.create()
    }
    if (this.win && !this.win.isDestroyed()) {
      this.win.setAlwaysOnTop(true, 'screen-saver')
      this.win.showInactive()
      this.win.moveTop()
    }
  }

  bringToFront(): void {
    if (!this.win || this.win.isDestroyed() || !this.win.isVisible()) return
    this.win.setAlwaysOnTop(true, 'screen-saver')
    this.win.moveTop()
  }

  dragStart(): void {
    if (!this.win || this.win.isDestroyed()) return
    // 弹窗展开时抓住球：先收起弹窗，球会停在原地，再进入拖动。
    if (this.expanded) this.setExpanded(false)
    this.stopDrag()
    const cursor = screen.getCursorScreenPoint()
    const [x, y] = this.win.getPosition()
    this.dragOffset = { x: cursor.x - x, y: cursor.y - y }
    this.dragStartCursor = cursor
    this.dragLastPosition = { x, y }
    this.dragMoved = false
    this.dragTimer = setInterval(() => this.tickDrag(), 8)
  }

  private tickDrag(): void {
    if (!this.win || this.win.isDestroyed() || !this.dragOffset || !this.dragStartCursor) {
      this.stopDrag()
      return
    }
    const cursor = screen.getCursorScreenPoint()
    if (!this.dragMoved) {
      const distance = Math.hypot(
        cursor.x - this.dragStartCursor.x,
        cursor.y - this.dragStartCursor.y
      )
      if (distance < 4) return
      this.dragMoved = true
    }
    const nextX = Math.round(cursor.x - this.dragOffset.x)
    const nextY = Math.round(cursor.y - this.dragOffset.y)
    if (this.dragLastPosition?.x === nextX && this.dragLastPosition?.y === nextY) {
      return
    }
    this.dragLastPosition = { x: nextX, y: nextY }
    this.win.setPosition(nextX, nextY, false)
  }

  dragEnd(): { moved: boolean } {
    const moved = this.dragMoved
    this.stopDrag()
    if (!this.win || this.win.isDestroyed() || !moved) {
      return { moved: false }
    }

    const [x, y] = this.win.getPosition()
    const previousSize = this.currentSize()
    const previousDock = this.dockEdge()
    const edge = this.findDockEdge(x, y, previousSize)

    if (edge !== 'none') {
      const size = this.dockedSize()
      const position = this.snapToDock(edge, x, y, size)
      this.applyBounds(position, size, edge)
    } else {
      const size = this.normalSize()
      const position =
        previousDock === 'none'
          ? this.clampPosition(x, y, size)
          : this.clampPosition(
              x + previousSize / 2 - size / 2,
              y + previousSize / 2 - size / 2,
              size
            )
      this.applyBounds(position, size, 'none')
    }

    return { moved: true }
  }

  private stopDrag(): void {
    if (this.dragTimer) {
      clearInterval(this.dragTimer)
      this.dragTimer = null
    }
    this.dragOffset = null
    this.dragStartCursor = null
    this.dragLastPosition = null
    this.dragMoved = false
  }

  send(channel: string, ...args: unknown[]): void {
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send(channel, ...args)
    }
  }

  openMain(): void {
    this.mainWindow.show()
    this.bringToFront()
  }

  resetPosition(): void {
    if (!this.win || this.win.isDestroyed()) return
    if (this.expanded) this.setExpanded(false)
    this.stopDrag()
    const size = this.normalSize()
    const position = this.clampPosition(this.defaultPosition(size).x, this.defaultPosition(size).y, size)
    this.applyBounds(position, size, 'none')
    if (this.settings.getPublic().ball.visible) {
      this.win.showInactive()
    }
  }

  contextMenu(): void {
    if (!this.win || this.win.isDestroyed()) return
    const menu = Menu.buildFromTemplate([
      {
        label: '打开主界面',
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
        label: '隐藏浮球',
        click: () => {
          this.settings.setBallVisible(false)
          this.setVisible(false)
        }
      },
      { type: 'separator' },
      {
        label: '退出 TaskMind',
        click: () => this.deps.onQuit()
      }
    ])
    menu.popup({ window: this.win })
  }

  ensureVisible(): void {
    if (!this.win || this.win.isDestroyed()) return
    const [x, y] = this.win.getPosition()
    const size = this.currentSize()
    const dock = this.dockEdge()
    const position =
      dock === 'none'
        ? this.clampPosition(x, y, size)
        : this.snapToDock(dock, x, y, size)
    this.win.setPosition(position.x, position.y, false)
    this.collapsedPosition = position
    this.settings.updateBallState(position.x, position.y, dock)
  }

  destroy(): void {
    this.stopDrag()
    if (this.win && !this.win.isDestroyed()) {
      this.win.destroy()
    }
    this.win = null
  }
}
