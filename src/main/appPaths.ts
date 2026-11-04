import { app } from 'electron'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export function configureUserDataPath(): string {
  const override = process.env.TASKMIND_DATA_DIR?.trim()
  const dir =
    override ||
    join(app.getPath('appData'), app.isPackaged ? 'TaskMind' : 'TaskMind-dev')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  app.setPath('userData', dir)
  return dir
}

export function getResourcePath(name: string): string {
  if (app.isPackaged) {
    const packagedPath = join(process.resourcesPath, 'resources', name)
    if (existsSync(packagedPath)) return packagedPath
  }
  return join(app.getAppPath(), 'resources', name)
}

export function getIconPath(): string {
  return getResourcePath('icon.png')
}

export function getTrayIconPath(): string {
  return getResourcePath('tray.png')
}

export function getPreloadPath(): string {
  return join(__dirname, '../preload/index.js')
}

export function getRendererIndexPath(): string {
  return join(__dirname, '../renderer/index.html')
}

export function getRendererUrl(hash?: string): string {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    return hash ? `${devUrl.replace(/#.*$/, '')}#${hash}` : devUrl
  }
  return ''
}
