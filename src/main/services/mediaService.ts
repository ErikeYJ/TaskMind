import { nativeImage } from 'electron'
import { existsSync, mkdirSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { extname, isAbsolute, join, relative, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { MAX_SCREENSHOT_BYTES } from '../../shared/constants'

const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([\s\S]+)$/i

export interface SavedImage {
  id: string
  fileName: string
  thumbName: string | null
  mimeType: string
  width: number
  height: number
}

export interface AiImagePayload {
  base64: string
  mimeType: string
}

function parseDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const match = DATA_URL_PATTERN.exec(dataUrl.trim())
  if (!match) {
    throw new Error('只支持 PNG、JPEG、WebP 图片')
  }
  const mimeType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase()
  const base64 = match[2].replace(/\s+/g, '')
  const buffer = Buffer.from(base64, 'base64')
  if (buffer.length === 0) {
    throw new Error('图片内容为空')
  }
  if (buffer.length > MAX_SCREENSHOT_BYTES) {
    throw new Error('图片超过 20MB，请压缩后再试')
  }
  return { buffer, mimeType }
}

function extensionFor(mimeType: string): string {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  return 'jpg'
}

export class MediaService {
  readonly imagesDir: string

  constructor(userDataDir: string) {
    this.imagesDir = join(userDataDir, 'images')
    if (!existsSync(this.imagesDir)) {
      mkdirSync(this.imagesDir, { recursive: true })
    }
  }

  private validateImage(buffer: Buffer): { width: number; height: number } {
    const image = nativeImage.createFromBuffer(buffer)
    if (image.isEmpty()) {
      throw new Error('无法识别这张图片，请换一张截图')
    }
    const size = image.getSize()
    if (!size.width || !size.height) {
      throw new Error('图片尺寸无效')
    }
    return size
  }

  async saveImage(dataUrl: string): Promise<SavedImage> {
    const { buffer, mimeType } = parseDataUrl(dataUrl)
    const size = this.validateImage(buffer)
    const id = randomUUID()
    const now = new Date()
    const year = String(now.getFullYear())
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const extension = extensionFor(mimeType)
    const fileName = `${year}/${month}/${id}.${extension}`
    const fullPath = join(this.imagesDir, year, month, `${id}.${extension}`)
    await mkdir(join(this.imagesDir, year, month), { recursive: true })
    await writeFile(fullPath, buffer)

    let thumbName: string | null = null
    try {
      const original = nativeImage.createFromBuffer(buffer)
      const targetWidth = Math.min(480, size.width)
      const thumbImage =
        targetWidth < size.width
          ? original.resize({ width: targetWidth, quality: 'good' })
          : original
      const thumbBuffer = thumbImage.toJPEG(82)
      if (thumbBuffer.length > 0) {
        thumbName = `${year}/${month}/${id}.thumb.jpg`
        await writeFile(join(this.imagesDir, year, month, `${id}.thumb.jpg`), thumbBuffer)
      }
    } catch {
      thumbName = null
    }

    return {
      id,
      fileName,
      thumbName,
      mimeType,
      width: size.width,
      height: size.height
    }
  }

  async prepareForAi(dataUrl: string): Promise<AiImagePayload> {
    const { buffer, mimeType } = parseDataUrl(dataUrl)
    const size = this.validateImage(buffer)
    const original = nativeImage.createFromBuffer(buffer)

    let width = Math.min(1600, size.width)
    let quality = 88
    let compressed = original.resize({ width, quality: 'good' }).toJPEG(quality)

    if (compressed.length > 4.5 * 1024 * 1024) {
      width = Math.min(1200, size.width)
      quality = 82
      compressed = original.resize({ width, quality: 'good' }).toJPEG(quality)
    }

    if (compressed.length === 0) {
      return {
        base64: buffer.toString('base64'),
        mimeType
      }
    }

    return {
      base64: compressed.toString('base64'),
      mimeType: 'image/jpeg'
    }
  }

  resolveImagePath(fileName: string): string | null {
    if (!fileName || isAbsolute(fileName)) return null
    const fullPath = resolve(this.imagesDir, fileName)
    const rel = relative(this.imagesDir, fullPath)
    if (rel.startsWith('..') || isAbsolute(rel)) return null
    if (!existsSync(fullPath)) return null
    return fullPath
  }

  async deleteFiles(fileName: string, thumbName: string | null): Promise<void> {
    const targets = [fileName, thumbName].filter(Boolean) as string[]
    await Promise.all(
      targets.map(async (name) => {
        const fullPath = this.resolveImagePath(name)
        if (fullPath) {
          try {
            await rm(fullPath, { force: true })
          } catch {
            // ignore cleanup errors
          }
        }
      })
    )
  }

  getFileExtension(fileName: string): string {
    return extname(fileName).toLowerCase()
  }
}
