import { app, net, shell } from 'electron'
import { APP_VERSION } from '../../shared/constants'
import { compareVersions, normalizeVersion } from '../../shared/version'
import type { UpdateCheckResult, UpdateOpenResult } from '../../shared/types'

const RELEASES_API = 'https://api.github.com/repos/ErikeYJ/TaskMind/releases/latest'
const RELEASES_PAGE = 'https://github.com/ErikeYJ/TaskMind/releases/latest'
const REQUEST_TIMEOUT_MS = 10_000

interface GitHubRelease {
  tag_name?: unknown
  name?: unknown
  html_url?: unknown
  body?: unknown
  published_at?: unknown
}

function validReleaseUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      url.hostname === 'github.com' &&
      url.pathname.startsWith('/ErikeYJ/TaskMind/releases/')
    )
  } catch {
    return false
  }
}

function releaseNotes(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  return trimmed.length > 1800 ? `${trimmed.slice(0, 1800)}…` : trimmed
}

export class UpdateService {
  private lastReleaseUrl = RELEASES_PAGE

  async check(): Promise<UpdateCheckResult> {
    const currentVersion = app.getVersion() || APP_VERSION
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const response = await net.fetch(RELEASES_API, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': `TaskMind/${currentVersion}`
        },
        signal: controller.signal
      })
      const text = await response.text()
      let data: GitHubRelease = {}
      try {
        data = text ? (JSON.parse(text) as GitHubRelease) : {}
      } catch {
        data = {}
      }

      if (!response.ok) {
        if (response.status === 404) {
          return {
            ok: false,
            currentVersion,
            message: '暂时没有可用的版本信息，请稍后再试'
          }
        }
        if (response.status === 403 || response.status === 429) {
          return {
            ok: false,
            currentVersion,
            message: 'GitHub 请求受限，请稍后再试'
          }
        }
        return {
          ok: false,
          currentVersion,
          message: `检查更新失败（HTTP ${response.status}）`
        }
      }

      const tag = typeof data.tag_name === 'string' ? data.tag_name : ''
      const latestVersion = normalizeVersion(tag)
      if (!latestVersion) {
        return {
          ok: false,
          currentVersion,
          message: '最新版本信息格式不正确，请稍后再试'
        }
      }

      const updateAvailable = compareVersions(latestVersion, currentVersion) > 0
      const releaseUrl = validReleaseUrl(data.html_url) ? data.html_url : RELEASES_PAGE
      this.lastReleaseUrl = releaseUrl
      return {
        ok: true,
        currentVersion,
        latestVersion,
        updateAvailable,
        releaseName:
          typeof data.name === 'string' && data.name.trim()
            ? data.name.trim()
            : `v${latestVersion}`,
        releaseUrl,
        notes: releaseNotes(data.body),
        publishedAt: typeof data.published_at === 'string' ? data.published_at : undefined,
        message: updateAvailable
          ? `发现新版本 v${latestVersion}`
          : '当前已是最新版本'
      }
    } catch (error) {
      const timeout =
        error instanceof Error &&
        (error.name === 'AbortError' || error.message.toLowerCase().includes('abort'))
      return {
        ok: false,
        currentVersion,
        message: timeout
          ? '检查更新超时，请检查网络后重试'
          : '检查更新失败，请检查网络后重试'
      }
    } finally {
      clearTimeout(timer)
    }
  }

  async openRelease(): Promise<UpdateOpenResult> {
    const url = validReleaseUrl(this.lastReleaseUrl) ? this.lastReleaseUrl : RELEASES_PAGE
    try {
      await shell.openExternal(url)
      return { ok: true, message: '已打开发布页' }
    } catch {
      return { ok: false, message: '打开发布页失败' }
    }
  }
}
