export function normalizeVersion(value: string): string | null {
  const match = /^v?(\d+(?:\.\d+)*)$/i.exec(value.trim())
  return match ? match[1] : null
}

export function compareVersions(a: string, b: string): number {
  const left = normalizeVersion(a)?.split('.').map(Number) ?? [0]
  const right = normalizeVersion(b)?.split('.').map(Number) ?? [0]
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const l = left[index] ?? 0
    const r = right[index] ?? 0
    if (l !== r) return l > r ? 1 : -1
  }
  return 0
}
