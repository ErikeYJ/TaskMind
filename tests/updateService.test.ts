import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchMock, openExternalMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  openExternalMock: vi.fn()
}))

vi.mock('electron', () => ({
  app: { getVersion: () => '0.1.6' },
  net: { fetch: fetchMock },
  shell: { openExternal: openExternalMock }
}))

import { UpdateService } from '../src/main/services/updateService'

function releaseResponse(tag: string, body = '更新说明') {
  return new Response(
    JSON.stringify({
      tag_name: tag,
      name: `TaskMind ${tag}`,
      html_url: `https://github.com/ErikeYJ/TaskMind/releases/tag/${tag}`,
      body,
      published_at: '2026-11-17T00:00:00Z'
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

beforeEach(() => {
  fetchMock.mockReset()
  openExternalMock.mockReset()
})

describe('update service', () => {
  it('detects a newer release and opens its GitHub page', async () => {
    fetchMock.mockResolvedValue(releaseResponse('v0.1.7', '### 新功能\n- 测试更新'))
    const service = new UpdateService()
    const result = await service.check()
    expect(result.ok).toBe(true)
    expect(result.updateAvailable).toBe(true)
    expect(result.latestVersion).toBe('0.1.7')
    expect(result.notes).toContain('测试更新')

    const opened = await service.openRelease()
    expect(opened.ok).toBe(true)
    expect(openExternalMock).toHaveBeenCalledWith(
      'https://github.com/ErikeYJ/TaskMind/releases/tag/v0.1.7'
    )
  })

  it('reports the current version as latest', async () => {
    fetchMock.mockResolvedValue(releaseResponse('v0.1.6'))
    const result = await new UpdateService().check()
    expect(result.ok).toBe(true)
    expect(result.updateAvailable).toBe(false)
    expect(result.message).toBe('当前已是最新版本')
  })

  it('returns a readable error when the network is unavailable', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    const result = await new UpdateService().check()
    expect(result.ok).toBe(false)
    expect(result.message).toContain('检查更新失败')
  })
})
