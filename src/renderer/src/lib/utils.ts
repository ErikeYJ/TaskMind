import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function getErrorMessage(error: unknown, fallback = '操作失败'): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}

export function isImageFile(file: File): boolean {
  return /^image\/(png|jpeg|webp)$/i.test(file.type)
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('读取图片失败'))
    }
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}

export function imagesFromClipboard(event: ClipboardEvent): File[] {
  const items = event.clipboardData?.items
  if (!items) return []
  const files: File[] = []
  for (const item of Array.from(items)) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (file && isImageFile(file)) files.push(file)
  }
  if (files.length === 0 && event.clipboardData?.files) {
    for (const file of Array.from(event.clipboardData.files)) {
      if (isImageFile(file)) files.push(file)
    }
  }
  return files
}

export function imagesFromDataTransfer(dataTransfer: DataTransfer | null): File[] {
  if (!dataTransfer) return []
  const files = Array.from(dataTransfer.files).filter(isImageFile)
  if (files.length > 0) return files
  return Array.from(dataTransfer.items)
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file && isImageFile(file)))
}

export async function filesToDataUrls(files: File[]): Promise<string[]> {
  return Promise.all(files.map((file) => fileToDataUrl(file)))
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
