import { describe, expect, it } from 'vitest'
import { compareVersions, normalizeVersion } from '../src/shared/version'

describe('version comparison', () => {
  it('normalizes tags and compares numeric segments', () => {
    expect(normalizeVersion('v0.1.6')).toBe('0.1.6')
    expect(compareVersions('v0.1.6', '0.1.6')).toBe(0)
    expect(compareVersions('v0.1.10', '0.1.6')).toBe(1)
    expect(compareVersions('0.2.0', 'v0.1.99')).toBe(1)
    expect(compareVersions('v1.0.0', '1.0.1')).toBe(-1)
  })

  it('returns null for non-numeric tags', () => {
    expect(normalizeVersion('latest')).toBeNull()
    expect(normalizeVersion('v0.1.6-beta')).toBeNull()
  })
})
